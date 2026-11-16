import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { FixedClock } from '../../src/adapters/outbound/memory/fixed-clock.ts';
import { InMemoryPublishBucket } from '../../src/adapters/outbound/memory/in-memory-publish-bucket.ts';
import { R2PublishBucket } from '../../src/adapters/outbound/r2/r2-publish-bucket.ts';
import type { BucketTarget } from '../../src/application/ports/publish-bucket.ts';
import { startFakeR2, type FakeR2 } from '../support/fake-r2-server.ts';
import { publishBucketContract } from './publish-bucket-contract.ts';

const account = '0123456789abcdef0123456789abcdef';
const target: BucketTarget = { accountId: account, bucket: 'photos-pirt' };
const missing: BucketTarget = { accountId: account, bucket: 'no-such-bucket' };
const keys = { accessKeyId: 'FILMKEY', secretAccessKey: 'film/secret+value' };
const clock = new FixedClock('2026-11-02T12:00:00.000Z');

publishBucketContract('InMemoryPublishBucket', () => {
  const bucket = new InMemoryPublishBucket(clock);
  bucket.createBucket(target);
  return Promise.resolve({ bucket, target, missing });
});

const folders: string[] = [];
const servers: FakeR2[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(
    folders.splice(0).map((folder) => rm(folder, { recursive: true })),
  );
});

async function credentialsFile(text: string): Promise<string> {
  const folder = await mkdtemp(path.join(tmpdir(), 'filmfile-aws-'));
  folders.push(folder);
  const file = path.join(folder, 'credentials');
  await writeFile(file, text);
  return file;
}

const goodCredentials = `[filmfile]
aws_access_key_id = ${keys.accessKeyId}
aws_secret_access_key = ${keys.secretAccessKey}
`;

async function r2Against(
  fake: FakeR2,
  credentials = goodCredentials,
): Promise<R2PublishBucket> {
  return new R2PublishBucket({
    credentialsFile: await credentialsFile(credentials),
    clock,
    endpoint: fake.endpoint,
  });
}

async function aFakeR2(): Promise<FakeR2> {
  const fake = await startFakeR2(keys, ['photos-pirt']);
  servers.push(fake);
  return fake;
}

publishBucketContract('R2PublishBucket (against a local R2)', async () => ({
  bucket: await r2Against(await aFakeR2()),
  target,
  missing,
}));

describe('R2PublishBucket', () => {
  const signal = new AbortController().signal;

  test('signs its requests so R2 accepts them, and sends each file with its types', async () => {
    const fake = await aFakeR2();
    const bucket = await r2Against(fake);

    await bucket.put(
      target,
      {
        key: 'images/a b.jpg',
        bytes: new TextEncoder().encode('jpeg'),
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000, immutable',
      },
      signal,
    );

    expect(fake.files('photos-pirt').get('images/a b.jpg')).toMatchObject({
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
    });
  });

  test.each([
    ['no credentials file', undefined],
    [
      'no [filmfile] profile',
      '[default]\naws_access_key_id = A\naws_secret_access_key = B\n',
    ],
    ['a profile with no secret', '[filmfile]\naws_access_key_id = A\n'],
  ])('has no keys with %s', async (_name, text) => {
    const fake = await aFakeR2();
    const bucket =
      text === undefined
        ? new R2PublishBucket({
            credentialsFile: '/nowhere/credentials',
            clock,
            endpoint: fake.endpoint,
          })
        : await r2Against(fake, text);

    expect(await bucket.hasKeys()).toBe(false);
    expect(fake.requests).toEqual([]);
  });

  test('says there are no keys when there is no credentials file', async () => {
    const fake = await aFakeR2();
    const bucket = new R2PublishBucket({
      credentialsFile: '/nowhere/credentials',
      clock,
      endpoint: fake.endpoint,
    });

    expect(await bucket.list(target, signal)).toEqual({
      ok: false,
      error: {
        kind: 'publish-failed',
        reason: 'no-credentials',
        bucket: 'photos-pirt',
      },
    });
    expect(fake.requests).toEqual([]);
  });

  test('says there are no keys when the file has no [filmfile] profile', async () => {
    const fake = await aFakeR2();
    const bucket = await r2Against(
      fake,
      '[default]\naws_access_key_id = A\naws_secret_access_key = B\n',
    );

    expect(await bucket.list(target, signal)).toMatchObject({
      ok: false,
      error: { reason: 'no-credentials' },
    });
  });

  test.each([
    ['a key ID R2 does not know', 'OTHERKEY', keys.secretAccessKey],
    ['a secret that does not match', keys.accessKeyId, 'wrong-secret'],
  ])('says the keys were refused for %s', async (_name, id, secret) => {
    const fake = await aFakeR2();
    const bucket = await r2Against(
      fake,
      `[filmfile]\naws_access_key_id = ${id}\naws_secret_access_key = ${secret}\n`,
    );

    expect(await bucket.list(target, signal)).toEqual({
      ok: false,
      error: {
        kind: 'publish-failed',
        reason: 'keys-refused',
        bucket: 'photos-pirt',
      },
    });
  });

  test('says it could not reach R2 when nothing answers', async () => {
    const fake = await aFakeR2();
    const bucket = await r2Against(fake);
    await fake.close();

    expect(await bucket.list(target, signal)).toMatchObject({
      ok: false,
      error: { reason: 'unreachable' },
    });
  });

  test('refuses an account ID or bucket of the wrong shape without making a request', async () => {
    const fake = await aFakeR2();
    const bucket = await r2Against(fake);

    for (const odd of [
      { accountId: 'evil.example.com/', bucket: 'photos-pirt' },
      { accountId: account, bucket: '../x' },
    ]) {
      expect(await bucket.list(odd, signal)).toMatchObject({
        ok: false,
        error: { reason: 'other' },
      });
    }
    expect(fake.requests).toEqual([]);
  });

  test('never puts the keys in what it says', async () => {
    const fake = await aFakeR2();
    const bucket = await r2Against(
      fake,
      '[filmfile]\naws_access_key_id = LEAKYID\naws_secret_access_key = leaky-secret\n',
    );

    const result = await bucket.list(target, signal);

    expect(JSON.stringify(result)).not.toContain('leaky');
    expect(JSON.stringify(result)).not.toContain('LEAKYID');
  });
});
