import { describe, expect, test } from 'vitest';
import { FixedClock } from '../../../src/adapters/outbound/memory/fixed-clock.ts';
import { InMemoryEquipmentRepository } from '../../../src/adapters/outbound/memory/in-memory-equipment-repository.ts';
import { InMemoryEventRepository } from '../../../src/adapters/outbound/memory/in-memory-event-repository.ts';
import { InMemoryHoldingArea } from '../../../src/adapters/outbound/memory/in-memory-holding-area.ts';
import { InMemorySettingsRepository } from '../../../src/adapters/outbound/memory/in-memory-settings-repository.ts';
import { InMemoryRollRepository } from '../../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { SequentialIdGenerator } from '../../../src/adapters/outbound/memory/sequential-id-generator.ts';
import type { HoldingArea } from '../../../src/application/ports/holding-area.ts';
import { CreateCamera } from '../../../src/application/use-cases/equipment/create-camera.ts';
import { CreateFilmStock } from '../../../src/application/use-cases/equipment/create-film-stock.ts';
import { CreateLens } from '../../../src/application/use-cases/equipment/create-lens.ts';
import { CreateEvent } from '../../../src/application/use-cases/events/create-event.ts';
import { CreateRoll } from '../../../src/application/use-cases/rolls/create-roll.ts';
import { DeleteRoll } from '../../../src/application/use-cases/rolls/delete-roll.ts';
import { GetRoll } from '../../../src/application/use-cases/rolls/get-roll.ts';
import { ListRolls } from '../../../src/application/use-cases/rolls/list-rolls.ts';
import { UpdateRoll } from '../../../src/application/use-cases/rolls/update-roll.ts';
import { aSettings as aSettingsBy } from '../../support/builders.ts';
import type { ArchiveContext } from '../../../src/domain/shared/archive-context.ts';
import { isArchiveId, isRollId } from '../../../src/domain/shared/ids.ts';

function aSettings(): ArchiveContext {
  const archiveId = '00000000000000000000000000';
  if (!isArchiveId(archiveId)) {
    throw new Error('not a ULID');
  }
  return { archiveId };
}

function setUp() {
  const rolls = new InMemoryRollRepository();
  const equipment = new InMemoryEquipmentRepository();
  const events = new InMemoryEventRepository();
  const ids = new SequentialIdGenerator();
  const settings = new InMemorySettingsRepository();
  const holding: HoldingArea = new InMemoryHoldingArea();
  const createRollWithoutDefaults = new CreateRoll(
    rolls,
    equipment,
    events,
    ids,
    settings,
  );
  const createRoll = {
    execute(ctx: ArchiveContext, input: Parameters<CreateRoll['execute']>[1]) {
      return createRollWithoutDefaults.execute(ctx, {
        shot: '2026',
        ...input,
      });
    },
  };
  return {
    holding,
    settings,
    deleteRoll: new DeleteRoll(
      rolls,
      holding,
      new FixedClock('2026-11-02T12:00:00.000Z'),
    ),
    ctx: aSettings(),
    createCamera: new CreateCamera(equipment),
    createFilmStock: new CreateFilmStock(equipment),
    createLens: new CreateLens(equipment),
    createRoll,
    createRollWithoutDefaults,
    createEvent: new CreateEvent(events),
    listRolls: new ListRolls(rolls),
    getRoll: new GetRoll(rolls),
    updateRoll: new UpdateRoll(rolls, equipment, events, settings),
  };
}

async function usingPattern(
  settings: InMemorySettingsRepository,
  ctx: ArchiveContext,
  rollNumberPattern: string,
) {
  await settings.create(ctx, aSettingsBy('Ben', { rollNumberPattern }));
}

