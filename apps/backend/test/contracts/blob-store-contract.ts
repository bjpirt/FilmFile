import { describe, expect, test } from 'vitest';
import type { BlobStore } from '../../src/application/ports/blob-store.ts';
import { isRollNumber } from '../../src/domain/rolls/roll-number.ts';
import { isFrameId, isVersionId } from '../../src/domain/shared/ids.ts';
import { checked } from '../support/checked.ts';
import { ctx } from '../support/builders.ts';

const roll = checked('2026-014', isRollNumber);
const blob = {
  roll,
  frameId: checked('01JC8Z7K3M00000000S9WDVXNP', isFrameId),
  versionId: checked('01JC8Z7K3M000000009PMYF63D', isVersionId),
  fileName: '12340014.jpg',
};

/** What every BlobStore must do, run against each adapter. */
export function blobStoreContract(
  name: string,
  makeStore: () => BlobStore,
): void {
  describe(`${name} meets the BlobStore contract`, () => {
    test('gives back exactly what it stored, by the path it returned', async () => {
      const blobs = makeStore();

      const file = await blobs.put(ctx, blob, new Uint8Array([1, 2, 3]));

      expect(file).toMatch(/12340014\.jpg$/);
      expect(new Uint8Array(await blobs.get(ctx, roll, file))).toEqual(
        new Uint8Array([1, 2, 3]),
      );
    });

    test('never overwrites a stored file', async () => {
      const blobs = makeStore();
      const file = await blobs.put(ctx, blob, new Uint8Array([1, 2, 3]));

      await expect(blobs.put(ctx, blob, new Uint8Array([4]))).rejects.toThrow();
      expect(new Uint8Array(await blobs.get(ctx, roll, file))).toEqual(
        new Uint8Array([1, 2, 3]),
      );
    });

    test('fails to get a file it never stored', async () => {
      await expect(
        makeStore().get(ctx, roll, 'frames/AAAAAAAA/BBBBBBBB/missing.jpg'),
      ).rejects.toThrow();
    });
  });
}
