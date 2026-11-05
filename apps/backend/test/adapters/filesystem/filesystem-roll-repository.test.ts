import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { FilesystemRollRepository } from '../../../src/adapters/outbound/filesystem/filesystem-roll-repository.ts';
import type { RollRepository } from '../../../src/application/ports/roll-repository.ts';
import { ok } from '../../../src/domain/shared/result.ts';
import { findRollFolder } from '../../../src/adapters/outbound/filesystem/roll-folder.ts';
import { aRoll, ctx, ulidFor } from '../../support/builders.ts';
import { useTempArchive } from '../../support/temp-archive.ts';

// What only the filesystem adapter does; what every adapter does is in
// test/contracts/roll-repository-contract.ts.

const archive = useTempArchive();

function repository(): RollRepository {
  return new FilesystemRollRepository(archive.path());
}

/** A roll's folder as the service names it: its number and the end of its ID (D66). */
function rollFolder(roll: string, id = ulidFor(1)): string {
  return path.join(
    archive.path(),
    'rolls',
    roll.slice(0, 4),
    `${roll}-${id.slice(-8)}`,
  );
}

function rollFile(roll: string, id = ulidFor(1)): string {
  return path.join(rollFolder(roll, id), 'roll.json');
}

/** A roll's folder as it was named before D66: its number alone. */
function oldStyleFile(roll: string): string {
  return path.join(
    archive.path(),
    'rolls',
    roll.slice(0, 4),
    roll,
    'roll.json',
  );
}

async function names(folder: string): Promise<string[]> {
  return (await readdir(folder)).sort();
}

test('creates roll.json in a folder named by the roll’s number and the end of its ID, in its year’s folder', async () => {
  await repository().create(ctx, aRoll());

  expect(await readFile(rollFile('2026-014'), 'utf8')).toBe(
    `${JSON.stringify(
      {
        schema: 2,
        id: '00000000000000000000000001',
        roll: '2026-014',
        name: null,
        notes: null,
        shot: null,
        event: null,
        meta: {},
        frames: [],
      },
      null,
      2,
    )}\n`,
  );
});

test('versions a roll by the SHA-256 of its file', async () => {
  const rolls = repository();
  await rolls.create(ctx, aRoll());
  const bytes = await readFile(rollFile('2026-014'));

  expect((await rolls.get(ctx, aRoll().id))?.version).toBe(
    createHash('sha256').update(bytes).digest('hex'),
  );
});

test('is unaffected by a half-written file a crash left behind', async () => {
  const rolls = repository();
  const roll = aRoll();
  await rolls.create(ctx, roll);
  const before = await rolls.get(ctx, roll.id);
  // A write goes to a temporary file first, renamed over roll.json once complete.
  await writeFile(
    `${rollFile('2026-014')}.0b7c.tmp`,
    '{ "schema": 1, "id": "0',
  );

  expect(await rolls.get(ctx, roll.id)).toEqual(before);
  expect((await rolls.list(ctx)).unreadable).toEqual([]);
  expect((await rolls.save(ctx, roll, before?.version ?? '')).ok).toBe(true);
});

test('reports a roll.json it cannot read, and still lists the rest', async () => {
  const rolls = repository();
  await rolls.create(ctx, aRoll());
  await mkdir(path.dirname(oldStyleFile('2026-015')), { recursive: true });
  await writeFile(oldStyleFile('2026-015'), '{ not json');

  const listed = await rolls.list(ctx);

  expect(listed.rolls.map((r) => r.roll)).toEqual(['2026-014']);
  expect(listed.unreadable).toEqual([
    { folder: '2026-015', problem: 'it is not valid JSON' },
  ]);
});

test.each([
  ['named by its number alone', '2026-014'],
  ['named by its number and an ID', '2026-014-ABCD1234'],
])('never creates a roll over one it cannot read, %s', async (_, folder) => {
  const broken = path.join(archive.path(), 'rolls', '2026', folder);
  await mkdir(broken, { recursive: true });
  await writeFile(path.join(broken, 'roll.json'), '{ not json');

  expect(await repository().create(ctx, aRoll())).toMatchObject({
    ok: false,
    error: { kind: 'already-exists' },
  });
  expect(await readFile(path.join(broken, 'roll.json'), 'utf8')).toBe(
    '{ not json',
  );
});

