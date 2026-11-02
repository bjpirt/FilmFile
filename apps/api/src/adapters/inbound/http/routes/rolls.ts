import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono, type Context } from 'hono';
import sharp from 'sharp';
import { z } from 'zod';
import { newUlid } from '../../../outbound/node/new-ulid.ts';
import { folderName, newIdWithUniqueFolder } from './folder-names.ts';
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
  // A bare file name, because it's written into the version's folder.
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

const thumbnailQuery = z.object({ size: z.enum(['small', 'large']) });

const thumbnailPixels = { small: 400, large: 2048 } as const;

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

function isAlreadyExists(error: unknown): boolean {
  return hasErrorCode(error, 'EEXIST');
}

async function findVersion(
  archivePath: string,
  ids: { id: string; frameId: string; versionId: string },
): Promise<{ rollFolder: string; version: StoredVersion } | undefined> {
  const rollFile = await findRollFile(archivePath, ids.id);
  const version = rollFile?.stored.frames
    .find((f) => f.id === ids.frameId)
    ?.versions.find((v) => v.id === ids.versionId);
  if (rollFile === undefined || version === undefined) {
    return undefined;
  }
  return { rollFolder: path.dirname(rollFile.file), version };
}

/** A WebP that fits within the size, made on first request and cached by content hash. */
async function thumbnail(
  cachePath: string,
  original: string,
  version: StoredVersion,
  size: keyof typeof thumbnailPixels,
): Promise<Buffer> {
  const cached = path.join(
    cachePath,
    'thumbnails',
    `${version.sha256}-${size}.webp`,
  );
  try {
    return await readFile(cached);
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) {
      throw error;
    }
  }
  const pixels = thumbnailPixels[size];
  const made = await sharp(original)
    .resize(pixels, pixels, { fit: 'inside', withoutEnlargement: true })
    .webp()
    .toBuffer();
  await mkdir(path.dirname(cached), { recursive: true });
  await writeFile(cached, made);
  return made;
}

export function rollRoutes({
  archivePath,
  cachePath,
}: {
  readonly archivePath: string;
  readonly cachePath: string;
}): Hono {
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

    const { stored } = rollFile;
    const frame = {
      id: newIdWithUniqueFolder(stored.frames.map((f) => f.id)),
      number: parsed.data.number ?? null,
      versions: [],
    };
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
    const versionId = newIdWithUniqueFolder(frame.versions.map((v) => v.id));
    const file = path.posix.join(
      'frames',
      folderName(frame.id),
      folderName(versionId),
      parsed.data.file,
    );
    const target = path.join(path.dirname(rollFile.file), file);
    await mkdir(path.dirname(target), { recursive: true });
    // 'wx' fails if the file exists: originals are never overwritten.
    await writeFile(target, image, { flag: 'wx' });

    const version: StoredVersion = {
      id: versionId,
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

  routes.get('/:id/frames/:frameId/versions/:versionId/file', async (c) => {
    const found = await findVersion(archivePath, c.req.param());
    if (found === undefined) {
      return c.json({ error: 'no such version' }, 404);
    }
    const image = await readFile(
      path.join(found.rollFolder, found.version.file),
    );
    return c.body(new Uint8Array(image), 200, { 'Content-Type': 'image/jpeg' });
  });

  routes.get(
    '/:id/frames/:frameId/versions/:versionId/thumbnail',
    async (c) => {
      const found = await findVersion(archivePath, c.req.param());
      if (found === undefined) {
        return c.json({ error: 'no such version' }, 404);
      }
      const parsed = thumbnailQuery.safeParse(c.req.query());
      if (!parsed.success) {
        return invalidRequest(c, parsed.error);
      }
      const image = await thumbnail(
        cachePath,
        path.join(found.rollFolder, found.version.file),
        found.version,
        parsed.data.size,
      );
      return c.body(new Uint8Array(image), 200, {
        'Content-Type': 'image/webp',
      });
    },
  );

  return routes;
}
