import { describe, expect, test } from 'vitest';
import { signRequest, sha256Hex } from './sign-request.ts';

// AWS's published examples, so the signing is checked against theirs, not ours.

const emptyHash =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('signRequest', () => {
  test("signs AWS's get-vanilla example", () => {
    const signed = signRequest({
      method: 'GET',
      url: new URL('https://example.amazonaws.com/'),
      headers: { host: 'example.amazonaws.com' },
      payloadHash: emptyHash,
      keys: {
        accessKeyId: 'AKIDEXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      },
      region: 'us-east-1',
      service: 'service',
      date: new Date('2015-08-30T12:36:00Z'),
    });

    expect(signed).toEqual({
      'x-amz-date': '20150830T123600Z',
      authorization:
        'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    });
  });

  const s3Keys = {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  };

  test("signs S3's GET Object example, with a Range header", () => {
    const signed = signRequest({
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      headers: {
        host: 'examplebucket.s3.amazonaws.com',
        range: 'bytes=0-9',
        'x-amz-content-sha256': emptyHash,
      },
      payloadHash: emptyHash,
      keys: s3Keys,
      region: 'us-east-1',
      service: 's3',
      date: new Date('2013-05-24T00:00:00Z'),
    });

    expect(signed.authorization).toContain(
      'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });

  test("signs S3's GET Bucket (List Objects) example, with a query", () => {
    const signed = signRequest({
      method: 'GET',
      url: new URL(
        'https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J',
      ),
      headers: {
        host: 'examplebucket.s3.amazonaws.com',
        'x-amz-content-sha256': emptyHash,
      },
      payloadHash: emptyHash,
      keys: s3Keys,
      region: 'us-east-1',
      service: 's3',
      date: new Date('2013-05-24T00:00:00Z'),
    });

    expect(signed.authorization).toContain(
      'Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7',
    );
  });
});

test('hashes as SHA-256 in hexadecimal', () => {
  expect(sha256Hex('')).toBe(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
});
