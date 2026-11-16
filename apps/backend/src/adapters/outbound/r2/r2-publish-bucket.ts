import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Clock } from '../../../application/ports/clock.ts';
import type { ErrorReporter } from '../../../application/ports/error-reporter.ts';
import type {
  BucketTarget,
  FileToPut,
  PublishBucket,
  RemoteFile,
} from '../../../application/ports/publish-bucket.ts';
import type {
  PublishFailed,
  PublishFailureReason,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { hasErrorCode } from '../filesystem/error-codes.ts';
import { parseAwsCredentials } from './aws-credentials-file.ts';
import { sha256Hex, signRequest } from './sign-request.ts';

/** The profile in `~/.aws/credentials` whose keys publish a site (D111). */
export const publishProfile = 'filmfile';

// Cloudflare's account IDs and R2's bucket names have these shapes; checked
// again here so a request can only ever go to an account's own R2 host.
const accountIdPattern = /^[0-9a-f]{32}$/iu;
const bucketPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u;

const requestTimeoutMs = 60_000;
const deleteBatchSize = 1000;

const unescapeXml = (text: string): string =>
  text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');

const escapeXml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** The text between `<tag>` and `</tag>` in some XML, if the tag is there. */
function tagText(xml: string, tag: string): string | undefined {
  const found = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'u').exec(xml);
  return found?.[1] === undefined ? undefined : unescapeXml(found[1]);
}

function remoteFileOf(contents: string): RemoteFile | undefined {
  const key = tagText(contents, 'Key');
  const size = Number(tagText(contents, 'Size'));
  const etag = tagText(contents, 'ETag');
  const lastModified = tagText(contents, 'LastModified');
  if (
    key === undefined ||
    etag === undefined ||
    lastModified === undefined ||
    !Number.isInteger(size)
  ) {
    return undefined;
  }
  return {
    key,
    size,
    md5: etag.replaceAll('"', '').toLowerCase(),
    lastModified: new Date(lastModified).toISOString(),
  };
}

/**
 * A Cloudflare R2 bucket, spoken to in S3's API with requests signed by our
 * own code (D111; no SDK). The keys are read from the `[filmfile]` profile of
 * the credentials file each time, never kept, logged or put in an error.
 * Files are put one at a time, with their content type and cache control.
 */
export class R2PublishBucket implements PublishBucket {
  readonly #credentialsFile: string;
  readonly #clock: Clock;
  readonly #errors: ErrorReporter;
  readonly #endpoint: (accountId: string) => string;
  readonly #fetch: typeof fetch;

  constructor(options: {
    /** The AWS credentials file, usually `~/.aws/credentials`. */
    readonly credentialsFile: string;
    readonly clock: Clock;
    /**
     * Where R2's answers that FilmFile has no words for go (a 400, a 5xx),
     * so the cause behind "Couldn't publish the site." can be found (D113).
     */
    readonly errors: ErrorReporter;
    /** Where an account's R2 is; tests point it at a local server. */
    readonly endpoint?: (accountId: string) => string;
    readonly fetch?: typeof fetch;
  }) {
    this.#credentialsFile = options.credentialsFile;
    this.#clock = options.clock;
    this.#errors = options.errors;
    this.#endpoint =
      options.endpoint ??
      ((accountId) => `https://${accountId}.r2.cloudflarestorage.com`);
    this.#fetch = options.fetch ?? fetch;
  }