describe('CreateRoll', () => {
  describe('with a roll number pattern that needs more of the roll (D88)', () => {
    test('refuses a shot date without the month, and a roll without an event', async () => {
      const { ctx, settings, createRollWithoutDefaults } = setUp();
      await usingPattern(settings, ctx, '{event}-{year}{month}-{n:3}');

      expect(
        await createRollWithoutDefaults.execute(ctx, {
          roll: 'A',
          shot: '2026',
        }),
      ).toMatchObject({
        ok: false,
        error: { issues: [{ path: ['shot'] }] },
      });
      expect(
        await createRollWithoutDefaults.execute(ctx, {
          roll: 'A',
          shot: '2026-09',
        }),
      ).toMatchObject({
        ok: false,
        error: { issues: [{ path: ['event'] }] },
      });
    });

    test('creates a roll that has what it needs', async () => {
      const { ctx, settings, createEvent, createRollWithoutDefaults } = setUp();
      await usingPattern(settings, ctx, '{event}-{year}{month}-{n:3}');
      await createEvent.execute(ctx, { name: 'Iceland' });

      expect(
        await createRollWithoutDefaults.execute(ctx, {
          roll: 'A',
          shot: '2026-09',
          event: 'iceland',
        }),
      ).toMatchObject({ ok: true });
    });
  });

  test('creates an empty roll with a new ID', async () => {
    const { ctx, createRoll } = setUp();

    expect(await createRoll.execute(ctx, { roll: '2026-014' })).toEqual({
      ok: true,
      value: {
        id: '00000000000000000000000001',
        roll: '2026-014',
        filed: false,
        name: null,
        notes: null,
        shot: '2026',
        event: null,
        camera: null,
        film: null,
        lens: null,
        frames: [],
      },
    });
  });

  test('records the camera the roll was shot on', async () => {
    const { ctx, createCamera, createRoll } = setUp();
    await createCamera.execute(ctx, { make: 'Nikon', model: 'FE' });

    expect(
      await createRoll.execute(ctx, { roll: '2026-014', camera: 'nikon-fe' }),
    ).toMatchObject({ ok: true, value: { camera: 'nikon-fe' } });
  });

  test('records the film stock the roll is', async () => {
    const { ctx, createFilmStock, createRoll } = setUp();
    await createFilmStock.execute(ctx, { make: 'Kodak', name: 'Portra 400' });

    expect(
      await createRoll.execute(ctx, {
        roll: '2026-014',
        film: 'kodak-portra-400',
      }),
    ).toMatchObject({ ok: true, value: { film: 'kodak-portra-400' } });
  });

  test('records the event the roll was shot at', async () => {
    const { ctx, createEvent, createRoll } = setUp();
    await createEvent.execute(ctx, { name: 'Iceland 2026' });

    expect(
      await createRoll.execute(ctx, {
        roll: '2026-014',
        event: 'iceland-2026',
      }),
    ).toMatchObject({ ok: true, value: { event: 'iceland-2026' } });
  });

  test('refuses an event the archive does not have', async () => {
    const { ctx, createRoll } = setUp();

    expect(
      await createRoll.execute(ctx, {
        roll: '2026-014',
        event: 'iceland-2026',
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: [
          { path: ['event'], message: 'is not an event in the archive' },
        ],
      },
    });
  });

  test('records the lens the roll was shot with', async () => {
    const { ctx, createLens, createRoll } = setUp();
    await createLens.execute(ctx, { make: 'Zeiss', name: 'Planar' });

    expect(
      await createRoll.execute(ctx, { roll: '2026-014', lens: 'zeiss-planar' }),
    ).toMatchObject({ ok: true, value: { lens: 'zeiss-planar' } });
  });

  test('refuses a lens the archive does not have', async () => {
    const { ctx, createRoll } = setUp();

    expect(
      await createRoll.execute(ctx, { roll: '2026-014', lens: 'zeiss-planar' }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: [{ path: ['lens'], message: 'is not a lens in the archive' }],
      },
    });
  });

  test('refuses a film stock the archive does not have', async () => {
    const { ctx, createRoll } = setUp();

    expect(
      await createRoll.execute(ctx, {
        roll: '2026-014',
        film: 'kodak-portra-400',
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: [
          { path: ['film'], message: 'is not a film stock in the archive' },
        ],
      },
    });
  });

  test('refuses a camera the archive does not have', async () => {
    const { ctx, createRoll } = setUp();

    expect(
      await createRoll.execute(ctx, { roll: '2026-014', camera: 'nikon-fe' }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: [
          { path: ['camera'], message: 'is not a camera in the archive' },
        ],
      },
    });
  });

  test('keeps the details given, trimmed, and leaves out blank ones', async () => {
    const { ctx, createRoll } = setUp();

    const created = await createRoll.execute(ctx, {
      roll: '2026-014',
      name: ' Iceland ',
      notes: '   ',
      shot: '2026-09',
    });

    expect(created).toMatchObject({
      ok: true,
      value: { name: 'Iceland', notes: null, shot: '2026-09' },
    });
  });

  test('refuses a date shot that is not a real date', async () => {
    const { ctx, createRoll } = setUp();

    expect(
      await createRoll.execute(ctx, { roll: '2026-014', shot: '2026-02-30' }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['shot'] }] },
    });
  });

  describe('with no roll number', () => {
    test('gives the next free number of the year shot', async () => {
      const { ctx, createRoll } = setUp();
      await createRoll.execute(ctx, { roll: '2025-031' });
      await createRoll.execute(ctx, { roll: '2025-032' });

      expect(await createRoll.execute(ctx, { shot: '2025-06' })).toMatchObject({
        ok: true,
        value: { roll: '2025-033', shot: '2025-06' },
      });
    });

    test('refuses to create a roll without a shot year', async () => {
      const { ctx, createRollWithoutDefaults } = setUp();

      expect(await createRollWithoutDefaults.execute(ctx, {})).toMatchObject({
        ok: false,
        error: {
          kind: 'validation-failed',
          issues: [{ path: ['shot'] }],
        },
      });
    });

    test('starts a year at 001', async () => {
      const { ctx, createRoll } = setUp();

      expect(await createRoll.execute(ctx, { shot: '2019' })).toMatchObject({
        ok: true,
        value: { roll: '2019-001' },
      });
    });

    test('gives different numbers to rolls created at once', async () => {
      const { ctx, createRoll, listRolls } = setUp();

      const created = await Promise.all(
        Array.from({ length: 6 }, () =>
          createRoll.execute(ctx, { shot: '2026' }),
        ),
      );

      expect(created.every((r) => r.ok)).toBe(true);
      const listed = await listRolls.execute(ctx);
      expect(listed.rolls.map((r) => r.roll)).toEqual([
        '2026-001',
        '2026-002',
        '2026-003',
        '2026-004',
        '2026-005',
        '2026-006',
      ]);
    });

    test('has none to give once a year has 999, as a problem with the number', async () => {
      const { ctx, createRoll } = setUp();
      await createRoll.execute(ctx, { roll: '2026-999' });

      expect(await createRoll.execute(ctx, { shot: '2026' })).toEqual({
        ok: false,
        error: {
          kind: 'validation-failed',
          issues: [
            { path: ['roll'], message: 'no roll numbers are left for 2026' },
          ],
        },
      });
    });

    test('still refuses a date shot that is not a real date', async () => {
      const { ctx, createRoll } = setUp();

      expect(
        await createRoll.execute(ctx, { shot: '2026-02-30' }),
      ).toMatchObject({
        ok: false,
        error: { kind: 'validation-failed', issues: [{ path: ['shot'] }] },
      });
    });
  });

  test('refuses a roll number already in use', async () => {
    const { ctx, createRoll } = setUp();
    await createRoll.execute(ctx, { roll: '2026-014' });

    expect(await createRoll.execute(ctx, { roll: '2026-014' })).toEqual({
      ok: false,
      error: { kind: 'already-exists', entity: 'roll', id: '2026-014' },
    });
  });

  test.each(['', 'x'.repeat(101)])(
    'refuses a roll label outside the length bounds: %j',
    async (roll) => {
      const { ctx, createRoll, listRolls } = setUp();

      const created = await createRoll.execute(ctx, { roll });

      expect(created).toMatchObject({
        ok: false,
        error: {
          kind: 'validation-failed',
          issues: [{ path: ['roll'], message: 'must be 1 to 100 characters' }],
        },
      });
      expect(await listRolls.execute(ctx)).toEqual({
        rolls: [],
        unreadable: [],
      });
    },
  );
});

