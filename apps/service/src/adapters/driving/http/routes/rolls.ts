import { glob, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { newUlid } from '../../../driven/node/new-ulid.ts';

// Strict, because the roll ID becomes part of a folder path.
const rollId = z
  .string()
  .regex(/^\d{4}-\d{3}$/, 'must be a roll ID like 2026-014');

const createRollRequest = z.object({ roll: rollId });

const createFrameRequest = z.object({
  number: z.string().min(1, 'must be an edge number like 23 or 12A').optional(),
});

const storedFrame = z.object({
  id: z.string(),
  number: z.string().nullable(),
  versions: z.array(z.unknown()),
});

const storedRoll = z.object({
  schema: z.literal(1),
  id: z.string(),
  roll: rollId,
  frames: z.array(storedFrame),
});

type StoredRoll = z.infer<typeof storedRoll>;
type Roll = Omit<StoredRoll, 'schema'>;

interface RollFile {
  readonly file: string;
  readonly stored: StoredRoll;
}

async function readRollFiles(archivePath: string): Promise<RollFile[]> {
  const rollFiles: RollFile[] = [];
  for await (const relative of glob('rolls/*/*/roll.json', {
    cwd: archivePath,
  })) {
    const file = path.join(archivePath, relative);
    const stored = storedRoll.parse(JSON.parse(await readFile(file, 'utf8')));
    rollFiles.push({ file, stored });
  }
  return rollFiles.sort((a, b) => a.stored.roll.localeCompare(b.stored.roll));
}

async function findRollFile(
  archivePath: string,
  id: string,
): Promise<RollFile | undefined> {
  return (await readRollFiles(archivePath)).find((r) => r.stored.id === id);
}

function toRoll({ id, roll, frames }: StoredRoll): Roll {
  return { id, roll, frames };
}

function fileContent(stored: StoredRoll): string {
  return `${JSON.stringify(stored, null, 2)}\n`;
}

/** The request body as JSON; malformed JSON becomes undefined, which every schema rejects. */
async function jsonBody(c: Context): Promise<unknown> {
  return c.req.json().catch(() => undefined);
}

function invalidRequest(c: Context, error: z.ZodError): Response {
  const issues = error.issues.map(({ path, message }) => ({ path, message }));
  return c.json({ error: 'invalid request', issues }, 422);
}

export function rollRoutes(archivePath: string): Hono {
  const routes = new Hono();

  routes.get('/', async (c) =>
    c.json((await readRollFiles(archivePath)).map((r) => toRoll(r.stored))),
  );

  routes.get('/:id', async (c) => {
    const id = c.req.param('id');
    const rollFile = await findRollFile(archivePath, id);
    if (rollFile === undefined) {
      return c.json({ error: `no roll with ID ${id}` }, 404);
    }
    return c.json(toRoll(rollFile.stored));
  });

  routes.post('/', async (c) => {
    const parsed = createRollRequest.safeParse(await jsonBody(c));
    if (!parsed.success) {
      return invalidRequest(c, parsed.error);
    }

    const { roll } = parsed.data;
    const created: StoredRoll = { schema: 1, id: newUlid(), roll, frames: [] };
    const folder = path.join(archivePath, 'rolls', roll.slice(0, 4), roll);
    await mkdir(folder, { recursive: true });
    try {
      // 'wx' fails if the file exists, so two rolls can't share an ID.
      await writeFile(path.join(folder, 'roll.json'), fileContent(created), {
        flag: 'wx',
      });
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

    return c.json(toRoll(created), 201);
  });

  routes.post('/:id/frames', async (c) => {
    const id = c.req.param('id');
    const rollFile = await findRollFile(archivePath, id);
    if (rollFile === undefined) {
      return c.json({ error: `no roll with ID ${id}` }, 404);
    }
    const parsed = createFrameRequest.safeParse(await jsonBody(c));
    if (!parsed.success) {
      return invalidRequest(c, parsed.error);
    }

    const frame = {
      id: newUlid(),
      number: parsed.data.number ?? null,
      versions: [],
    };
    const { stored } = rollFile;
    await writeFile(
      rollFile.file,
      fileContent({ ...stored, frames: [...stored.frames, frame] }),
    );

    return c.json(frame, 201);
  });

  return routes;
}
