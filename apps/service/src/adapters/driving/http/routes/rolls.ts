import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { newUlid } from '../../../driven/node/new-ulid.ts';

// Also keeps request input from steering the folder path anywhere else.
const rollIdPattern = /^(?<year>\d{4})-\d{3}$/;

export function rollRoutes(archivePath: string): Hono {
  const routes = new Hono();

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