describe('ListRolls', () => {
  test('lists rolls in roll number order', async () => {
    const { ctx, createRoll, listRolls } = setUp();
    for (const roll of ['2026-014', '2025-003', '2026-002']) {
      await createRoll.execute(ctx, { roll });
    }

    const listed = await listRolls.execute(ctx);

    expect(listed.rolls.map((r) => r.roll)).toEqual([
      '2025-003',
      '2026-002',
      '2026-014',
    ]);
  });
});

describe('GetRoll', () => {
  test('gets a roll by its ID, with its version token', async () => {
    const { ctx, createRoll, getRoll } = setUp();
    const created = await createRoll.execute(ctx, { roll: '2026-014' });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    expect(await getRoll.execute(ctx, { id: created.value.id })).toEqual({
      ok: true,
      value: { roll: created.value, version: '1' },
    });
  });

  test('says when no roll has the ID', async () => {
    const { ctx, getRoll } = setUp();
    const id = '01JC8Z7K3M0000000000000000';
    if (!isRollId(id)) {
      throw new Error('not a ULID');
    }

    expect(await getRoll.execute(ctx, { id })).toEqual({
      ok: false,
      error: { kind: 'not-found', entity: 'roll', id },
    });
  });
});

describe('UpdateRoll with a roll number pattern that needs more of the roll (D88)', () => {
  async function aRollUnder(pattern: string) {
    const setup = setUp();
    await usingPattern(setup.settings, setup.ctx, pattern);
    await setup.createEvent.execute(setup.ctx, { name: 'Iceland' });
    const created = await setup.createRollWithoutDefaults.execute(setup.ctx, {
      roll: 'A',
      shot: '2026-09',
      event: 'iceland',
    });
    const read = created.ok
      ? await setup.getRoll.execute(setup.ctx, { id: created.value.id })
      : undefined;
    if (!created.ok || !read?.ok) {
      throw new Error('setup failed');
    }
    return { ...setup, id: created.value.id, version: read.value.version };
  }

  test('refuses a shot date that loses the month, or clearing the event', async () => {
    const { ctx, id, version, updateRoll } = await aRollUnder(
      '{event}-{year}{month}-{n:3}',
    );

    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: version,
        shot: '2026',
      }),
    ).toMatchObject({ ok: false, error: { issues: [{ path: ['shot'] }] } });
    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: version,
        event: null,
      }),
    ).toMatchObject({ ok: false, error: { issues: [{ path: ['event'] }] } });
  });

  test('allows other edits, and a shot date that keeps the month', async () => {
    const { ctx, id, version, updateRoll } = await aRollUnder(
      '{event}-{year}{month}-{n:3}',
    );

    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: version,
        name: 'Day one',
        shot: '2026-10-02',
      }),
    ).toMatchObject({ ok: true });
  });
});

