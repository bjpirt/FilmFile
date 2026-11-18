import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { syncSettings, syncStatus } from '@filmfile/contracts/sync';
import { FixedClock } from '../../src/adapters/outbound/memory/fixed-clock.ts';
import { InMemoryPublishBucket } from '../../src/adapters/outbound/memory/in-memory-publish-bucket.ts';
import { InMemorySyncSettings } from '../../src/adapters/outbound/memory/in-memory-sync-settings.ts';
import type {
  BucketTarget,
  RemoteFile,
  StreamToPut,
} from '../../src/application/ports/publish-bucket.ts';
import type { PublishFailed } from '../../src/domain/shared/domain-error.ts';
import { err, type Result } from '../../src/domain/shared/result.ts';
import { computerNameFrom } from '../../src/domain/sync/computer-name.ts';
import {
  parseManifest,
  parseSyncRecord,
} from '../../src/domain/sync/sync-files.ts';
import { apiFor } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const accountId = '0123456789abcdef0123456789abcdef';
const target: BucketTarget = { accountId, bucket: 'backup-pirt' };
const now = '2026-11-16T14:02:00.000Z';

/** A bucket that remembers what was streamed into it, and can hold those puts back. */
class WatchedBucket extends InMemoryPublishBucket {
  readonly streamed: string[] = [];
  holding: Promise<void> | undefined;
  /** How many times the bucket was listed. */
  listed = 0;

  override async list(
    to: BucketTarget,
    signal: AbortSignal,
  ): Promise<Result<readonly RemoteFile[], PublishFailed>> {
    this.listed += 1;
    return super.list(to, signal);
  }

  override async putStream(
    to: BucketTarget,
    file: StreamToPut,
    signal: AbortSignal,
  ): Promise<Result<{ readonly sha256: string }, PublishFailed>> {
    this.streamed.push(file.key);
    await this.holding;
    return super.putStream(to, file, signal);
  }
}

/** The third upload fails as if offline; the others go, so some files really are sent. */
function failTheThirdUpload(bucket: WatchedBucket): void {
  const putStream = bucket.putStream.bind(bucket);
  let started = 0;
  bucket.putStream = async (to, file, signal) => {
    started += 1;
    if (started === 3) {
      bucket.streamed.push(file.key);
      await file.body.cancel();
      return err({
        kind: 'publish-failed',
        reason: 'unreachable',
        bucket: to.bucket,
      });
    }
    return putStream(to, file, signal);
  };
}