test('names a roll’s folder by its number and the end of its ID', async () => {
  await repository().create(ctx, aRoll());

  expect(await names(path.join(archive.path(), 'rolls', '2026'))).toEqual([
    '2026-014-00000001',
  ]);
});

describe('finding a roll', () => {
  test('finds a roll in a folder named by its number alone, as made before D66', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll());
    await mkdir(path.dirname(oldStyleFile('2026-014')), { recursive: true });
    await rename(
      rollFolder('2026-014'),
      path.dirname(oldStyleFile('2026-014')),
    );

    expect((await rolls.get(ctx, aRoll().id))?.roll).toEqual(aRoll());
    expect((await rolls.list(ctx)).rolls).toEqual([aRoll()]);
  });

  test('finds a roll whatever its folder is called, as it is the roll.json that says whose it is', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll());
    await rename(
      rollFolder('2026-014'),
      path.join(archive.path(), 'rolls', '2026', 'put-here-by-hand'),
    );

    expect((await rolls.get(ctx, aRoll().id))?.roll).toEqual(aRoll());
  });

  test('doesn’t take another roll’s folder for a roll’s because of its name', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll());
    const other = aRoll({ id: ulidFor(2), roll: '2026-015' });
    await rolls.create(ctx, other);
    // The other roll's folder given a name ending in this roll's ID as well.
    await rename(
      rollFolder('2026-015', ulidFor(2)),
      rollFolder('2026-015', ulidFor(1)),
    );

    const folder = await findRollFolder(archive.path(), aRoll().id);

    expect(folder === undefined ? '' : path.basename(folder)).toBe(
      '2026-014-00000001',
    );
    expect(
      (await findRollFolder(archive.path(), other.id))?.endsWith(
        '2026-015-00000001',
      ),
    ).toBe(true);
  });
});

