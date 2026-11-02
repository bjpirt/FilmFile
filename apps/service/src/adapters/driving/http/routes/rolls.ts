import { glob, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { newUlid } from '../../../driven/node/new-ulid.ts';

// Also keeps request input from steering the folder path anywhere else.
const rollIdPattern = /^(?<year>\d{4})-\d{3}$/;

interface Roll {
  readonly id: string;
  readonly roll: string;
  readonly frames: readonly unknown[];
}

// A stand-in for proper parsing until the persistence schemas arrive.
function isRoll(value: unknown): value is Roll {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'roll' in value &&
    typeof value.roll === 'string' &&
    'frames' in value &&
    Array.isArray(value.frames)
  );
}

async function readRolls(archivePath: string): Promise<Roll[]> {
  const rolls: Roll[] = [];
  for await (const file of glob('rolls/*/*/roll.json', { cwd: archivePath })) {
    const stored: unknown = JSON.parse(
      await readFile(path.join(archivePath, file), 'utf8'),
    );
    if (!isRoll(stored)) {
      throw new Error(`${file} is not a valid roll`);
    }
    rolls.push({ id: stored.id, roll: stored.roll, frames: stored.frames });
  }
  return rolls.sort((a, b) => a.roll.localeCompare(b.roll));
}

export function rollRoutes(archivePath: string): Hono {
  const routes = new Hono();

  routes.get('/', async (c) => c.json(await readRolls(archivePath)));

  routes.get('/:id', async (c) => {
    const id = c.req.param('id');
    const roll = (await readRolls(archivePath)).find((r) => r.id === id);
    if (roll === undefined) {
      return c.json({ error: `no roll with ID ${id}` }, 404);
    }
    return c.json(roll);
  });

  routes.post('/', async (c) => {
    const body: unknown = await c.req.json();
    const roll =
      typeof body === 'object' && body !== null && 'roll' in body
        ? body.roll
        : undefined;
    const year =
      typeof roll === 'string'
        ? rollIdPattern.exec(roll)?.groups?.year
        : undefined;
    if (typeof roll !== 'string' || year === undefined) {
      return c.json({ error: 'roll must be a roll ID like 2026-014' }, 422);
    }

    const created = { id: newUlid(), roll, frames: [] };
    const folder = path.join(archivePath, 'rolls', year, roll);
    await mkdir(folder, { recursive: true });
    try {
      // 'wx' fails if the file exists, so two rolls can't share an ID.
      await writeFile(
        path.join(folder, 'roll.json'),
        `${JSON.stringify({ schema: 1, ...created }, null, 2)}\n`,
        { flag: 'wx' },
      );
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'EEXIST'
      ) {
        return c.json({ error: `roll ${roll} already exists` }, 409);
      }
      throw error;
    }

    return c.json(created, 201);
  });

  return routes;
}
