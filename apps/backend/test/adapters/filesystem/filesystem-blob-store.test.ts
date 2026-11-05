import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { BlobStore } from '../../../src/application/ports/blob-store.ts';
import {
  isArchiveId,
  isFrameId,
  isVersionId,
} from '../../../src/domain/shared/ids.ts';
import { checked } from '../../support/checked.ts';
import { FilesystemBlobStore } from '../../../src/adapters/outbound/filesystem/filesystem-blob-store.ts';
import { FilesystemRollRepository } from '../../../src/adapters/outbound/filesystem/filesystem-roll-repository.ts';
import { aRoll } from '../../support/builders.ts';

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
const blob = {
  rollId: roll.id,
  frameId: checked('01JC8Z7K3M00000000S9WDVXNP', isFrameId),
  versionId: checked('01JC8Z7K3M000000009PMYF63D', isVersionId),
  fileName: '12340014.jpg',
};

function store(): BlobStore {
  return new FilesystemBlobStore(archivePath);
}

test('stores a file in its version’s folder, inside its frame’s, inside its roll’s, under its original name', async () => {
  await new FilesystemRollRepository(archivePath).create(ctx, roll);

  const file = await store().put(ctx, blob, new Uint8Array([1, 2, 3]));

  expect(file).toBe('frames/S9WDVXNP/9PMYF63D/12340014.jpg');
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
