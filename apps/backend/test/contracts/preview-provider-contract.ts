import { describe, expect, test } from 'vitest';
import type { PreviewProvider } from '../../src/application/ports/preview-provider.ts';
import { aJpeg } from '../support/a-jpeg.ts';

/** What every PreviewProvider must do, run against each adapter. */
export function previewProviderContract(
  name: string,
  makeProvider: () => PreviewProvider,
): void {
  describe(`${name} meets the PreviewProvider contract`, () => {
    async function counting() {
      const original = new Uint8Array(await aJpeg({ width: 600, height: 400 }));
      let loads = 0;
      return {
        load: () => {
          loads += 1;
          return Promise.resolve(original);
        },
        loads: () => loads,
      };
    }

    test('makes a thumbnail once, then gives back the same one without loading the original', async () => {
      const previews = makeProvider();
      const original = await counting();

      const first = await previews.thumbnail('abc', 'small', original.load);
      const second = await previews.thumbnail('abc', 'small', original.load);

      expect(first.length).toBeGreaterThan(0);
      expect(second).toEqual(first);
      expect(original.loads()).toBe(1);
    });

    test('makes a separate thumbnail for each size', async () => {
      const previews = makeProvider();
      const original = await counting();

      await previews.thumbnail('abc', 'small', original.load);
      await previews.thumbnail('abc', 'large', original.load);

      expect(original.loads()).toBe(2);
    });
  });
}
