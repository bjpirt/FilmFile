import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import { FilesystemBlobStore } from '../../../src/adapters/outbound/filesystem/filesystem-blob-store.ts';
import { FilesystemRollRepository } from '../../../src/adapters/outbound/filesystem/filesystem-roll-repository.ts';
import { findRollFolder } from '../../../src/adapters/outbound/filesystem/roll-folder.ts';
import { isFrameId, isVersionId } from '../../../src/domain/shared/ids.ts';
import { ok } from '../../../src/domain/shared/result.ts';
import { aRoll, ctx } from '../../support/builders.ts';
import { checked } from '../../support/checked.ts';
import { useTempArchive } from '../../support/temp-archive.ts';

// The roll repository and the blob store write into the same folder, so
// adding a version while a roll is renumbered must lose neither (D66). Both
// take the roll's turn, as the use cases do, in `change`.

const archive = useTempArchive();

test('a file added while the roll’s number changes ends up in the roll’s renamed folder', async () => {
  const rolls = new FilesystemRollRepository(archive.path());
  const blobs = new FilesystemBlobStore(archive.path());
  const roll = aRoll();
  await rolls.create(ctx, roll);
  const blob = {
    rollId: roll.id,
    frameId: checked('01JC8Z7K3M00000000S9WDVXNP', isFrameId),
    versionId: checked('01JC8Z7K3M000000009PMYF63D', isVersionId),
    fileName: '12340014.jpg',
  };
  let file = '';

  await Promise.all([
    rolls.change(ctx, roll.id, async (read) => {
      file = await blobs.put(ctx, blob, new Uint8Array([1, 2, 3]));
      return ok({ roll: read, value: file });
    }),
    rolls.change(ctx, roll.id, (read) =>
      Promise.resolve(
        ok({
          roll: { ...read, roll: aRoll({ roll: '2026-020' }).roll },
          value: 'renamed',
        }),
      ),
    ),
  ]);

  const folder = await findRollFolder(archive.path(), roll.id);
  expect(folder === undefined ? '' : path.basename(folder)).toBe(
    '2026-020-00000001',
  );
  expect(await readFile(path.join(folder ?? '', file))).toEqual(
    Buffer.from([1, 2, 3]),
  );
  expect(new Uint8Array(await blobs.get(ctx, roll.id, file))).toEqual(
    new Uint8Array([1, 2, 3]),
  );
});
