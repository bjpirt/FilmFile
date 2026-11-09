import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  utimes,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { FilesystemBlobStore } from '../../../src/adapters/outbound/filesystem/filesystem-blob-store.ts';
import { FilesystemRollRepository } from '../../../src/adapters/outbound/filesystem/filesystem-roll-repository.ts';
import type {
  BlobStore,
  NewBlob,
} from '../../../src/application/ports/blob-store.ts';
import { isFrameNumber } from '../../../src/domain/rolls/frame-number.ts';
import {
  isArchiveId,
  isFrameId,
  isVersionId,
} from '../../../src/domain/shared/ids.ts';
import { aRoll } from '../../support/builders.ts';
import { checked } from '../../support/checked.ts';

// What only the filesystem adapter does; what every adapter does is in
// test/contracts/blob-store-contract.ts.

let archivePath = '';

beforeEach(async () => {
  archivePath = await mkdtemp(path.join(tmpdir(), 'filmfile-archive-'));
});

afterEach(async () => {
  await rm(archivePath, { recursive: true, force: true });
});

const ctx = { archiveId: checked('00000000000000000000000000', isArchiveId) };
const roll = aRoll();
const blob: NewBlob = {
  rollId: roll.id,
  frameId: checked('01JC8Z7K3M00000000S9WDVXNP', isFrameId),
  frameNumber: checked('14-15', isFrameNumber),
  versionId: checked('01JC8Z7K3M000000009PMYF63D', isVersionId),
  kind: 'raw-scan',
  fileName: '12340014.jpg',
};

function store(): BlobStore {
  return new FilesystemBlobStore(archivePath);
}

test('stores a file in its version’s folder, inside its frame’s, inside its roll’s, under its original name', async () => {
  await new FilesystemRollRepository(archivePath).create(ctx, roll);

  const file = await store().put(ctx, blob, new Uint8Array([1, 2, 3]));

  expect(file).toBe('frames/14-15-S9WDVXNP/raw-scan-9PMYF63D/12340014.jpg');
  expect(
    await readFile(
      path.join(archivePath, 'rolls/2026/2026-014-00000001', file),
    ),
  ).toEqual(Buffer.from([1, 2, 3]));
});

test('refuses to read a path that leads out of the roll', async () => {
  await new FilesystemRollRepository(archivePath).create(ctx, roll);

  await expect(
    store().get(ctx, roll.id, '../../../secret.txt'),
  ).rejects.toThrow('unsafe path');
});

test('has nowhere to put or find a file of a roll that has no folder', async () => {
  await expect(store().put(ctx, blob, new Uint8Array([1]))).rejects.toThrow(
    'has no folder',
  );
  await expect(store().get(ctx, roll.id, 'frames/a/b/c.jpg')).rejects.toThrow(
    'has no folder',
  );
});

test('stores a file in a roll’s folder named by number alone, as made before D66', async () => {
  const folder = path.join(archivePath, 'rolls/2026/2026-014');
  await mkdir(folder, { recursive: true });
  const rollJson = new FilesystemRollRepository(archivePath);
  await rollJson.create(ctx, roll);
  await rename(path.join(archivePath, 'rolls/2026/2026-014-00000001'), folder);

  const file = await store().put(ctx, blob, new Uint8Array([7]));

  expect(await readFile(path.join(folder, file))).toEqual(Buffer.from([7]));
  expect(new Uint8Array(await store().get(ctx, roll.id, file))).toEqual(
    new Uint8Array([7]),
  );
});

test('makes a file it stores read-only, keeping its other permissions (D96)', async () => {
  await new FilesystemRollRepository(archivePath).create(ctx, roll);

  const file = await store().put(ctx, blob, new Uint8Array([1, 2, 3]));

  const { mode } = await stat(
    path.join(archivePath, 'rolls/2026/2026-014-00000001', file),
  );
  expect(mode & 0o222).toBe(0);
  expect(mode & 0o444).toBe(0o444);
});

test('refuses to store over a file even though it is read-only', async () => {
  await new FilesystemRollRepository(archivePath).create(ctx, roll);
  await store().put(ctx, blob, new Uint8Array([1]));

  await expect(store().put(ctx, blob, new Uint8Array([2]))).rejects.toThrow();
});

test('makes a writable file read-only after the fact, clearing only the write bits, and leaves its contents and times alone', async () => {
  await new FilesystemRollRepository(archivePath).create(ctx, roll);
  const file = await store().put(ctx, blob, new Uint8Array([1, 2, 3]));
  const stored = path.join(archivePath, 'rolls/2026/2026-014-00000001', file);
  await chmod(stored, 0o755);
  const when = new Date('2020-01-02T03:04:05Z');
  await utimes(stored, when, when);

  expect(await store().makeReadOnly(ctx, roll.id, file)).toBe('changed');
  expect(await store().makeReadOnly(ctx, roll.id, file)).toBe('already');

  const after = await stat(stored);
  expect(after.mode & 0o777).toBe(0o555);
  expect(after.mtime).toEqual(when);
  expect(await readFile(stored)).toEqual(Buffer.from([1, 2, 3]));
});

test('keeps a stricter mode as it was, only taking away the write bits', async () => {
  await new FilesystemRollRepository(archivePath).create(ctx, roll);
  const file = await store().put(ctx, blob, new Uint8Array([1]));
  const stored = path.join(archivePath, 'rolls/2026/2026-014-00000001', file);
  await chmod(stored, 0o600);

  await store().makeReadOnly(ctx, roll.id, file);

  expect((await stat(stored)).mode & 0o777).toBe(0o400);
});

test('says there is no file for one that is missing, or for a roll that has no folder', async () => {
  expect(await store().makeReadOnly(ctx, roll.id, 'frames/a/b/c.jpg')).toBe(
    'missing',
  );
  await new FilesystemRollRepository(archivePath).create(ctx, roll);
  expect(await store().makeReadOnly(ctx, roll.id, 'frames/a/b/c.jpg')).toBe(
    'missing',
  );
  expect(await store().makeReadOnly(ctx, roll.id, '../../../secret.txt')).toBe(
    'missing',
  );
});