describe('renaming a roll’s folder when its number changes', () => {
  async function aRollWithAScan(
    rolls: RollRepository,
    roll = aRoll(),
  ): Promise<void> {
    await rolls.create(ctx, roll);
    const scan = path.join(
      rollFolder(roll.roll, roll.id),
      'frames',
      '00000002',
      '00000003',
      '12340014.jpg',
    );
    await mkdir(path.dirname(scan), { recursive: true });
    await writeFile(scan, 'a scan');
  }

  async function renumber(
    rolls: RollRepository,
    roll: ReturnType<typeof aRoll>,
    to: string,
  ) {
    const read = await rolls.get(ctx, roll.id);
    return rolls.save(
      ctx,
      { ...roll, roll: aRoll({ roll: to }).roll },
      read?.version ?? '',
    );
  }

  test('renames it for the new number, taking its files with it', async () => {
    const rolls = repository();
    await aRollWithAScan(rolls);

    const saved = await renumber(rolls, aRoll(), '2026-009');

    expect(saved.ok).toBe(true);
    expect(await names(path.join(archive.path(), 'rolls', '2026'))).toEqual([
      '2026-009-00000001',
    ]);
    expect(
      await readFile(
        path.join(
          rollFolder('2026-009'),
          'frames',
          '00000002',
          '00000003',
          '12340014.jpg',
        ),
        'utf8',
      ),
    ).toBe('a scan');
    expect((await rolls.get(ctx, aRoll().id))?.roll.roll).toBe('2026-009');
  });

  test('moves it to the new number’s year, and removes the year folder it leaves empty', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll({ roll: '2025-031' }));

    await renumber(rolls, aRoll({ roll: '2025-031' }), '2026-004');

    expect(await names(path.join(archive.path(), 'rolls'))).toEqual(['2026']);
    expect(await names(path.join(archive.path(), 'rolls', '2026'))).toEqual([
      '2026-004-00000001',
    ]);
  });

  test('keeps a year folder that has anything else in it', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll({ roll: '2025-031' }));
    await writeFile(
      path.join(archive.path(), 'rolls', '2025', '_folder.json'),
      '{}',
    );

    await renumber(rolls, aRoll({ roll: '2025-031' }), '2026-004');

    expect(await names(path.join(archive.path(), 'rolls', '2025'))).toEqual([
      '_folder.json',
    ]);
  });

  test('leaves a roll’s folder alone when its number stays the same', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll());
    await rename(
      rollFolder('2026-014'),
      path.dirname(oldStyleFile('2026-014')),
    );
    const read = await rolls.get(ctx, aRoll().id);

    await rolls.save(
      ctx,
      { ...aRoll(), name: 'Westfjords' },
      read?.version ?? '',
    );

    expect(await names(path.join(archive.path(), 'rolls', '2026'))).toEqual([
      '2026-014',
    ]);
  });

  test('renames a folder named by number alone the first time its number changes', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll());
    await rename(
      rollFolder('2026-014'),
      path.dirname(oldStyleFile('2026-014')),
    );

    await renumber(rolls, aRoll(), '2026-009');

    expect(await names(path.join(archive.path(), 'rolls', '2026'))).toEqual([
      '2026-009-00000001',
    ]);
  });

  test('lets two rolls swap numbers, their folders never clashing', async () => {
    const rolls = repository();
    const first = aRoll();
    const second = aRoll({ id: ulidFor(2), roll: '2026-015' });
    await rolls.create(ctx, first);
    await rolls.create(ctx, second);

    expect((await renumber(rolls, first, '2026-015')).ok).toBe(true);
    expect((await renumber(rolls, second, '2026-014')).ok).toBe(true);

    expect(await names(path.join(archive.path(), 'rolls', '2026'))).toEqual([
      '2026-014-00000002',
      '2026-015-00000001',
    ]);
    expect((await rolls.list(ctx)).rolls.map((r) => [r.id, r.roll])).toEqual([
      [second.id, '2026-014'],
      [first.id, '2026-015'],
    ]);
  });

  test('still finds a roll whose rename was cut short, and finishes it the next time it is saved', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll());
    // The folder renamed, but not yet roll.json inside it.
    await rename(rollFolder('2026-014'), rollFolder('2026-009'));

    expect((await rolls.get(ctx, aRoll().id))?.roll.roll).toBe('2026-014');
    expect((await renumber(rolls, aRoll(), '2026-009')).ok).toBe(true);

    expect(await names(path.join(archive.path(), 'rolls', '2026'))).toEqual([
      '2026-009-00000001',
    ]);
    expect((await rolls.get(ctx, aRoll().id))?.roll.roll).toBe('2026-009');
  });

  test('refuses to rename onto a folder that’s there, changing nothing', async () => {
    const rolls = repository();
    await aRollWithAScan(rolls);
    await mkdir(rollFolder('2026-009'), { recursive: true });
    await writeFile(path.join(rollFolder('2026-009'), 'other.txt'), 'x');

    await expect(renumber(rolls, aRoll(), '2026-009')).rejects.toThrow(
      'already exists',
    );

    expect((await rolls.get(ctx, aRoll().id))?.roll.roll).toBe('2026-014');
    expect(await names(rollFolder('2026-014'))).toContain('frames');
  });

  test('renames the folder when the number is changed through change() too', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll());

    const changed = await rolls.change(ctx, aRoll().id, (roll) =>
      Promise.resolve(
        ok({
          roll: { ...roll, roll: aRoll({ roll: '2026-009' }).roll },
          value: 1,
        }),
      ),
    );

    expect(changed).toEqual(ok(1));
    expect(await names(path.join(archive.path(), 'rolls', '2026'))).toEqual([
      '2026-009-00000001',
    ]);
  });

  test('removes the year folder when a roll that was its last is removed', async () => {
    const rolls = repository();
    await rolls.create(ctx, aRoll());
    const read = await rolls.get(ctx, aRoll().id);

    const removed = await rolls.remove(
      ctx,
      aRoll().id,
      read?.version ?? '',
      () => rename(rollFolder('2026-014'), path.join(archive.path(), 'taken')),
    );

    expect(removed).toEqual(ok(undefined));
    expect(await names(path.join(archive.path(), 'rolls'))).toEqual([]);
  });
});
