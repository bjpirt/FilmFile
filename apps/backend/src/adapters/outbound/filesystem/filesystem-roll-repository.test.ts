import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { RollRepository } from '../../../application/ports/roll-repository.ts';
import type { Frame, Roll } from '../../../domain/rolls/roll.ts';
import { err, ok } from '../../../domain/shared/result.ts';
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

function aFrame(id: string): Frame {
  return { id: checked(id, isFrameId), number: null, versions: [] };
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

    const read = await rolls.get(ctx, roll.id);

    const saved = await rolls.save(ctx, withFrame, read?.version ?? '');

    expect(saved.ok).toBe(true);
    expect(await rolls.get(ctx, roll.id)).toEqual({
      roll: withFrame,
      version: saved.ok && saved.value,
    });
  });

  test('versions a roll by the SHA-256 of its file', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll('2026-014'));
    const bytes = await readFile(
      path.join(archivePath, 'rolls/2026/2026-014/roll.json'),
    );

    expect((await rolls.get(ctx, aRoll('2026-014').id))?.version).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
  });

  test('refuses a save when the roll changed since it was read', async () => {
    const rolls = repository();
    const roll = aRoll('2026-014');
    await rolls.create(ctx, roll);
    const read = await rolls.get(ctx, roll.id);
    const first = { ...roll, frames: [aFrame('00000000000000000000000002')] };
    await rolls.save(ctx, first, read?.version ?? '');

    const second = await rolls.save(ctx, roll, read?.version ?? '');

    expect(second).toEqual({
      ok: false,
      error: { kind: 'concurrency-conflict', entity: 'roll', id: roll.id },
    });
    expect((await rolls.get(ctx, roll.id))?.roll).toEqual(first);
  });

  test('lets only one of two saves from the same read through', async () => {
    const rolls = repository();
    const roll = aRoll('2026-014');
    await rolls.create(ctx, roll);
    const read = await rolls.get(ctx, roll.id);

    const results = await Promise.all(
      ['00000000000000000000000002', '00000000000000000000000003'].map(
        (frameId) =>
          rolls.save(
            ctx,
            { ...roll, frames: [aFrame(frameId)] },
            read?.version ?? '',
          ),
      ),
    );

    expect(results.map((r) => r.ok).sort()).toEqual([false, true]);
  });

  test('applies changes made at the same time one after another, so none is lost', async () => {
    const rolls = repository();
    const roll = aRoll('2026-014');
    await rolls.create(ctx, roll);
    const frameIds = Array.from(
      { length: 20 },
      (_, i) => `000000000000000000000001${String(i).padStart(2, '0')}`,
    );

    await Promise.all(
      frameIds.map((frameId) =>
        rolls.change(ctx, roll.id, (current) =>
          Promise.resolve(
            ok({
              roll: {
                ...current,
                frames: [...current.frames, aFrame(frameId)],
              },
              value: frameId,
            }),
          ),
        ),
      ),
    );

    const frames = (await rolls.get(ctx, roll.id))?.roll.frames ?? [];
    expect(frames.map((f) => f.id).sort()).toEqual(frameIds);
  });

  test('saves nothing when a change fails', async () => {
    const rolls = repository();
    const roll = aRoll('2026-014');
    await rolls.create(ctx, roll);
    const before = await rolls.get(ctx, roll.id);

    const changed = await rolls.change(ctx, roll.id, () =>
      Promise.resolve(err('no thanks')),
    );

    expect(changed).toEqual({ ok: false, error: 'no thanks' });
    expect(await rolls.get(ctx, roll.id)).toEqual(before);
  });

  test('is unaffected by a half-written file a crash left behind', async () => {
    const rolls = repository();
    const roll = aRoll('2026-014');
    await rolls.create(ctx, roll);
    const before = await rolls.get(ctx, roll.id);
    // A write goes to a temporary file first, renamed over roll.json once complete.
    await writeFile(
      path.join(archivePath, 'rolls/2026/2026-014/roll.json.0b7c.tmp'),
      '{ "schema": 1, "id": "0',
    );

    expect(await rolls.get(ctx, roll.id)).toEqual(before);
    expect((await rolls.list(ctx)).unreadable).toEqual([]);
    expect((await rolls.save(ctx, roll, before?.version ?? '')).ok).toBe(true);
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

    expect(await rolls.save(ctx, aRoll('2026-014'), 'any')).toEqual({
      ok: false,
      error: {
        kind: 'not-found',
        entity: 'roll',
        id: '00000000000000000000000001',
      },
    });
  });
});
