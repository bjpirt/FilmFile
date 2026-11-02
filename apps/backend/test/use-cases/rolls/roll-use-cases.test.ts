import { describe, expect, test } from 'vitest';
import { InMemoryRollRepository } from '../../../src/adapters/outbound/memory/in-memory-roll-repository.ts';
import { SequentialIdGenerator } from '../../../src/adapters/outbound/memory/sequential-id-generator.ts';
import { CreateRoll } from '../../../src/application/use-cases/rolls/create-roll.ts';
import { GetRoll } from '../../../src/application/use-cases/rolls/get-roll.ts';
import { ListRolls } from '../../../src/application/use-cases/rolls/list-rolls.ts';
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
  const ids = new SequentialIdGenerator();
  return {
    ctx: anArchive(),
    createRoll: new CreateRoll(rolls, ids),
    listRolls: new ListRolls(rolls),
    getRoll: new GetRoll(rolls),
  };
}

describe('CreateRoll', () => {
  test('creates an empty roll with a new ID', async () => {
    const { ctx, createRoll } = setUp();

    expect(await createRoll.execute(ctx, { roll: '2026-014' })).toEqual({
      ok: true,
      value: { id: '00000000000000000000000001', roll: '2026-014', frames: [] },
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
    expect(await listRolls.execute(ctx)).toEqual([]);
  });
});

describe('ListRolls', () => {
  test('lists rolls in roll number order', async () => {
    const { ctx, createRoll, listRolls } = setUp();
    for (const roll of ['2026-014', '2025-003', '2026-002']) {
      await createRoll.execute(ctx, { roll });
    }

    const listed = await listRolls.execute(ctx);

    expect(listed.map((r) => r.roll)).toEqual([
      '2025-003',
      '2026-002',
      '2026-014',
    ]);
  });
});

describe('GetRoll', () => {
  test('gets a roll by its ID', async () => {
    const { ctx, createRoll, getRoll } = setUp();
    const created = await createRoll.execute(ctx, { roll: '2026-014' });
    if (!created.ok) {
      throw new Error('setup failed');
    }

    expect(await getRoll.execute(ctx, { id: created.value.id })).toEqual(
      created,
    );
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
