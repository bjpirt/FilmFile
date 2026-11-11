import { describe, expect, test } from 'vitest';
import type { ImageRenderer } from '../../src/application/ports/image-renderer.ts';
import { aJpeg } from '../support/a-jpeg.ts';

/** What every ImageRenderer must do, run against each adapter. */
export function imageRendererContract(
  name: string,
  makeRenderer: () => ImageRenderer,
): void {
  describe(`${name} meets the ImageRenderer contract`, () => {
    const recipe = { longestEdge: 2048, quality: 90 };

    test('makes an image', async () => {
      const original = new Uint8Array(await aJpeg({ width: 600, height: 400 }));

      const made = await makeRenderer().render(original, 0, recipe, {});

      expect(made.length).toBeGreaterThan(0);
    });

    test.each([
      ['a turn', 90, recipe, {}],
      ['a smaller size', 0, { ...recipe, longestEdge: 300 }, {}],
      ['a lower quality', 0, { ...recipe, quality: 40 }, {}],
      ['a credit', 0, recipe, { author: 'Ben Pirt', copyright: '© Ben' }],
    ] as const)(
      'makes a different image with %s',
      async (_what, turn, other, credit) => {
        const renderer = makeRenderer();
        const original = new Uint8Array(
          await aJpeg({ width: 600, height: 400 }),
        );

        const plain = await renderer.render(original, 0, recipe, {});
        const changed = await renderer.render(original, turn, other, credit);

        expect(Buffer.from(changed).equals(Buffer.from(plain))).toBe(false);
      },
    );
  });
}