describe('UpdateRoll', () => {
  async function aCreatedRoll() {
    const setup = setUp();
    const created = await setup.createRoll.execute(setup.ctx, {
      roll: '2026-014',
      name: 'Iceland',
      shot: '2026',
    });
    const read = created.ok
      ? await setup.getRoll.execute(setup.ctx, { id: created.value.id })
      : undefined;
    if (!created.ok || !read?.ok) {
      throw new Error('setup failed');
    }
    return { ...setup, id: created.value.id, version: read.value.version };
  }

  test('changes the details given, leaving the rest, and gives the roll as saved', async () => {
    const { ctx, id, version, updateRoll, getRoll } = await aCreatedRoll();

    const updated = await updateRoll.execute(ctx, {
      id,
      expectedVersion: version,
      notes: ' Jökulsárlón at dawn. ',
      shot: '2026-09-14',
    });

    expect(updated).toEqual(await getRoll.execute(ctx, { id }));
    expect(updated).toMatchObject({
      ok: true,
      value: {
        roll: {
          name: 'Iceland',
          notes: 'Jökulsárlón at dawn.',
          shot: '2026-09-14',
        },
      },
    });
  });

  test('changes the camera, or clears it with null', async () => {
    const { ctx, id, version, updateRoll, createCamera } = await aCreatedRoll();
    await createCamera.execute(ctx, { make: 'Nikon', model: 'FE' });

    const changed = await updateRoll.execute(ctx, {
      id,
      expectedVersion: version,
      camera: 'nikon-fe',
    });
    const cleared = changed.ok
      ? await updateRoll.execute(ctx, {
          id,
          expectedVersion: changed.value.version,
          camera: null,
        })
      : changed;

    expect(changed).toMatchObject({
      ok: true,
      value: { roll: { camera: 'nikon-fe' } },
    });
    expect(cleared).toMatchObject({
      ok: true,
      value: { roll: { camera: null } },
    });
  });

  test('changes the film stock, or clears it with null', async () => {
    const { ctx, id, version, updateRoll, createFilmStock } =
      await aCreatedRoll();
    await createFilmStock.execute(ctx, { make: 'Kodak', name: 'Portra 400' });

    const changed = await updateRoll.execute(ctx, {
      id,
      expectedVersion: version,
      film: 'kodak-portra-400',
    });
    const cleared = changed.ok
      ? await updateRoll.execute(ctx, {
          id,
          expectedVersion: changed.value.version,
          film: null,
        })
      : changed;

    expect(changed).toMatchObject({
      ok: true,
      value: { roll: { film: 'kodak-portra-400' } },
    });
    expect(cleared).toMatchObject({
      ok: true,
      value: { roll: { film: null } },
    });
  });

  test('changes the event, or clears it with null', async () => {
    const { ctx, id, version, updateRoll, createEvent } = await aCreatedRoll();
    await createEvent.execute(ctx, { name: 'Westfjords' });

    const changed = await updateRoll.execute(ctx, {
      id,
      expectedVersion: version,
      event: 'westfjords',
    });
    const cleared = changed.ok
      ? await updateRoll.execute(ctx, {
          id,
          expectedVersion: changed.value.version,
          event: null,
        })
      : changed;

    expect(changed).toMatchObject({
      ok: true,
      value: { roll: { event: 'westfjords' } },
    });
    expect(cleared).toMatchObject({
      ok: true,
      value: { roll: { event: null } },
    });
  });

  test('refuses an event the archive does not have, changing nothing', async () => {
    const { ctx, id, version, updateRoll } = await aCreatedRoll();

    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: version,
        event: 'westfjords',
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['event'] }] },
    });
  });

  test('changes the lens, or clears it with null', async () => {
    const { ctx, id, version, updateRoll, createLens } = await aCreatedRoll();
    await createLens.execute(ctx, { make: 'Zeiss', name: 'Planar' });

    const changed = await updateRoll.execute(ctx, {
      id,
      expectedVersion: version,
      lens: 'zeiss-planar',
    });
    const cleared = changed.ok
      ? await updateRoll.execute(ctx, {
          id,
          expectedVersion: changed.value.version,
          lens: null,
        })
      : changed;

    expect(changed).toMatchObject({
      ok: true,
      value: { roll: { lens: 'zeiss-planar' } },
    });
    expect(cleared).toMatchObject({
      ok: true,
      value: { roll: { lens: null } },
    });
  });

  test('refuses a lens the archive does not have, changing nothing', async () => {
    const { ctx, id, version, updateRoll } = await aCreatedRoll();

    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: version,
        lens: 'zeiss-planar',
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['lens'] }] },
    });
  });

  test('refuses a film stock the archive does not have, changing nothing', async () => {
    const { ctx, id, version, updateRoll } = await aCreatedRoll();

    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: version,
        film: 'kodak-portra-400',
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['film'] }] },
    });
  });

  test('refuses a camera the archive does not have, changing nothing', async () => {
    const { ctx, id, version, updateRoll } = await aCreatedRoll();

    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: version,
        name: 'Westfjords',
        camera: 'nikon-fe',
      }),
    ).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed', issues: [{ path: ['camera'] }] },
    });
  });

  test('clears a detail set to null or left blank', async () => {
    const { ctx, id, version, updateRoll } = await aCreatedRoll();

    const updated = await updateRoll.execute(ctx, {
      id,
      expectedVersion: version,
      name: '  ',
      shot: null,
    });

    expect(updated).toMatchObject({
      ok: true,
      value: { roll: { name: null, shot: null } },
    });
  });

  test('refuses a date shot that is not a real date', async () => {
    const { ctx, id, version, updateRoll } = await aCreatedRoll();

    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: version,
        shot: '2026-02-30',
      }),
    ).toMatchObject({ ok: false, error: { kind: 'validation-failed' } });
  });

  test('changes the roll’s number, leaving the rest', async () => {
    const { ctx, id, version, updateRoll, getRoll } = await aCreatedRoll();

    const updated = await updateRoll.execute(ctx, {
      id,
      expectedVersion: version,
      roll: '2026-009',
    });

    expect(updated).toEqual(await getRoll.execute(ctx, { id }));
    expect(updated).toMatchObject({
      ok: true,
      value: { roll: { id, roll: '2026-009', name: 'Iceland' } },
    });
  });

  test.each(['', 'x'.repeat(101)])(
    'refuses an edited label outside the length bounds: %j',
    async (roll) => {
      const { ctx, id, version, updateRoll, getRoll } = await aCreatedRoll();

      expect(
        await updateRoll.execute(ctx, { id, expectedVersion: version, roll }),
      ).toEqual({
        ok: false,
        error: {
          kind: 'validation-failed',
          issues: [{ path: ['roll'], message: 'must be 1 to 100 characters' }],
        },
      });
      expect(await getRoll.execute(ctx, { id })).toMatchObject({
        ok: true,
        value: { roll: { roll: '2026-014' } },
      });
    },
  );

  test('refuses a roll number another roll has, as a problem with the number, changing nothing', async () => {
    const { ctx, id, version, updateRoll, getRoll, createRoll } =
      await aCreatedRoll();
    await createRoll.execute(ctx, { roll: '2026-015', shot: '2026' });

    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: version,
        roll: '2026-015',
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'validation-failed',
        issues: [
          { path: ['roll'], message: 'is already used by another roll' },
        ],
      },
    });
    expect(await getRoll.execute(ctx, { id })).toMatchObject({
      ok: true,
      value: { roll: { roll: '2026-014' } },
    });
  });

  test('takes the roll’s own number as no change', async () => {
    const { ctx, id, version, updateRoll } = await aCreatedRoll();

    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: version,
        roll: '2026-014',
        name: 'Westfjords',
      }),
    ).toMatchObject({
      ok: true,
      value: { roll: { roll: '2026-014', name: 'Westfjords' } },
    });
  });

  test('lets a number’s year differ from the year shot', async () => {
    const { ctx, id, version, updateRoll } = await aCreatedRoll();

    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: version,
        shot: '2025',
        roll: '2026-020',
      }),
    ).toMatchObject({
      ok: true,
      value: { roll: { roll: '2026-020', shot: '2025' } },
    });
  });

  test('refuses when the roll changed since it was read', async () => {
    const { ctx, id, updateRoll } = await aCreatedRoll();

    expect(
      await updateRoll.execute(ctx, {
        id,
        expectedVersion: 'stale',
        name: 'Westfjords',
      }),
    ).toMatchObject({ ok: false, error: { kind: 'concurrency-conflict' } });
  });

  test('says when no roll has the ID', async () => {
    const { ctx, updateRoll } = setUp();
    const id = '01JC8Z7K3M0000000000000000';
    if (!isRollId(id)) {
      throw new Error('not a ULID');
    }

    expect(
      await updateRoll.execute(ctx, { id, expectedVersion: '1', name: 'x' }),
    ).toEqual({ ok: false, error: { kind: 'not-found', entity: 'roll', id } });
  });
});

