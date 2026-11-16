import { createHash, createHmac } from 'node:crypto';
import type { AwsKeys } from './aws-credentials-file.ts';

/** The SHA-256 of some bytes in lower-case hexadecimal: a request's payload hash. */
export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const hmac = (key: string | Buffer, text: string): Buffer =>
  createHmac('sha256', key).update(text).digest();

/** Percent-encodes as AWS wants: everything but letters, digits and `-_.~`. */
function uriEncode(text: string): string {
  return encodeURIComponent(text).replace(
    /[!'()*]/gu,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalQuery(url: URL): string {
  return [...url.searchParams]
    .map(([name, value]) => [uriEncode(name), uriEncode(value)] as const)
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
}

/** AWS's time format: `20130524T000000Z`. */
export function amzDateOf(date: Date): string {
  return date.toISOString().replace(/[-:]|\.\d{3}/gu, '');
}

/**
 * Signs a request with AWS Signature Version 4, as R2 and S3 check it
 * (https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html).
 * `headers` are those to send and sign, with `host` among them; S3 also wants
 * `x-amz-content-sha256`. `x-amz-date` is added. Gives the headers to add:
 * `x-amz-date` and `authorization`. S3's paths are encoded once, not twice.
 */
export function signRequest(input: {
  readonly method: string;
  readonly url: URL;
  readonly headers: Readonly<Record<string, string>>;
  readonly payloadHash: string;
  readonly keys: AwsKeys;
  readonly region: string;
  readonly service: string;
  readonly date: Date;
}): { readonly 'x-amz-date': string; readonly authorization: string } {
  const amzDate = amzDateOf(input.date);
  const day = amzDate.slice(0, 8);
  const signed = new Map<string, string>();
  for (const [name, value] of Object.entries({
    ...input.headers,
    'x-amz-date': amzDate,
  })) {
    signed.set(name.toLowerCase(), value.trim().replace(/\s+/gu, ' '));
  }
  const names = [...signed.keys()].sort();
  const canonicalPath = input.url.pathname
    .split('/')
    .map((segment) => uriEncode(decodeURIComponent(segment)))
    .join('/');
  const canonicalRequest = [
    input.method,
    canonicalPath,
    canonicalQuery(input.url),
    ...names.map((name) => `${name}:${signed.get(name) ?? ''}`),
    '',
    names.join(';'),
    input.payloadHash,
  ].join('\n');
  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  let signingKey = hmac(`AWS4${input.keys.secretAccessKey}`, day);
  for (const part of [input.region, input.service, 'aws4_request']) {
    signingKey = hmac(signingKey, part);
  }
  const signature = hmac(signingKey, stringToSign).toString('hex');
  return {
    'x-amz-date': amzDate,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.keys.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
  };
}
