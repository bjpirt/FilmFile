import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import { FilesystemRollRepository } from '../../../src/adapters/outbound/filesystem/filesystem-roll-repository.ts';
import type { RollRepository } from '../../../src/application/ports/roll-repository.ts';
import { aRoll, ctx } from '../../support/builders.ts';
import { useTempArchive } from '../../support/temp-archive.ts';

// What only the filesystem adapter does; what every adapter does is in
// test/contracts/roll-repository-contract.ts.

const archive = useTempArchive();

function repository(): RollRepository {
  return new FilesystemRollRepository(archive.path());
}

function rollFile(roll: string): string {
  return path.join(
    archive.path(),
    'rolls',
    roll.slice(0, 4),
    roll,
    'roll.json',
  );
}

test('creates roll.json in the roll year’s folder', async () => {
  await repository().create(ctx, aRoll());

  expect(await readFile(rollFile('2026-014'), 'utf8')).toBe(
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
  await mkdir(path.dirname(rollFile('2026-015')), { recursive: true });
  await writeFile(rollFile('2026-015'), '{ not json');

  const listed = await rolls.list(ctx);

  expect(listed.rolls.map((r) => r.roll)).toEqual(['2026-014']);
  expect(listed.unreadable).toEqual([
    { folder: '2026-015', problem: 'it is not valid JSON' },
  ]);
});

test('never creates a roll over one it cannot read', async () => {
  await mkdir(path.dirname(rollFile('2026-014')), { recursive: true });
  await writeFile(rollFile('2026-014'), '{ not json');

  expect(await repository().create(ctx, aRoll())).toMatchObject({
    ok: false,
    error: { kind: 'already-exists' },
  });
  expect(await readFile(rollFile('2026-014'), 'utf8')).toBe('{ not json');
});
