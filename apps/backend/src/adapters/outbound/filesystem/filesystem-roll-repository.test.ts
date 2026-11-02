import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { RollRepository } from '../../../application/ports/roll-repository.ts';
import type { Roll } from '../../../domain/rolls/roll.ts';
import { isRollNumber } from '../../../domain/rolls/roll-number.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import {
  isArchiveId,
  isFrameId,
  isRollId,
  isVersionId,
} from '../../../domain/shared/ids.ts';
import { FilesystemRollRepository } from './filesystem-roll-repository.ts';

let archivePath = '';

function repository(): RollRepository {
  return new FilesystemRollRepository(archivePath);
}

beforeEach(async () => {
  archivePath = await mkdtemp(path.join(tmpdir(), 'filmfile-archive-'));
});

afterEach(async () => {
  await rm(archivePath, { recursive: true, force: true });
});

function checked<T extends string>(
  value: string,
  is: (value: string) => value is T,
): T {
  if (!is(value)) {
    throw new Error(`bad test data: ${value}`);
  }
  return value;
}

const ctx: ArchiveContext = {
  archiveId: checked('00000000000000000000000000', isArchiveId),
};

function aRoll(roll: string, id = '00000000000000000000000001'): Roll {
  return {
    id: checked(id, isRollId),
    roll: checked(roll, isRollNumber),
    frames: [],
  };
}

const aVersion = {
  id: checked('00000000000000000000000003', isVersionId),
  file: 'frames/00000002/00000003/12340014.jpg',
  sha256: 'a'.repeat(64),
  bytes: 1234,
  width: 3,
  height: 2,
  added: new Date('2026-11-02T12:00:00.000Z'),
};

describe('FilesystemRollRepository', () => {
  test('creates roll.json in the roll year’s folder', async () => {
    const rolls = repository();

    expect(await rolls.create(ctx, aRoll('2026-014'))).toEqual({
      ok: true,
      value: undefined,
    });

    expect(
      await readFile(
        path.join(archivePath, 'rolls/2026/2026-014/roll.json'),
        'utf8',
      ),
    ).toBe(
      `${JSON.stringify(
        {
          schema: 1,
          id: '00000000000000000000000001',
          roll: '2026-014',
          frames: [],
        },
        null,
        2,
      )}\n`,
    );
  });

  test('refuses to create a roll whose roll number is taken', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll('2026-014'));

    expect(
      await rolls.create(ctx, aRoll('2026-014', '00000000000000000000000009')),
    ).toEqual({
      ok: false,
      error: { kind: 'already-exists', entity: 'roll', id: '2026-014' },
    });
  });

  test('gets back exactly what was saved, frames and versions included', async () => {
    const rolls = repository();
    const roll = aRoll('2026-014');
    await rolls.create(ctx, roll);
    const withFrame: Roll = {
      ...roll,
      frames: [
        {
          id: checked('00000000000000000000000002', isFrameId),
          number: '1',
          versions: [aVersion],
        },
      ],
    };

    expect(await rolls.save(ctx, withFrame)).toEqual({
      ok: true,
      value: undefined,
    });

    expect(await rolls.get(ctx, roll.id)).toEqual(withFrame);
  });

  test('lists rolls in roll number order', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll('2026-014', '00000000000000000000000001'));
    await rolls.create(ctx, aRoll('2025-003', '00000000000000000000000002'));

    expect((await rolls.list(ctx)).rolls.map((r) => r.roll)).toEqual([
      '2025-003',
      '2026-014',
    ]);
  });

  test('lists nothing in an empty archive', async () => {
    expect(await repository().list(ctx)).toEqual({ rolls: [], unreadable: [] });
  });

  test('reports a roll.json it cannot read, and still lists the rest', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll('2026-014'));
    const broken = path.join(archivePath, 'rolls/2026/2026-015');
    await mkdir(broken, { recursive: true });
    await writeFile(path.join(broken, 'roll.json'), '{ not json');

    const listed = await rolls.list(ctx);

    expect(listed.rolls.map((r) => r.roll)).toEqual(['2026-014']);
    expect(listed.unreadable).toEqual([
      { folder: '2026-015', problem: 'it is not valid JSON' },
    ]);
  });

  test('never creates a roll over one it cannot read', async () => {
    const rolls = repository();
    const broken = path.join(archivePath, 'rolls/2026/2026-014');
    await mkdir(broken, { recursive: true });
    await writeFile(path.join(broken, 'roll.json'), '{ not json');

    expect(await rolls.create(ctx, aRoll('2026-014'))).toMatchObject({
      ok: false,
      error: { kind: 'already-exists' },
    });
    expect(await readFile(path.join(broken, 'roll.json'), 'utf8')).toBe(
      '{ not json',
    );
  });

  test('gets nothing for an ID that no roll has', async () => {
    const rolls = repository();

    expect(
      await rolls.get(ctx, checked('01JC8Z7K3M0000000000000000', isRollId)),
    ).toBeUndefined();
  });

  test('refuses to save a roll that was never created', async () => {
    const rolls = repository();

    expect(await rolls.save(ctx, aRoll('2026-014'))).toEqual({
      ok: false,
      error: {
        kind: 'not-found',
        entity: 'roll',
        id: '00000000000000000000000001',
      },
    });
  });
});