describe('DeleteRoll', () => {
  async function aRollRead() {
    const setup = setUp();
    const created = await setup.createRoll.execute(setup.ctx, {
      roll: '2026-014',
    });
    if (!created.ok) {
      throw new Error('setup failed');
    }
    const read = await setup.getRoll.execute(setup.ctx, {
      id: created.value.id,
    });
    return {
      ...setup,
      id: created.value.id,
      version: read.ok ? read.value.version : '',
    };
  }

  test('takes the roll out of the archive and holds it, with when', async () => {
    const { ctx, id, version, deleteRoll, getRoll, holding } =
      await aRollRead();

    expect(
      await deleteRoll.execute(ctx, { id, expectedVersion: version }),
    ).toEqual({ ok: true, value: undefined });
    expect(await getRoll.execute(ctx, { id })).toMatchObject({ ok: false });
    expect(await holding.list(ctx)).toEqual([
      {
        kind: 'roll',
        rollId: id,
        roll: '2026-014',
        at: new Date('2026-11-02T12:00:00.000Z'),
      },
    ]);
  });

  test('refuses when the roll changed since it was read, holding nothing', async () => {
    const { ctx, id, version, deleteRoll, updateRoll, holding } =
      await aRollRead();
    await updateRoll.execute(ctx, {
      id,
      expectedVersion: version,
      name: 'Westfjords',
    });

    expect(
      await deleteRoll.execute(ctx, { id, expectedVersion: version }),
    ).toMatchObject({ ok: false, error: { kind: 'concurrency-conflict' } });
    expect(await holding.list(ctx)).toEqual([]);
  });
});
