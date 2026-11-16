import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import type {
  BucketTarget,
  FileToPut,
  PublishBucket,
} from '../../src/application/ports/publish-bucket.ts';

const bytes = (text: string) => new TextEncoder().encode(text);
const aFile = (key: string, text = 'hello'): FileToPut => ({
  key,
  bytes: bytes(text),
  contentType: 'text/html; charset=utf-8',
  cacheControl: 'public, max-age=300',
});

/** What every PublishBucket must do, run against each adapter. */
export function publishBucketContract(
  name: string,
  make: () => Promise<{
    readonly bucket: PublishBucket;
    /** A bucket that exists. */
    readonly target: BucketTarget;
    /** One that doesn't. */
    readonly missing: BucketTarget;
  }>,
): void {
  describe(`${name} meets the PublishBucket contract`, () => {
    const signal = new AbortController().signal;

    test('has the keys it signs with', async () => {
      const { bucket } = await make();

      expect(await bucket.hasKeys()).toBe(true);
    });

    test('lists nothing in an empty bucket', async () => {
      const { bucket, target } = await make();

      expect(await bucket.list(target, signal)).toEqual({
        ok: true,
        value: [],
      });
    });

    test('lists a file put there with its size, MD5 and time', async () => {
      const { bucket, target } = await make();
      await bucket.put(target, aFile('index.html'), signal);

      const listed = await bucket.list(target, signal);

      expect(listed).toMatchObject({
        ok: true,
        value: [
          {
            key: 'index.html',
            size: 5,
            md5: '5d41402abc4b2a76b9719d911017c592',
          },
        ],
      });
      const [file] = listed.ok ? listed.value : [];
      expect(Number.isNaN(Date.parse(file?.lastModified ?? ''))).toBe(false);
    });

    test('puts files under paths, and a second put replaces the first', async () => {
      const { bucket, target } = await make();
      await bucket.put(target, aFile('images/a b.jpg', 'one'), signal);
      await bucket.put(target, aFile('images/a b.jpg', 'second'), signal);

      const listed = await bucket.list(target, signal);

      expect(
        listed.ok && listed.value.map(({ key, size }) => [key, size]),
      ).toEqual([['images/a b.jpg', 6]]);
    });

    test('removes files by key, and a key that is not there is no failure', async () => {
      const { bucket, target } = await make();
      await bucket.put(target, aFile('a.html'), signal);
      await bucket.put(target, aFile('b.html'), signal);

      const removed = await bucket.deleteMany(
        target,
        ['a.html', 'never-there.html'],
        signal,
      );

      expect(removed.ok).toBe(true);
      const listed = await bucket.list(target, signal);
      expect(listed.ok && listed.value.map(({ key }) => key)).toEqual([
        'b.html',
      ]);
    });

    test('removing no keys is not a failure', async () => {
      const { bucket, target } = await make();

      expect((await bucket.deleteMany(target, [], signal)).ok).toBe(true);
    });

    test('lists and removes more files than one request holds', async () => {
      const { bucket, target } = await make();
      const keys = Array.from({ length: 1001 }, (_, n) => `f/${String(n)}.txt`);
      for (const key of keys) {
        await bucket.put(target, aFile(key, 'x'), signal);
      }

      const listed = await bucket.list(target, signal);
      expect(listed.ok && listed.value.length).toBe(1001);

      await bucket.deleteMany(target, keys, signal);
      expect(await bucket.list(target, signal)).toEqual({
        ok: true,
        value: [],
      });
    }, 30_000);

    test('says there is no bucket when there is none', async () => {
      const { bucket, missing } = await make();
      const failure = {
        ok: false,
        error: {
          kind: 'publish-failed',
          reason: 'no-bucket',
          bucket: missing.bucket,
        },
      };

      expect(await bucket.list(missing, signal)).toEqual(failure);
      expect(await bucket.put(missing, aFile('a.html'), signal)).toEqual(
        failure,
      );
      expect(await bucket.deleteMany(missing, ['a.html'], signal)).toEqual(
        failure,
      );
      expect(await bucket.get(missing, 'a.html', signal)).toEqual(failure);
    });

    test('gets a file it holds with its ETag, and nothing for a key it has none at', async () => {
      const { bucket, target } = await make();
      await bucket.put(target, aFile('filmfile/sync.json', '{"a":1}'), signal);

      const got = await bucket.get(target, 'filmfile/sync.json', signal);
      const none = await bucket.get(target, 'filmfile/none.json', signal);

      expect(got.ok && new TextDecoder().decode(got.value?.bytes)).toBe(
        '{"a":1}',
      );
      expect(got.ok && got.value?.etag).toMatch(/^[0-9a-f]{32}$/u);
      expect(none).toEqual({ ok: true, value: undefined });
    });

    test('puts a file only if none is there, when asked', async () => {
      const { bucket, target } = await make();
      const first = await bucket.putIf(
        target,
        aFile('claim.json', 'one'),
        { ifNoneMatch: true },
        signal,
      );
      const second = await bucket.putIf(
        target,
        aFile('claim.json', 'two'),
        { ifNoneMatch: true },
        signal,
      );

      expect(first.ok).toBe(true);
      expect(second).toEqual({
        ok: false,
        error: { kind: 'precondition-failed' },
      });
      const got = await bucket.get(target, 'claim.json', signal);
      expect(got.ok && new TextDecoder().decode(got.value?.bytes)).toBe('one');
    });

    test('replaces a file only if it is the one read, when asked', async () => {
      const { bucket, target } = await make();
      const made = await bucket.putIf(
        target,
        aFile('record.json', 'one'),
        { ifNoneMatch: true },
        signal,
      );
      const etag = made.ok ? made.value.etag : '';

      const changed = await bucket.putIf(
        target,
        aFile('record.json', 'two'),
        { ifMatch: etag },
        signal,
      );
      const stale = await bucket.putIf(
        target,
        aFile('record.json', 'three'),
        { ifMatch: etag },
        signal,
      );

      expect(changed.ok).toBe(true);
      expect(stale).toEqual({
        ok: false,
        error: { kind: 'precondition-failed' },
      });
    });

    test('puts a streamed file, giving the SHA-256 of what was sent', async () => {
      const { bucket, target } = await make();
      const text = 'a scan, streamed';

      const put = await bucket.putStream(
        target,
        {
          key: 'Library/2026/scan.jpg',
          size: text.length,
          contentType: 'image/jpeg',
          body: new Blob([text]).stream(),
        },
        signal,
      );

      expect(put).toEqual({
        ok: true,
        value: {
          sha256: createHash('sha256').update(text).digest('hex'),
        },
      });
      const listed = await bucket.list(target, signal);
      expect(
        listed.ok && listed.value.map(({ key, size }) => [key, size]),
      ).toEqual([['Library/2026/scan.jpg', text.length]]);
    });

    test('stops when asked to', async () => {
      const { bucket, target } = await make();
      const stopped = new AbortController();
      stopped.abort();

      await expect(
        bucket.put(target, aFile('a.html'), stopped.signal),
      ).rejects.toThrow();
    });
  });
}