function setUp(options: { readonly app?: boolean } = {}) {
  const bucket = new WatchedBucket(new FixedClock(now));
  bucket.createBucket(target);
  const store = new InMemorySyncSettings();
  const api = apiFor(archive, {
    clock: new FixedClock(now),
    publishBucket: bucket,
    ...((options.app ?? true) ? { syncSettings: store } : {}),
  });
  const { request, post } = api;
  const put = (url: string, body: unknown) =>
    request(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  async function setUpWithAccount(withAccount = true) {
    await post('/api/settings', { author: 'Ben Pirt' });
    if (withAccount) {
      const etag = (await request('/api/settings')).headers.get('ETag') ?? '';
      await request('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': etag },
        body: JSON.stringify({ cloudflareAccountId: accountId }),
      });
    }
  }

  async function ready() {
    await setUpWithAccount();
    expect(
      (
        await put('/api/sync/settings', {
          bucket: 'backup-pirt',
          computerName: 'Studio',
        })
      ).status,
    ).toBe(200);
  }

  const status = async () =>
    syncStatus.parse(await (await request('/api/sync')).json());

  async function untilDone() {
    // Up to 30 seconds, for when every test file runs at once.
    for (let tries = 0; tries < 3000; tries += 1) {
      const now = await status();
      if (
        now.run !== null &&
        now.run.state !== 'running' &&
        now.run.state !== 'stopping'
      ) {
        return now.run;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('the sync did not finish');
  }

  async function sync() {
    const started = await post('/api/sync', {});
    expect(started.status).toBe(202);
    return untilDone();
  }

  const fileInBucket = async (key: string) => {
    const got = await bucket.get(target, key, new AbortController().signal);
    return got.ok && got.value !== undefined
      ? new TextDecoder().decode(got.value.bytes)
      : undefined;
  };

  /** How syncing stands, asked of the service started again, with the same bucket and this computer's settings. */
  function restarted() {
    const again = apiFor(archive, {
      clock: new FixedClock(now),
      publishBucket: bucket,
      ...((options.app ?? true) ? { syncSettings: store } : {}),
    });
    return async () =>
      syncStatus.parse(await (await again.request('/api/sync')).json());
  }

  return {
    bucket,
    store,
    restarted,
    request,
    post,
    put,
    setUpWithAccount,
    ready,
    status,
    sync,
    untilDone,
    fileInBucket,
  };
}

async function putInLibrary(relative: string, text: string) {
  const file = path.join(archive.path(), ...relative.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

describe("this computer's sync settings", () => {
  test('without the desktop app, sync is not available and nothing can be set', async () => {
    const { request, put, post, setUpWithAccount } = setUp({ app: false });
    await setUpWithAccount();

    expect(
      syncSettings.parse(await (await request('/api/sync/settings')).json()),
    ).toEqual({
      available: false,
      bucket: null,
      computerName: null,
      lastSyncedAt: null,
    });
    const saved = await put('/api/sync/settings', {
      bucket: 'backup-pirt',
      computerName: 'Studio',
    });
    expect(saved.status).toBe(422);
    expect(await saved.json()).toMatchObject({
      issues: [{ path: ['sync'], message: 'sync works in the FilmFile app' }],
    });
    expect((await post('/api/sync', {})).status).toBe(422);
    expect((await status()).available).toBe(false);

    async function status() {
      return syncStatus.parse(await (await request('/api/sync')).json());
    }
  });

  test("start with no bucket and this computer's own name, and are kept by the app once saved", async () => {
    const { request, put, store } = setUp();

    expect(
      syncSettings.parse(await (await request('/api/sync/settings')).json()),
    ).toEqual({
      available: true,
      bucket: null,
      computerName: computerNameFrom(hostname()),
      lastSyncedAt: null,
    });
    const saved = await put('/api/sync/settings', {
      bucket: ' backup-pirt ',
      computerName: ' Studio ',
    });

    expect(syncSettings.parse(await saved.json())).toMatchObject({
      bucket: 'backup-pirt',
      computerName: 'Studio',
    });
    expect(store.settings).toEqual({
      bucket: 'backup-pirt',
      computerName: 'Studio',
      lastSync: null,
    });
  });

  test('refuses a bucket R2 would not take and a name of no characters, saving nothing', async () => {
    const { put, store } = setUp();

    const refused = await put('/api/sync/settings', {
      bucket: 'Backup_Pirt',
      computerName: '  ',
    });

    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({
      issues: [
        { path: ['bucket'] },
        { path: ['computerName'], message: 'must be 1 to 60 characters' },
      ],
    });
    expect(store.settings.bucket).toBeNull();
  });

  test('a different bucket forgets the last sync', async () => {
    const { put, store } = setUp();
    store.settings = {
      bucket: 'backup-pirt',
      computerName: 'Studio',
      lastSync: { sync: 2, at: now },
    };

    await put('/api/sync/settings', {
      bucket: 'backup-other',
      computerName: 'Studio',
    });

    expect(store.settings.lastSync).toBeNull();
  });
});

describe('GET /api/sync', () => {
  test('is ready only once the Cloudflare account and a bucket are set', async () => {
    const { status, put, setUpWithAccount } = setUp();
    await setUpWithAccount(false);
    await put('/api/sync/settings', {
      bucket: 'backup-pirt',
      computerName: 'Studio',
    });
    expect((await status()).ready).toBe(false);

    await setUpWithAccount();

    expect(await status()).toEqual({
      available: true,
      ready: true,
      lastSyncedAt: null,
      firstSync: null,
      run: null,
    });
  });

  test('is not ready without a bucket', async () => {
    const withoutBucket = setUp();
    await withoutBucket.setUpWithAccount();
    expect((await withoutBucket.status()).ready).toBe(false);
  });

  test('is not ready without the desktop app', async () => {
    const { request, setUpWithAccount } = setUp({ app: false });
    await setUpWithAccount();
    expect(
      syncStatus.parse(await (await request('/api/sync')).json()).ready,
    ).toBe(false);
  });
});

describe('POST /api/sync', () => {
  test('says to set the account, or the bucket, first', async () => {
    const { post, put, setUpWithAccount } = setUp();
    await setUpWithAccount(false);
    await put('/api/sync/settings', {
      bucket: 'backup-pirt',
      computerName: 'Studio',
    });

    const noAccount = await post('/api/sync', {});
    expect(noAccount.status).toBe(422);
    expect(await noAccount.json()).toMatchObject({
      issues: [
        {
          path: ['cloudflareAccountId'],
          message: 'Set your Cloudflare account ID in Settings.',
        },
      ],
    });
  });

  test('says to choose a bucket first', async () => {
    const { post, setUpWithAccount } = setUp();
    await setUpWithAccount();

    const noBucket = await post('/api/sync', {});

    expect(noBucket.status).toBe(422);
    expect(await noBucket.json()).toMatchObject({
      issues: [{ path: ['bucket'], message: 'say which bucket to sync with' }],
    });
  });

  test('claims an empty bucket and sends the library and settings.json, at the same paths, leaving out dotfiles', async () => {
    const { bucket, ready, sync, status, store, fileInBucket } = setUp();
    await ready();
    await putInLibrary('rolls/2026-014-AAAAAAAA/roll.json', '{"roll":1}');
    await putInLibrary('.DS_Store', 'finder');
    await putInLibrary('rolls/._roll.json', 'finder');

    const run = await sync();

    expect(run).toMatchObject({ state: 'done', failure: null });
    const keys = [...bucket.files(target).keys()].sort();
    expect(keys).toEqual([
      'Library/rolls/2026-014-AAAAAAAA/roll.json',
      'filmfile/manifest.json',
      'filmfile/sync.json',
      'settings.json',
    ]);
    expect(run.filesDone).toBe(2);
    expect(run.filesTotal).toBe(2);
    expect(run.bytesDone).toBe(run.bytesTotal);
    expect(
      await fileInBucket('Library/rolls/2026-014-AAAAAAAA/roll.json'),
    ).toBe('{"roll":1}');
    const record = parseSyncRecord(
      (await fileInBucket('filmfile/sync.json')) ?? '',
    );
    expect(record).toMatchObject({ sync: 1, computer: 'Studio', at: now });
    expect(
      parseManifest((await fileInBucket('filmfile/manifest.json')) ?? '')?.map(
        (file) => file.path,
      ),
    ).toEqual(['Library/rolls/2026-014-AAAAAAAA/roll.json', 'settings.json']);
    expect(store.settings.lastSync).toEqual({ sync: 1, at: now });
    expect((await status()).lastSyncedAt).toBe(now);
  });

  test('syncing again sends only what is new or changed, and nothing when nothing changed', async () => {
    const { bucket, ready, sync, fileInBucket } = setUp();
    await ready();
    await putInLibrary('a.json', 'one');
    await putInLibrary('b.json', 'b');
    await sync();
    bucket.streamed.length = 0;

    const unchanged = await sync();
    expect(unchanged).toMatchObject({ state: 'done', filesTotal: 0 });
    expect(bucket.streamed).toEqual([]);

    await putInLibrary('a.json', 'second');
    await putInLibrary('c.json', 'c');
    const changed = await sync();

    expect(changed).toMatchObject({ state: 'done', filesTotal: 2 });
    expect(bucket.streamed.sort()).toEqual([
      'Library/a.json',
      'Library/c.json',
    ]);
    expect(await fileInBucket('Library/a.json')).toBe('second');
    expect(
      parseSyncRecord((await fileInBucket('filmfile/sync.json')) ?? '')?.sync,
    ).toBe(3);
  });

  test('refuses a bucket with something else in it, sending nothing', async () => {
    const { bucket, ready, sync } = setUp();
    await ready();
    await bucket.put(
      target,
      {
        key: 'holiday.jpg',
        bytes: new Uint8Array([1]),
        contentType: 'image/jpeg',
        cacheControl: 'x',
      },
      new AbortController().signal,
    );

    expect(await sync()).toMatchObject({
      state: 'failed',
      failure: 'not-empty',
      message:
        "That bucket has something else in it, so FilmFile won't sync with it.",
    });
    expect(bucket.streamed).toEqual([]);
    expect(bucket.files(target).has('filmfile/sync.json')).toBe(false);
  });

  test('refuses a bucket that backs up another library', async () => {
    const { bucket, ready, sync } = setUp();
    await ready();
    await bucket.put(
      target,
      {
        key: 'filmfile/sync.json',
        bytes: new TextEncoder().encode(
          JSON.stringify({
            archiveId: '01JC8Y00000000000000000OTHER'.slice(0, 26),
            sync: 4,
            computer: 'Laptop',
            at: now,
          }),
        ),
        contentType: 'application/json',
        cacheControl: 'x',
      },
      new AbortController().signal,
    );

    expect(await sync()).toMatchObject({
      state: 'failed',
      failure: 'another-library',
      message: 'That bucket belongs to another FilmFile library.',
    });
    expect(bucket.streamed).toEqual([]);
  });

  test.each([
    ['keys-refused', 'Cloudflare refused the keys in the [filmfile] profile.'],
    [
      'no-credentials',
      "No [filmfile] profile in ~/.aws/credentials, so the site can't be published.",
    ],
    ['unreachable', "Couldn't reach Cloudflare. Are you online?"],
    ['other', "Couldn't sync."],
  ] as const)('says what to fix when %s', async (reason, message) => {
    const { bucket, ready, sync } = setUp();
    await ready();
    bucket.failWith(reason);

    expect(await sync()).toMatchObject({
      state: 'failed',
      failure: reason,
      message,
    });
  });

  test('a sync that fails part-way leaves the record as it was, and the next sends only what is missing', async () => {
    const { bucket, ready, sync, fileInBucket } = setUp();
    await ready();
    await putInLibrary('a.json', 'a');
    await sync();
    const names = ['b', 'c', 'd', 'e', 'f', 'g'];
    for (const name of names) {
      await putInLibrary(`${name}.json`, name);
    }
    failTheThirdUpload(bucket);

    const failed = await sync();

    expect(failed).toMatchObject({ state: 'failed', failure: 'unreachable' });
    // Some really were sent before it failed.
    expect(failed.filesDone).toBeGreaterThan(0);
    expect(
      parseSyncRecord((await fileInBucket('filmfile/sync.json')) ?? '')?.sync,
    ).toBe(1);
    const sentBefore = names.length - failed.filesDone;
    bucket.streamed.length = 0;
    const again = await sync();
    expect(again).toMatchObject({ state: 'done', filesTotal: sentBefore });
    expect(bucket.streamed.length).toBe(sentBefore);
    expect(
      parseSyncRecord((await fileInBucket('filmfile/sync.json')) ?? '')?.sync,
    ).toBe(2);
    // The manifest has every file, whether sent now or found in the bucket.
    expect(
      parseManifest((await fileInBucket('filmfile/manifest.json')) ?? '')?.map(
        (file) => file.path,
      ),
    ).toEqual([
      'Library/a.json',
      ...names.map((name) => `Library/${name}.json`),
      'settings.json',
    ]);
  });

  test('a first sync cancelled part-way carries on where it stopped', async () => {
    const { bucket, ready, sync, request } = setUp();
    await ready();
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    for (const name of names) {
      await putInLibrary(`${name}.json`, name);
    }
    const putStream = bucket.putStream.bind(bucket);
    let arrived = 0;
    bucket.putStream = async (to, file, signal) => {
      const put = await putStream(to, file, signal);
      arrived += 1;
      if (arrived === 2) {
        await request('/api/sync', { method: 'DELETE' });
      }
      return put;
    };

    const cancelled = await sync();

    expect(cancelled.state).toBe('cancelled');
    expect(cancelled.filesDone).toBeGreaterThan(0);
    bucket.putStream = putStream;
    bucket.streamed.length = 0;
    const again = await sync();
    // The ten files and settings.json, less those already sent.
    expect(again.state).toBe('done');
    expect(bucket.streamed.length).toBe(11 - cancelled.filesDone);
  });

  test('a file changed after a sync that didn’t finish sent it is sent again', async () => {
    const { bucket, ready, sync, fileInBucket } = setUp();
    await ready();
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) {
      await putInLibrary(`${name}.json`, name);
    }
    failTheThirdUpload(bucket);
    await sync();
    const sentAlready = bucket.streamed.find(
      (key) => key !== bucket.streamed[2] && key.startsWith('Library/'),
    );
    if (sentAlready === undefined) {
      throw new Error('nothing was sent before the failure');
    }
    await putInLibrary(sentAlready.replace('Library/', ''), 'changed');
    bucket.streamed.length = 0;

    await sync();

    expect(bucket.streamed).toContain(sentAlready);
    expect(await fileInBucket(sentAlready)).toBe('changed');
  });

  test('lists the bucket only when there is something to send', async () => {
    const { bucket, ready, sync } = setUp();
    await ready();
    await putInLibrary('a.json', 'a');
    await sync();
    bucket.listed = 0;

    await sync();
    expect(bucket.listed).toBe(0);

    await putInLibrary('b.json', 'b');
    await sync();
    expect(bucket.listed).toBe(1);
  });
});

test('a record written by another sync meanwhile is never overwritten', async () => {
  const { bucket, ready, sync, post, untilDone, fileInBucket } = setUp();
  await ready();
  await putInLibrary('a.json', 'a');
  await sync();
  await putInLibrary('a.json', 'changed');
  let release: () => void = () => undefined;
  bucket.holding = new Promise<void>((resolve) => {
    release = resolve;
  });
  await post('/api/sync', {});
  for (let tries = 0; tries < 200 && bucket.streamed.length === 0; tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const record = (await fileInBucket('filmfile/sync.json')) ?? '';
  const theirs = record.replace('"sync": 1', '"sync": 9');
  await bucket.put(
    target,
    {
      key: 'filmfile/sync.json',
      bytes: new TextEncoder().encode(theirs),
      contentType: 'application/json',
      cacheControl: 'no-store',
    },
    new AbortController().signal,
  );

  release();
  const run = await untilDone();

  expect(run).toMatchObject({ state: 'failed', failure: 'other' });
  expect(
    parseSyncRecord((await fileInBucket('filmfile/sync.json')) ?? '')?.sync,
  ).toBe(9);
});

describe('DELETE /api/sync', () => {
  test('cuts off the files going and starts no more, reading "stopping" until it has stopped, and leaves the record as it was', async () => {
    const { bucket, request, post, ready, status, untilDone, fileInBucket } =
      setUp();
    await ready();
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      await putInLibrary(`${name}.json`, name);
    }
    // Each upload runs until it's cut off, then takes a moment to stop.
    let release: () => void = () => undefined;
    const stopped = new Promise<void>((resolve) => {
      release = resolve;
    });
    const going: AbortSignal[] = [];
    bucket.putStream = (_to, _file, signal) => {
      going.push(signal);
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          void stopped.then(() => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      });
    };
    await post('/api/sync', {});
    for (let tries = 0; tries < 200 && going.length < 4; tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const cancelled = await request('/api/sync', { method: 'DELETE' });

    expect(cancelled.status).toBe(204);
    expect((await status()).run?.state).toBe('stopping');
    expect(going.every((signal) => signal.aborted)).toBe(true);
    release();
    const run = await untilDone();
    expect(run).toMatchObject({ state: 'cancelled', filesDone: 0 });
    expect(going.length).toBe(4);
    expect(await fileInBucket('Library/a.json')).toBeUndefined();
    // The claim was made, but no sync was recorded as finished.
    expect(
      parseSyncRecord((await fileInBucket('filmfile/sync.json')) ?? '')?.sync,
    ).toBe(0);
    expect(await fileInBucket('filmfile/manifest.json')).toBeUndefined();
  });

  test('asking to cancel again while it stops is no failure, and starting one follows the one stopping', async () => {
    const { bucket, request, post, ready, untilDone } = setUp();
    await ready();
    await putInLibrary('a.json', 'a');
    let release: () => void = () => undefined;
    const stopped = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started: string[] = [];
    bucket.putStream = (_to, file, signal) => {
      started.push(file.key);
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          void stopped.then(() => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      });
    };
    await post('/api/sync', {});
    for (let tries = 0; tries < 200 && started.length === 0; tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await request('/api/sync', { method: 'DELETE' });

    const again = await request('/api/sync', { method: 'DELETE' });
    const start = await post('/api/sync', {});

    expect(again.status).toBe(204);
    expect(start.status).toBe(202);
    expect(await start.json()).toMatchObject({ state: 'stopping' });
    release();
    expect((await untilDone()).state).toBe('cancelled');
  });

  test('is refused when no sync is running', async () => {
    const { request } = setUp();

    expect((await request('/api/sync', { method: 'DELETE' })).status).toBe(422);
  });
});

/** Asks until the answer passes, for up to 30 seconds. */
async function eventually<T>(
  ask: () => Promise<T>,
  passes: (got: T) => boolean,
) {
  for (let tries = 0; tries < 3000; tries += 1) {
    const got = await ask();
    if (passes(got)) {
      return got;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('it never passed');
}

describe('how far the first sync has got (FF-241)', () => {
  test('a first sync says what it checks, then counts the whole library as it uploads', async () => {
    const { bucket, ready, post, status, untilDone } = setUp();
    await ready();
    await putInLibrary('a.json', 'aa');
    await putInLibrary('b.json', 'bbb');
    let releaseList: () => void = () => undefined;
    let releaseUploads: () => void = () => undefined;
    const listHeld = new Promise<void>((resolve) => {
      releaseList = resolve;
    });
    // The first listing is the claim's, of the empty bucket; the second
    // looks for what's already there, and waits.
    const list = bucket.list.bind(bucket);
    bucket.list = async (to, signal) => {
      const listed = await list(to, signal);
      if (bucket.listed === 2) {
        await listHeld;
      }
      return listed;
    };
    bucket.holding = new Promise<void>((resolve) => {
      releaseUploads = resolve;
    });
    await post('/api/sync', {});

    const checkingBucket = await eventually(
      status,
      (now) => now.run?.phase === 'checking-bucket' && bucket.listed > 0,
    );
    releaseList();
    const uploading = await eventually(
      status,
      (now) => now.run?.phase === 'uploading',
    );
    releaseUploads();
    const done = await untilDone();

    expect(checkingBucket.run).toMatchObject({ first: true });
    const settingsSize = (
      await readFile(path.join(archive.folder(), 'settings.json'))
    ).length;
    expect(uploading.run).toMatchObject({
      first: true,
      filesChecked: 3,
      filesToCheck: 3,
      library: {
        bytes: 5 + settingsSize,
        files: 3,
        bytesBackedUp: 0,
        filesBackedUp: 0,
      },
      // A fixed clock times nothing.
      secondsLeft: null,
    });
    expect(done).toMatchObject({
      state: 'done',
      library: {
        bytes: 5 + settingsSize,
        files: 3,
        bytesBackedUp: 5 + settingsSize,
        filesBackedUp: 3,
      },
    });
  });

  test('a later sync counts only its own upload', async () => {
    const { ready, sync } = setUp();
    await ready();
    await putInLibrary('a.json', 'a');
    await sync();
    await putInLibrary('b.json', 'b');

    expect(await sync()).toMatchObject({
      first: false,
      library: null,
      filesTotal: 1,
    });
  });

  test('a first sync carrying on counts what the bucket already has', async () => {
    const { bucket, ready, sync } = setUp();
    await ready();
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) {
      await putInLibrary(`${name}.json`, name);
    }
    failTheThirdUpload(bucket);
    const failed = await sync();
    bucket.putStream = WatchedBucket.prototype.putStream.bind(bucket);

    const again = await sync();

    expect(again).toMatchObject({
      first: true,
      library: { files: 7, filesBackedUp: 7 },
      filesTotal: 7 - failed.filesDone,
    });
  });

  test('between runs, a first sync that stopped says how far it got, from its own count', async () => {
    const { bucket, ready, sync, request, status } = setUp();
    await ready();
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      await putInLibrary(`${name}.json`, name);
    }
    const putStream = bucket.putStream.bind(bucket);
    let arrived = 0;
    bucket.putStream = async (to, file, signal) => {
      const put = await putStream(to, file, signal);
      arrived += 1;
      if (arrived === 2) {
        await request('/api/sync', { method: 'DELETE' });
      }
      return put;
    };
    const cancelled = await sync();
    const listedBefore = bucket.listed;

    const now = await status();

    expect(now.firstSync).toEqual(cancelled.library);
    expect(now.firstSync?.filesBackedUp).toBe(cancelled.filesDone);
    expect(bucket.listed).toBe(listedBefore);
  });

  test('when the service starts again, it works out how far the first sync got from the bucket, by path and size', async () => {
    const { bucket, ready, sync, restarted } = setUp();
    await ready();
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) {
      await putInLibrary(`${name}.json`, name);
    }
    failTheThirdUpload(bucket);
    const failed = await sync();
    const status = restarted();

    expect((await status()).firstSync).toBeNull();
    const answered = await eventually(status, (now) => now.firstSync !== null);

    expect(answered.firstSync).toEqual({
      ...failed.library,
      filesBackedUp: failed.filesDone,
      bytesBackedUp: failed.bytesDone,
    });
  });

  test('says nothing between runs when the bucket can’t be reached, is empty, or a sync has finished', async () => {
    const unreachable = setUp();
    await unreachable.ready();
    await putInLibrary('a.json', 'a');
    failTheThirdUpload(unreachable.bucket);
    unreachable.bucket.failWith('unreachable');
    const offline = unreachable.restarted();
    await offline();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await offline()).firstSync).toBeNull();

    const empty = setUp();
    await empty.ready();
    const fresh = empty.restarted();
    await fresh();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect((await fresh()).firstSync).toBeNull();

    const finished = setUp();
    await finished.ready();
    await finished.sync();
    const listed = finished.bucket.listed;
    expect((await finished.status()).firstSync).toBeNull();
    expect((await finished.restarted()()).firstSync).toBeNull();
    expect(finished.bucket.listed).toBe(listed);
  });
});
