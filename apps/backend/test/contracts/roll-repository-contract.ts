import { describe, expect, test } from 'vitest';
import type { RollRepository } from '../../src/application/ports/roll-repository.ts';
import type { Roll } from '../../src/domain/rolls/roll.ts';
import { isRollId } from '../../src/domain/shared/ids.ts';
import { err, ok } from '../../src/domain/shared/result.ts';
import { checked } from '../support/checked.ts';
import { aFrame, aRoll, aVersion, ctx, ulidFor } from '../support/builders.ts';

/** What every RollRepository must do, run against each adapter. */
export function rollRepositoryContract(
  name: string,
  makeRepository: () => RollRepository,
  /** Takes a removed roll's files away, as the holding area would. */
  takeAway: (roll: Roll) => Promise<void> = () => Promise.resolve(),
): void {
  describe(`${name} meets the RollRepository contract`, () => {
    test('gets back exactly what was created', async () => {
      const rolls = makeRepository();
      const roll = aRoll();

      expect(await rolls.create(ctx, roll)).toEqual(ok(undefined));
      expect((await rolls.get(ctx, roll.id))?.roll).toEqual(roll);
    });

    test('refuses to create a roll whose roll number is taken', async () => {
      const rolls = makeRepository();
      await rolls.create(ctx, aRoll());

      expect(await rolls.create(ctx, aRoll({ id: ulidFor(9) }))).toEqual(
        err({ kind: 'already-exists', entity: 'roll', id: '2026-014' }),
      );
    });

    test('lists rolls in roll number order', async () => {
      const rolls = makeRepository();
      await rolls.create(ctx, aRoll());
      await rolls.create(ctx, aRoll({ roll: '2025-003', id: ulidFor(2) }));

      expect((await rolls.list(ctx)).rolls.map((r) => r.roll)).toEqual([
        '2025-003',
        '2026-014',
      ]);
    });

    test('lists nothing when there are no rolls', async () => {
      expect(await makeRepository().list(ctx)).toEqual({
        rolls: [],
        unreadable: [],
      });
    });

    test('gets nothing for an ID that no roll has', async () => {
      expect(
        await makeRepository().get(
          ctx,
          checked('01JC8Z7K3M0000000000000000', isRollId),
        ),
      ).toBeUndefined();
    });

    test('saves a roll read with the current version, and gives the new version', async () => {
      const rolls = makeRepository();
      const roll = aRoll();
      await rolls.create(ctx, roll);
      const read = await rolls.get(ctx, roll.id);
      const changed = {
        ...roll,
        frames: [aFrame({ versions: [aVersion()] })],
      };

      const saved = await rolls.save(ctx, changed, read?.version ?? '');

      expect(saved.ok && saved.value).not.toBe(read?.version);
      expect(await rolls.get(ctx, roll.id)).toEqual({
        roll: changed,
        version: saved.ok && saved.value,
      });
    });

    test('changes a roll’s number with saveRenumbered, giving the new version', async () => {
      const rolls = makeRepository();
      const roll = aRoll();
      await rolls.create(ctx, roll);
      const read = await rolls.get(ctx, roll.id);
      const renumbered = { ...roll, roll: aRoll({ roll: '2026-009' }).roll };

      const saved = await rolls.saveRenumbered(
        ctx,
        renumbered,
        read?.version ?? '',
      );

      expect(saved.ok && saved.value).not.toBe(read?.version);
      expect(await rolls.get(ctx, roll.id)).toEqual({
        roll: renumbered,
        version: saved.ok && saved.value,
      });
      expect((await rolls.list(ctx)).rolls.map((r) => r.roll)).toEqual([
        '2026-009',
      ]);
    });

    test('refuses to renumber a roll to a number another roll has, changing nothing', async () => {
      const rolls = makeRepository();
      const first = aRoll();
      const second = aRoll({ id: ulidFor(2), roll: '2026-015' });
      await rolls.create(ctx, first);
      await rolls.create(ctx, second);
      const read = await rolls.get(ctx, first.id);

      const saved = await rolls.saveRenumbered(
        ctx,
        { ...first, roll: second.roll },
        read?.version ?? '',
      );

      expect(saved).toEqual(
        err({ kind: 'already-exists', entity: 'roll', id: '2026-015' }),
      );
      expect(await rolls.get(ctx, first.id)).toEqual(read);
    });

    test('lets saveRenumbered keep a roll’s own number, as any other save does', async () => {
      const rolls = makeRepository();
      const roll = aRoll();
      await rolls.create(ctx, roll);
      const read = await rolls.get(ctx, roll.id);

      const saved = await rolls.saveRenumbered(
        ctx,
        { ...roll, name: 'Westfjords' },
        read?.version ?? '',
      );

      expect(saved.ok).toBe(true);
      expect((await rolls.get(ctx, roll.id))?.roll.name).toBe('Westfjords');
    });

    test('refuses saveRenumbered when the roll changed since it was read', async () => {
      const rolls = makeRepository();
      const roll = aRoll();
      await rolls.create(ctx, roll);

      expect(
        await rolls.saveRenumbered(
          ctx,
          { ...roll, roll: aRoll({ roll: '2026-009' }).roll },
          'stale',
        ),
      ).toEqual(
        err({ kind: 'concurrency-conflict', entity: 'roll', id: roll.id }),
      );
      expect((await rolls.get(ctx, roll.id))?.roll.roll).toBe('2026-014');
    });

    test('says when saveRenumbered is given a roll that was never created', async () => {
      const roll = aRoll();

      expect(await makeRepository().saveRenumbered(ctx, roll, 'any')).toEqual(
        err({ kind: 'not-found', entity: 'roll', id: roll.id }),
      );
    });

    test('never lets two renumberings from different rolls take the same number', async () => {
      const rolls = makeRepository();
      const first = aRoll();
      const second = aRoll({ id: ulidFor(2), roll: '2026-015' });
      await rolls.create(ctx, first);
      await rolls.create(ctx, second);
      const firstRead = await rolls.get(ctx, first.id);
      const secondRead = await rolls.get(ctx, second.id);
      const wanted = aRoll({ roll: '2026-020' }).roll;

      const results = await Promise.all([
        rolls.saveRenumbered(
          ctx,
          { ...first, roll: wanted },
          firstRead?.version ?? '',
        ),
        rolls.saveRenumbered(
          ctx,
          { ...second, roll: wanted },
          secondRead?.version ?? '',
        ),
      ]);

      expect(results.map((r) => r.ok).sort()).toEqual([false, true]);
      expect(
        (await rolls.list(ctx)).rolls.filter((r) => r.roll === wanted),
      ).toHaveLength(1);
    });

    test('refuses a plain save that would change a roll’s number: only saveRenumbered does that', async () => {
      const rolls = makeRepository();
      const roll = aRoll();
      await rolls.create(ctx, roll);
      const read = await rolls.get(ctx, roll.id);

      await expect(
        rolls.save(
          ctx,
          { ...roll, roll: aRoll({ roll: '2026-009' }).roll },
          read?.version ?? '',
        ),
      ).rejects.toThrow('saveRenumbered');
      expect((await rolls.get(ctx, roll.id))?.roll.roll).toBe('2026-014');
    });

    test('refuses a save when the roll changed since it was read', async () => {
      const rolls = makeRepository();
      const roll = aRoll();
      await rolls.create(ctx, roll);
      const read = await rolls.get(ctx, roll.id);
      const first = { ...roll, frames: [aFrame()] };
      await rolls.save(ctx, first, read?.version ?? '');

      expect(await rolls.save(ctx, roll, read?.version ?? '')).toEqual(
        err({ kind: 'concurrency-conflict', entity: 'roll', id: roll.id }),
      );
      expect((await rolls.get(ctx, roll.id))?.roll).toEqual(first);
    });

    test('lets only one of two saves from the same read through', async () => {
      const rolls = makeRepository();
      const roll = aRoll();
      await rolls.create(ctx, roll);
      const read = await rolls.get(ctx, roll.id);

      const results = await Promise.all(
        ['00000000000000000000000002', '00000000000000000000000003'].map(
          (frameId) =>
            rolls.save(
              ctx,
              { ...roll, frames: [aFrame({ id: frameId })] },
              read?.version ?? '',
            ),
        ),
      );

      expect(results.map((r) => r.ok).sort()).toEqual([false, true]);
    });

    test('refuses to save a roll that was never created', async () => {
      const roll = aRoll();

      expect(await makeRepository().save(ctx, roll, 'any')).toEqual(
        err({ kind: 'not-found', entity: 'roll', id: roll.id }),
      );
    });

    test('applies changes made at the same time one after another, so none is lost', async () => {
      const rolls = makeRepository();
      const roll = aRoll();
      await rolls.create(ctx, roll);
      const frameIds = Array.from(
        { length: 20 },
        (_, i) => `000000000000000000000001${String(i).padStart(2, '0')}`,
      );

      const results = await Promise.all(
        frameIds.map((frameId) =>
          rolls.change(ctx, roll.id, (current) =>
            Promise.resolve(
              ok({
                roll: {
                  ...current,
                  frames: [...current.frames, aFrame({ id: frameId })],
                },
                value: frameId,
              }),
            ),
          ),
        ),
      );

      expect(results).toEqual(frameIds.map((frameId) => ok(frameId)));
      const frames = (await rolls.get(ctx, roll.id))?.roll.frames ?? [];
      expect(frames.map((f) => f.id).sort()).toEqual(frameIds);
    });

    test('saves nothing when a change fails', async () => {
      const rolls = makeRepository();
      const roll = aRoll();
      await rolls.create(ctx, roll);
      const before = await rolls.get(ctx, roll.id);

      expect(
        await rolls.change(ctx, roll.id, () =>
          Promise.resolve(err('no thanks')),
        ),
      ).toEqual(err('no thanks'));
      expect(await rolls.get(ctx, roll.id)).toEqual(before);
    });

    test('says when a roll to change does not exist', async () => {
      const id = checked('01JC8Z7K3M0000000000000000', isRollId);

      expect(
        await makeRepository().change(ctx, id, (roll) =>
          Promise.resolve(ok({ roll, value: undefined })),
        ),
      ).toEqual(err({ kind: 'not-found', entity: 'roll', id }));
    });

    test('removes a roll read at the current version, handing it over', async () => {
      const rolls = makeRepository();
      const roll = aRoll({ frames: [aFrame()] });
      await rolls.create(ctx, roll);
      const read = await rolls.get(ctx, roll.id);
      const handedOver: Roll[] = [];

      const removed = await rolls.remove(
        ctx,
        roll.id,
        read?.version ?? '',
        async (gone) => {
          handedOver.push(gone);
          await takeAway(gone);
        },
      );

      expect(removed).toEqual(ok(undefined));
      expect(handedOver).toEqual([roll]);
      expect(await rolls.get(ctx, roll.id)).toBeUndefined();
      expect((await rolls.list(ctx)).rolls).toEqual([]);
    });

    test('refuses to remove a roll changed since it was read, handing nothing over', async () => {
      const rolls = makeRepository();
      const roll = aRoll();
      await rolls.create(ctx, roll);
      const read = await rolls.get(ctx, roll.id);
      await rolls.save(
        ctx,
        { ...roll, frames: [aFrame()] },
        read?.version ?? '',
      );
      const handedOver: Roll[] = [];

      expect(
        await rolls.remove(ctx, roll.id, read?.version ?? '', (gone) => {
          handedOver.push(gone);
          return takeAway(gone);
        }),
      ).toEqual(
        err({ kind: 'concurrency-conflict', entity: 'roll', id: roll.id }),
      );
      expect(handedOver).toEqual([]);
      expect(await rolls.get(ctx, roll.id)).toBeDefined();
    });

    test('says when a roll to remove does not exist', async () => {
      const id = checked('01JC8Z7K3M0000000000000000', isRollId);

      expect(
        await makeRepository().remove(ctx, id, 'any', () => Promise.resolve()),
      ).toEqual(err({ kind: 'not-found', entity: 'roll', id }));
    });
  });
}
