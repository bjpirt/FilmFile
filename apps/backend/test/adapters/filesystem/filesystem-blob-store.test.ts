import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { BlobStore } from '../../../src/application/ports/blob-store.ts';
import { isRollNumber } from '../../../src/domain/rolls/roll-number.ts';
import {
  isArchiveId,
  isFrameId,
  isVersionId,
} from '../../../src/domain/shared/ids.ts';
import { checked } from '../../support/checked.ts';
import { FilesystemBlobStore } from '../../../src/adapters/outbound/filesystem/filesystem-blob-store.ts';

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
const roll = checked('2026-014', isRollNumber);
const blob = {
  roll,
  frameId: checked('01JC8Z7K3M00000000S9WDVXNP', isFrameId),
  versionId: checked('01JC8Z7K3M000000009PMYF63D', isVersionId),
  fileName: '12340014.jpg',
};

function store(): BlobStore {
  return new FilesystemBlobStore(archivePath);
}

test('stores a file in its version’s folder, inside its frame’s, under its original name', async () => {
  const file = await store().put(ctx, blob, new Uint8Array([1, 2, 3]));

  expect(file).toBe('frames/S9WDVXNP/9PMYF63D/12340014.jpg');
  expect(
    await readFile(path.join(archivePath, 'rolls/2026/2026-014', file)),
  ).toEqual(Buffer.from([1, 2, 3]));
});

test('refuses to read a path that leads out of the roll', async () => {
  await expect(store().get(ctx, roll, '../../../secret.txt')).rejects.toThrow(
    'unsafe path',
  );
});
