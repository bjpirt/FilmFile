import { describe, expect, test } from 'vitest';
import type { HoldingArea } from '../../src/application/ports/holding-area.ts';
import { aFrame, aRoll, aVersion, ctx, ulidFor } from '../support/builders.ts';

/** What every HoldingArea must do, run against each adapter. */
export function holdingAreaContract(
  name: string,
  makeHoldingArea: () => HoldingArea,
): void {
  describe(`${name} meets the HoldingArea contract`, () => {
    test('holds nothing to begin with', async () => {
      expect(await makeHoldingArea().list(ctx)).toEqual([]);
    });

    test('holds a deleted frame with the roll it came from and when', async () => {
      const holding = makeHoldingArea();
      const roll = aRoll();
      const frame = aFrame({ number: '12', versions: [aVersion()] });
      const at = new Date('2026-11-02T12:00:00.000Z');

      await holding.holdFrame(ctx, {
        rollId: roll.id,
        roll: roll.roll,
        frame,
        at,
      });

      expect(await holding.list(ctx)).toEqual([
        { kind: 'frame', rollId: roll.id, roll: roll.roll, frame, at },
      ]);
    });

    test('lists what it holds oldest first', async () => {
      const holding = makeHoldingArea();
      const roll = aRoll();
      for (const [id, at] of [
        [ulidFor(5), '2026-11-03T09:00:00.000Z'],
        [ulidFor(6), '2026-11-02T09:00:00.000Z'],
      ] as const) {
        await holding.holdFrame(ctx, {
          rollId: roll.id,
          roll: roll.roll,
          frame: aFrame({ id }),
          at: new Date(at),
        });
      }

      expect((await holding.list(ctx)).map((held) => held.frame.id)).toEqual([
        ulidFor(6),
        ulidFor(5),
      ]);
    });
  });
}
