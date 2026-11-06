import { describe, expect, test } from 'vitest';
import type { BlobStore } from '../../src/application/ports/blob-store.ts';
import { isFrameNumber } from '../../src/domain/rolls/frame-number.ts';
import type { Roll } from '../../src/domain/rolls/roll.ts';
import { isFrameId, isVersionId } from '../../src/domain/shared/ids.ts';
import { aRoll, ctx } from '../support/builders.ts';
import { checked } from '../support/checked.ts';

const roll = aRoll();
const blob = {
  rollId: roll.id,
  frameId: checked('01JC8Z7K3M00000000S9WDVXNP', isFrameId),
  frameNumber: checked('14', isFrameNumber),
  versionId: checked('01JC8Z7K3M000000009PMYF63D', isVersionId),
  kind: 'scan' as const,
  fileName: '12340014.jpg',
};

/** What every BlobStore must do, run against each adapter. */
export function blobStoreContract(
  name: string,
  makeStore: () => BlobStore,
  /** Puts the roll in the archive, as the roll repository would, so files can be stored for it. */
  createRoll: (roll: Roll) => Promise<void> = () => Promise.resolve(),
): void {
  describe(`${name} meets the BlobStore contract`, () => {
    test('gives back exactly what it stored, by the path it returned', async () => {
      const blobs = makeStore();
      await createRoll(roll);

      const file = await blobs.put(ctx, blob, new Uint8Array([1, 2, 3]));

      expect(file).toMatch(/12340014\.jpg$/);
      expect(new Uint8Array(await blobs.get(ctx, roll.id, file))).toEqual(
        new Uint8Array([1, 2, 3]),
      );
    });

    test('never overwrites a stored file', async () => {
      const blobs = makeStore();
      await createRoll(roll);
      const file = await blobs.put(ctx, blob, new Uint8Array([1, 2, 3]));

      await expect(blobs.put(ctx, blob, new Uint8Array([4]))).rejects.toThrow();
      expect(new Uint8Array(await blobs.get(ctx, roll.id, file))).toEqual(
        new Uint8Array([1, 2, 3]),
      );
    });

    test('fails to get a file it never stored', async () => {
      await createRoll(roll);

      await expect(
        makeStore().get(ctx, roll.id, 'frames/AAAAAAAA/BBBBBBBB/missing.jpg'),
      ).rejects.toThrow();
    });
  });
}