  async #keys() {
    try {
      return parseAwsCredentials(
        await readFile(this.#credentialsFile, 'utf8'),
        publishProfile,
      );
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'EISDIR')) {
        return undefined;
      }
      throw error;
    }
  }

  async hasKeys(): Promise<boolean> {
    return (await this.#keys()) !== undefined;
  }

  /** Sends a signed request; the response if it worked, else why not. */
  async #send(
    target: BucketTarget,
    request: {
      /** What the request is, for the log: `PUT images/a.jpg`, `GET the listing`. */
      readonly what: string;
      readonly method: 'GET' | 'PUT' | 'POST';
      readonly key?: string;
      readonly query?: Readonly<Record<string, string>>;
      readonly headers?: Readonly<Record<string, string>>;
      readonly body?: Uint8Array;
      readonly signal: AbortSignal;
    },
  ): Promise<Result<Response, PublishFailed>> {
    const failed = (
      reason: PublishFailureReason,
    ): Result<never, PublishFailed> =>
      err({ kind: 'publish-failed', reason, bucket: target.bucket });
    if (
      !accountIdPattern.test(target.accountId) ||
      !bucketPattern.test(target.bucket)
    ) {
      return failed('other');
    }
    const keys = await this.#keys();
    if (keys === undefined) {
      return failed('no-credentials');
    }
    const url = new URL(
      `${this.#endpoint(target.accountId)}/${target.bucket}${
        request.key === undefined
          ? ''
          : `/${request.key.split('/').map(encodeURIComponent).join('/')}`
      }`,
    );
    for (const [name, value] of Object.entries(request.query ?? {})) {
      url.searchParams.set(name, value);
    }
    const body = request.body ?? new Uint8Array();
    const payloadHash = sha256Hex(body);
    const headers = {
      ...request.headers,
      host: url.host,
      'x-amz-content-sha256': payloadHash,
    };
    const signed = signRequest({
      method: request.method,
      url,
      headers,
      payloadHash,
      keys,
      region: 'auto',
      service: 's3',
      date: this.#clock.now(),
    });
    // `host` is set by fetch itself, from the URL signed above.
    const toSend = Object.fromEntries(
      Object.entries({ ...headers, ...signed }).filter(
        ([name]) => name !== 'host',
      ),
    );
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: request.method,
        headers: toSend,
        ...(request.method === 'GET' ? {} : { body: new Uint8Array(body) }),
        signal: AbortSignal.any([
          request.signal,
          AbortSignal.timeout(requestTimeoutMs),
        ]),
      });
    } catch (error) {
      if (request.signal.aborted) {
        throw error;
      }
      return failed('unreachable');
    }
    if (response.ok) {
      return ok(response);
    }
    const text = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) {
      return failed('keys-refused');
    }
    const code = tagText(text, 'Code') ?? 'no error code';
    if (response.status === 404 && code === 'NoSuchBucket') {
      return failed('no-bucket');
    }
    // Only R2's code and message are logged: never the request's headers,
    // which carry the key ID, or the file.
    this.#errors.report(
      `R2 refused ${request.what} in ${target.bucket}: ${String(response.status)} ${code}`,
      tagText(text, 'Message') ?? '(no message)',
    );
    return failed('other');
  }

  async list(
    target: BucketTarget,
    signal: AbortSignal,
  ): Promise<Result<readonly RemoteFile[], PublishFailed>> {
    const files: RemoteFile[] = [];
    let token: string | undefined;
    do {
      const sent = await this.#send(target, {
        what: 'GET the listing',
        method: 'GET',
        query: {
          'list-type': '2',
          ...(token === undefined ? {} : { 'continuation-token': token }),
        },
        signal,
      });
      if (!sent.ok) {
        return sent;
      }
      const xml = await sent.value.text();
      for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/gu)) {
        const file = remoteFileOf(match[1] ?? '');
        if (file === undefined) {
          this.#errors.report(
            `R2's listing of ${target.bucket} couldn't be read`,
            'a file in it has no key, size, ETag or time',
          );
          return err({
            kind: 'publish-failed',
            reason: 'other',
            bucket: target.bucket,
          });
        }
        files.push(file);
      }
      token =
        tagText(xml, 'IsTruncated') === 'true'
          ? tagText(xml, 'NextContinuationToken')
          : undefined;
    } while (token !== undefined);
    return ok(files);
  }

  async put(
    target: BucketTarget,
    file: FileToPut,
    signal: AbortSignal,
  ): Promise<Result<undefined, PublishFailed>> {
    const sent = await this.#send(target, {
      what: `PUT ${file.key}`,
      method: 'PUT',
      key: file.key,
      headers: {
        'content-type': file.contentType,
        'cache-control': file.cacheControl,
      },
      body: file.bytes,
      signal,
    });
    return sent.ok ? ok(undefined) : sent;
  }

  async deleteMany(
    target: BucketTarget,
    keys: readonly string[],
    signal: AbortSignal,
  ): Promise<Result<undefined, PublishFailed>> {
    for (let from = 0; from < keys.length; from += deleteBatchSize) {
      const batch = keys.slice(from, from + deleteBatchSize);
      const body = new TextEncoder().encode(
        `<Delete><Quiet>true</Quiet>${batch
          .map((key) => `<Object><Key>${escapeXml(key)}</Key></Object>`)
          .join('')}</Delete>`,
      );
      const sent = await this.#send(target, {
        what: `POST a removal of ${String(batch.length)} files`,
        method: 'POST',
        query: { delete: '' },
        headers: {
          'content-type': 'application/xml',
          // S3's API wants this on a bulk delete; it is a checksum, not security.
          'content-md5': createHash('md5').update(body).digest('base64'),
        },
        body,
        signal,
      });
      if (!sent.ok) {
        return sent;
      }
      const answer = await sent.value.text();
      if (answer.includes('<Error>')) {
        this.#errors.report(
          `R2 didn't remove every file asked in ${target.bucket}: ${tagText(answer, 'Code') ?? 'no error code'}`,
          tagText(answer, 'Message') ?? '(no message)',
        );
        return err({
          kind: 'publish-failed',
          reason: 'other',
          bucket: target.bucket,
        });
      }
    }
    return ok(undefined);
  }
}
