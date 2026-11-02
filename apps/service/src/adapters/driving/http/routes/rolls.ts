import { glob, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import { z } from 'zod';
import { newUlid } from '../../../driven/node/new-ulid.ts';

// Strict, because the roll ID becomes part of a folder path.
const rollId = z
  .string()
  .regex(/^\d{4}-\d{3}$/, 'must be a roll ID like 2026-014');

const createRollRequest = z.object({ roll: rollId });

const storedRoll = z.object({
  schema: z.literal(1),
  id: z.string(),
  roll: rollId,
  frames: z.array(z.unknown()),
});

type Roll = Omit<z.infer<typeof storedRoll>, 'schema'>;

async function readRolls(archivePath: string): Promise<Roll[]> {
  const rolls: Roll[] = [];
  for await (const file of glob('rolls/*/*/roll.json', { cwd: archivePath })) {
    const { id, roll, frames } = storedRoll.parse(
      JSON.parse(await readFile(path.join(archivePath, file), 'utf8')),
    );
    rolls.push({ id, roll, frames });
  }
  return rolls.sort((a, b) => a.roll.localeCompare(b.roll));
}

function issuesOf(
  error: z.ZodError,
): { path: PropertyKey[]; message: string }[] {
  return error.issues.map(({ path, message }) => ({ path, message }));
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
    // Malformed JSON becomes undefined, so the schema reports it like any other bad input.
    const body: unknown = await c.req.json().catch(() => undefined);
    const parsed = createRollRequest.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'invalid request', issues: issuesOf(parsed.error) },
        422,
      );
    }

    const { roll } = parsed.data;
    const created = { id: newUlid(), roll, frames: [] };
    const folder = path.join(archivePath, 'rolls', roll.slice(0, 4), roll);
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
