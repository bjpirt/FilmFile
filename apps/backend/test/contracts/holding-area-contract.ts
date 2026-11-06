import { describe, expect, test } from 'vitest';
import type { HoldingArea } from '../../src/application/ports/holding-area.ts';
import type { Roll } from '../../src/domain/rolls/roll.ts';
import { aFrame, aRoll, aVersion, ctx, ulidFor } from '../support/builders.ts';

/** What every HoldingArea must do, run against each adapter. */
export function holdingAreaContract(
  name: string,
  makeHoldingArea: () => HoldingArea,
  /** Puts a roll in the archive, as the roll repository would, so it can be held. */
  createRoll: (roll: Roll) => Promise<void> = () => Promise.resolve(),
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

    test('holds a deleted version with the frame and roll it came from and when', async () => {
      const holding = makeHoldingArea();
      const version = aVersion({
        id: ulidFor(8),
        file: 'frames/unnumbered-00000002/scan-00000008/edit.png',
      });
      const frame = aFrame({ versions: [aVersion(), version] });
      const roll = aRoll({ frames: [frame] });
      await createRoll(roll);
      const at = new Date('2026-11-02T12:00:00.000Z');

      await holding.holdVersion(ctx, {
        rollId: roll.id,
        roll: roll.roll,
        frameId: frame.id,
        version,
        at,
      });

      expect(await holding.list(ctx)).toEqual([
        {
          kind: 'version',
          rollId: roll.id,
          roll: roll.roll,
          frameId: frame.id,
          version,
          at,
        },
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

      expect(
        (await holding.list(ctx)).map((held) =>
          held.kind === 'frame' ? held.frame.id : held.rollId,
        ),
      ).toEqual([ulidFor(6), ulidFor(5)]);
    });

    test('holds a deleted roll, with when it was deleted, among the frames by age', async () => {
      const holding = makeHoldingArea();
      const roll = aRoll({ frames: [aFrame()] });
      await createRoll(roll);
      await holding.holdFrame(ctx, {
        rollId: roll.id,
        roll: roll.roll,
        frame: aFrame({ id: ulidFor(7) }),
        at: new Date('2026-11-03T09:00:00.000Z'),
      });

      await holding.holdRoll(ctx, {
        rollId: roll.id,
        roll: roll.roll,
        at: new Date('2026-11-02T09:00:00.000Z'),
      });

      expect((await holding.list(ctx)).map((held) => held.kind)).toEqual([
        'roll',
        'frame',
      ]);
      expect((await holding.list(ctx))[0]).toEqual({
        kind: 'roll',
        rollId: roll.id,
        roll: roll.roll,
        at: new Date('2026-11-02T09:00:00.000Z'),
      });
    });
  });
}
