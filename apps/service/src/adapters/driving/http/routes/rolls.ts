import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono, type Context } from 'hono';
import sharp from 'sharp';
import { z } from 'zod';
import { newUlid } from '../../../driven/node/new-ulid.ts';
import {
  findRollFile,
  readRollFiles,
  rollFileContent,
  rollId,
  writeRollFile,
  type StoredRoll,
  type StoredVersion,
} from './roll-files.ts';

const createRollRequest = z.object({ roll: rollId });

const createFrameRequest = z.object({
  number: z.string().min(1, 'must be an edge number like 23 or 12A').optional(),
});

const addVersionQuery = z.object({
  // A bare file name, because it's written into the roll's lab folder.
  file: z
    .string()
    .regex(/^[\w-]+\.jpe?g$/i, 'must be a JPEG file name like 12340014.jpg'),
});

function toRoll({ id, roll, frames }: StoredRoll): Omit<StoredRoll, 'schema'> {
  return { id, roll, frames };
}

/** The request body as JSON; malformed JSON becomes undefined, which every schema rejects. */
async function jsonBody(c: Context): Promise<unknown> {
  return c.req.json().catch(() => undefined);
}

function invalidRequest(c: Context, error: z.ZodError): Response {
  const issues = error.issues.map(({ path, message }) => ({ path, message }));
  return c.json({ error: 'invalid request', issues }, 422);
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
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
      await writeFile(
        path.join(folder, 'roll.json'),
        rollFileContent(created),
        {
          flag: 'wx',
        },
      );
    } catch (error) {
      if (isAlreadyExists(error)) {
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
    await writeRollFile(rollFile.file, {
      ...stored,
      frames: [...stored.frames, frame],
    });

    return c.json(frame, 201);
  });

  routes.post('/:id/frames/:frameId/versions', async (c) => {
    const { id, frameId } = c.req.param();
    const rollFile = await findRollFile(archivePath, id);
    const frame = rollFile?.stored.frames.find((f) => f.id === frameId);
    if (rollFile === undefined || frame === undefined) {
      return c.json({ error: `no frame ${frameId} in roll ${id}` }, 404);
    }
    const parsed = addVersionQuery.safeParse(c.req.query());
    if (!parsed.success) {
      return invalidRequest(c, parsed.error);
    }

    const image = Buffer.from(await c.req.arrayBuffer());
    const sha256 = createHash('sha256').update(image).digest('hex');
    const { stored } = rollFile;
    const duplicate = stored.frames.find((f) =>
      f.versions.some((v) => v.sha256 === sha256),
    );
    if (duplicate !== undefined) {
      return c.json(
        { error: 'this scan is already in the roll', frameId: duplicate.id },
        409,
      );
    }

    const { width, height } = await sharp(image).metadata();
    const file = `lab/${parsed.data.file}`;
    const rollFolder = path.dirname(rollFile.file);
    await mkdir(path.join(rollFolder, 'lab'), { recursive: true });
    try {
      // 'wx' fails if the file exists: originals are never overwritten.
      await writeFile(path.join(rollFolder, file), image, { flag: 'wx' });
    } catch (error) {
      if (isAlreadyExists(error)) {
        return c.json({ error: `${file} already exists in the roll` }, 409);
      }
      throw error;
    }

    const version: StoredVersion = {
      id: newUlid(),
      file,
      sha256,
      bytes: image.length,
      width,
      height,
      added: new Date().toISOString(),
    };
    await writeRollFile(rollFile.file, {
      ...stored,
      frames: stored.frames.map((f) =>
        f.id === frame.id ? { ...f, versions: [...f.versions, version] } : f,
      ),
    });

    return c.json(version, 201);
  });

  return routes;
}
