import { createHash } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AwsKeys } from '../../src/adapters/outbound/r2/aws-credentials-file.ts';
import {
  sha256Hex,
  signRequest,
} from '../../src/adapters/outbound/r2/sign-request.ts';

/** What the fake keeps for a file put into it. */
export interface FakeR2File {
  readonly bytes: Uint8Array;
  readonly contentType: string | undefined;
  readonly cacheControl: string | undefined;
}

export interface FakeR2 {
  /** Where an account's R2 is, for the adapter's `endpoint` option. */
  readonly endpoint: (accountId: string) => string;
  /** The files in a bucket by key. */
  readonly files: (bucket: string) => ReadonlyMap<string, FakeR2File>;
  /** Every request made, as `METHOD /path?query`. */
  readonly requests: readonly string[];
  readonly close: () => Promise<void>;
}

const pageSize = 1000;

const xmlEscape = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const xmlUnescape = (text: string): string =>
  text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');

const md5Of = (bytes: Uint8Array): string =>
  createHash('md5').update(bytes).digest('hex');

function failure(response: ServerResponse, status: number, code: string): void {
  response.writeHead(status, { 'content-type': 'application/xml' });
  response.end(`<?xml version="1.0"?><Error><Code>${code}</Code></Error>`);
}

async function bodyOf(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks);
}

/**
 * A small local server that speaks enough of S3's API for R2: listing (in
 * pages of 1,000), put and bulk delete, in buckets it was told about. It
 * checks each request's signature the way R2 does, and says so with the
 * errors R2 gives: 403 for keys it doesn't know or a bad signature, 404
 * `NoSuchBucket` for a bucket it hasn't got.
 */
export async function startFakeR2(
  keys: AwsKeys,
  bucketNames: readonly string[],
): Promise<FakeR2> {
  const buckets = new Map(
    bucketNames.map((name) => [name, new Map<string, FakeR2File>()]),
  );
  const requests: string[] = [];

  function signatureIsRight(
    request: IncomingMessage,
    url: URL,
    body: Uint8Array,
  ): 'ok' | 'unknown-key' | 'bad-signature' {
    const authorization = request.headers.authorization ?? '';
    const parts =
      /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/auto\/s3\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]+)$/u.exec(
        authorization,
      );
    if (parts === null) {
      return 'bad-signature';
    }
    if (parts[1] !== keys.accessKeyId) {
      return 'unknown-key';
    }
    const headers: Record<string, string> = {};
    for (const name of (parts[3] ?? '').split(';')) {
      if (name !== 'x-amz-date') {
        headers[name] = String(request.headers[name] ?? '');
      }
    }
    const amzDate = String(request.headers['x-amz-date'] ?? '');
    const date = new Date(
      amzDate.replace(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u,
        '$1-$2-$3T$4:$5:$6Z',
      ),
    );
    const payloadHash = String(request.headers['x-amz-content-sha256'] ?? '');
    if (payloadHash !== sha256Hex(body) || Number.isNaN(date.getTime())) {
      return 'bad-signature';
    }
    const expected = signRequest({
      method: request.method ?? '',
      url,
      headers,
      payloadHash,
      keys,
      region: 'auto',
      service: 's3',
      date,
    });
    return expected.authorization === authorization ? 'ok' : 'bad-signature';
  }

  async function handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const url = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? 'localhost'}`,
    );
    requests.push(`${request.method ?? ''} ${url.pathname}${url.search}`);
    const body = await bodyOf(request);
    const signature = signatureIsRight(request, url, body);
    if (signature !== 'ok') {
      failure(
        response,
        403,
        signature === 'unknown-key'
          ? 'InvalidAccessKeyId'
          : 'SignatureDoesNotMatch',
      );
      return;
    }
    const [, bucketName = '', ...keyParts] = url.pathname.split('/');
    const bucket = buckets.get(decodeURIComponent(bucketName));
    if (bucket === undefined) {
      failure(response, 404, 'NoSuchBucket');
      return;
    }
    const key = keyParts.map(decodeURIComponent).join('/');

    if (request.method === 'PUT') {
      bucket.set(key, {
        bytes: new Uint8Array(body),
        contentType: request.headers['content-type'],
        cacheControl: request.headers['cache-control'],
      });
      response.writeHead(200, { etag: `"${md5Of(body)}"` });
      response.end();
      return;
    }
    if (request.method === 'POST' && url.searchParams.has('delete')) {
      for (const [, name = ''] of body
        .toString()
        .matchAll(/<Key>([\s\S]*?)<\/Key>/gu)) {
        bucket.delete(xmlUnescape(name));
      }
      response.writeHead(200, { 'content-type': 'application/xml' });
      response.end('<?xml version="1.0"?><DeleteResult></DeleteResult>');
      return;
    }
    if (request.method === 'GET' && url.searchParams.get('list-type') === '2') {
      const all = [...bucket].sort(([a], [b]) => (a < b ? -1 : 1));
      const start = Number(url.searchParams.get('continuation-token') ?? 0);
      const page = all.slice(start, start + pageSize);
      const more = start + pageSize < all.length;
      response.writeHead(200, { 'content-type': 'application/xml' });
      response.end(
        `<?xml version="1.0"?><ListBucketResult><IsTruncated>${String(more)}</IsTruncated>${
          more
            ? `<NextContinuationToken>${String(start + pageSize)}</NextContinuationToken>`
            : ''
        }${page
          .map(
            ([name, file]) =>
              `<Contents><Key>${xmlEscape(name)}</Key><LastModified>2026-11-02T12:00:00.000Z</LastModified><ETag>&quot;${md5Of(file.bytes)}&quot;</ETag><Size>${String(file.bytes.length)}</Size></Contents>`,
          )
          .join('')}</ListBucketResult>`,
      );
      return;
    }
    failure(response, 400, 'InvalidRequest');
  }

  const server: Server = createServer((request, response) => {
    handle(request, response).catch(() => {
      response.writeHead(500);
      response.end();
    });
  });
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('the fake R2 has no port'));
      } else {
        resolve(address.port);
      }
    });
  });

  return {
    endpoint: () => `http://127.0.0.1:${String(port)}`,
    files: (bucket) => buckets.get(bucket) ?? new Map(),
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
        server.closeAllConnections();
      }),
  };
}
