import { describe, expect, test } from 'vitest';
import { InMemoryEquipmentRepository } from '../../../src/adapters/outbound/memory/in-memory-equipment-repository.ts';
import { InMemoryEventRepository } from '../../../src/adapters/outbound/memory/in-memory-event-repository.ts';
import { FixedClock } from '../../../src/adapters/outbound/memory/fixed-clock.ts';
import { InMemoryHoldingArea } from '../../../src/adapters/outbound/memory/in-memory-holding-area.ts';
import { InMemoryRollRepository } from '../../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { SequentialIdGenerator } from '../../../src/adapters/outbound/memory/sequential-id-generator.ts';
import { CreateCamera } from '../../../src/application/use-cases/equipment/create-camera.ts';
import { CreateFilmStock } from '../../../src/application/use-cases/equipment/create-film-stock.ts';
import { CreateLens } from '../../../src/application/use-cases/equipment/create-lens.ts';
import { CreateEvent } from '../../../src/application/use-cases/events/create-event.ts';
import type { HoldingArea } from '../../../src/application/ports/holding-area.ts';
import { DeleteRoll } from '../../../src/application/use-cases/rolls/delete-roll.ts';
import { CreateRoll } from '../../../src/application/use-cases/rolls/create-roll.ts';
import { GetRoll } from '../../../src/application/use-cases/rolls/get-roll.ts';
import { ListRolls } from '../../../src/application/use-cases/rolls/list-rolls.ts';
import { UpdateRoll } from '../../../src/application/use-cases/rolls/update-roll.ts';
import type { ArchiveContext } from '../../../src/domain/shared/archive-context.ts';
import { isArchiveId, isRollId } from '../../../src/domain/shared/ids.ts';

function anArchive(): ArchiveContext {
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
  const holding: HoldingArea = new InMemoryHoldingArea();
  return {
    holding,
    deleteRoll: new DeleteRoll(
      rolls,
      holding,
      new FixedClock('2026-11-02T12:00:00.000Z'),
    ),
    ctx: anArchive(),
    createCamera: new CreateCamera(equipment),
    createFilmStock: new CreateFilmStock(equipment),
    createLens: new CreateLens(equipment),
    createRoll: new CreateRoll(rolls, equipment, events, ids),
    createEvent: new CreateEvent(events),
    listRolls: new ListRolls(rolls),
    getRoll: new GetRoll(rolls),
    updateRoll: new UpdateRoll(rolls, equipment, events),
  };
}

describe('CreateRoll', () => {
  test('creates an empty roll with a new ID', async () => {
    const { ctx, createRoll } = setUp();

    expect(await createRoll.execute(ctx, { roll: '2026-014' })).toEqual({
      ok: true,
      value: {
        id: '00000000000000000000000001',
        roll: '2026-014',
        name: null,
        description: null,
        shot: null,
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
      description: '   ',
      shot: '2026-09',
    });

    expect(created).toMatchObject({
      ok: true,
      value: { name: 'Iceland', description: null, shot: '2026-09' },
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

  test('refuses a roll number already in use', async () => {
    const { ctx, createRoll } = setUp();
    await createRoll.execute(ctx, { roll: '2026-014' });

    expect(await createRoll.execute(ctx, { roll: '2026-014' })).toEqual({
      ok: false,
      error: { kind: 'already-exists', entity: 'roll', id: '2026-014' },
    });
  });

  test('refuses something that is not a roll number', async () => {
    const { ctx, createRoll, listRolls } = setUp();

    const created = await createRoll.execute(ctx, { roll: '26-14' });

    expect(created).toMatchObject({
      ok: false,
      error: { kind: 'validation-failed' },
    });
    expect(await listRolls.execute(ctx)).toEqual({ rolls: [], unreadable: [] });
  });
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
      description: ' Jökulsárlón at dawn. ',
      shot: '2026-09-14',
    });

    expect(updated).toEqual(await getRoll.execute(ctx, { id }));
    expect(updated).toMatchObject({
      ok: true,
      value: {
        roll: {
          name: 'Iceland',
          description: 'Jökulsárlón at dawn.',
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
