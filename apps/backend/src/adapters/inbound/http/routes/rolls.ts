import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import {
  addVersionQuery,
  createFrameRequest,
  createRollRequest,
  frame,
  frameParams,
  roll,
  rollParams,
  thumbnailQuery,
  version,
  versionParams,
} from '@filmfile/contracts/rolls';
import sharp from 'sharp';
import { newUlid } from '../../../outbound/node/new-ulid.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { folderName, newIdWithUniqueFolder } from './folder-names.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';
import {
  findRollFile,
  readRollFiles,
  rollFileContent,
  writeRollFile,
  type StoredRoll,
  type StoredVersion,
} from './roll-files.ts';

function toRoll({ id, roll, frames }: StoredRoll): Omit<StoredRoll, 'schema'> {
  return { id, roll, frames };
}

const thumbnailPixels = { small: 400, large: 2048 } as const;

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

function isAlreadyExists(error: unknown): boolean {
  return hasErrorCode(error, 'EEXIST');
}

async function findVersion(
  archivePath: string,
  ids: { rollId: string; frameId: string; versionId: string },
): Promise<{ rollFolder: string; version: StoredVersion } | undefined> {
  const rollFile = await findRollFile(archivePath, ids.rollId);
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

function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

function image(type: string, description: string) {
  return {
    description,
    content: { [type]: { schema: z.string().meta({ format: 'binary' }) } },
  };
}

const invalid = json(invalidRequestResponse, 'The request is invalid.');

const malformed = json(errorResponse, 'The body is not valid JSON.');

const wrongType = json(errorResponse, 'The body is not of the expected type.');

const requireJson = requireContentType('application/json');

const listRolls = createRoute({
  method: 'get',
  path: '/',
  summary: 'List every roll, ordered by roll ID',
  responses: { 200: json(z.array(roll), 'The rolls.') },
});

const getRoll = createRoute({
  method: 'get',
  path: '/{rollId}',
  summary: 'Get a roll with its frames and versions',
  request: { params: rollParams },
  responses: {
    200: json(roll, 'The roll.'),
    404: json(errorResponse, 'No roll has that ID.'),
    422: invalid,
  },
});

const createRoll = createRoute({
  method: 'post',
  path: '/',
  summary: 'Create an empty roll',
  middleware: [requireJson] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: createRollRequest } },
    },
  },
  responses: {
    201: json(roll, 'The new roll.'),
    400: malformed,
    409: json(errorResponse, 'A roll with that roll ID already exists.'),
    415: wrongType,
    422: invalid,
  },
});

const createFrame = createRoute({
  method: 'post',
  path: '/{rollId}/frames',
  summary: 'Add a frame with no versions to a roll',
  middleware: [requireJson] as const,
  request: {
    params: rollParams,
    body: {
      required: true,
      content: { 'application/json': { schema: createFrameRequest } },
    },
  },
  responses: {
    201: json(frame, 'The new frame.'),
    400: malformed,
    404: json(errorResponse, 'No roll has that ID.'),
    415: wrongType,
    422: invalid,
  },
});

const addVersion = createRoute({
  method: 'post',
  path: '/{rollId}/frames/{frameId}/versions',
  summary: 'Upload a lab scan as a new version of a frame',
  description: 'The body is the JPEG itself. It is stored unchanged.',
  middleware: [requireContentType('image/jpeg')] as const,
  request: {
    params: frameParams,
    query: addVersionQuery,
    body: { required: true, ...image('image/jpeg', 'The scan.') },
  },
  responses: {
    201: json(version, 'The new version.'),
    404: json(errorResponse, 'The roll has no frame with that ID.'),
    409: json(
      errorResponse.extend({ frameId: z.string() }),
      'The same scan is already in the roll, in the frame given.',
    ),
    415: wrongType,
    422: invalid,
  },
});

const getOriginal = createRoute({
  method: 'get',
  path: '/{rollId}/frames/{frameId}/versions/{versionId}/file',
  summary: "Download a version's original file",
  request: { params: versionParams },
  responses: {
    200: image('image/jpeg', 'The original, unchanged.'),
    404: json(errorResponse, 'No such version.'),
    422: invalid,
  },
});

const getThumbnail = createRoute({
  method: 'get',
  path: '/{rollId}/frames/{frameId}/versions/{versionId}/thumbnail',
  summary: 'Get a thumbnail of a version',
  request: { params: versionParams, query: thumbnailQuery },
  responses: {
    200: image('image/webp', 'A WebP that fits within the size.'),
    404: json(errorResponse, 'No such version.'),
    422: invalid,
  },
});

export function rollRoutes({
  archivePath,
  cachePath,
}: {
  readonly archivePath: string;
  readonly cachePath: string;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });

  routes.openapi(listRolls, async (c) =>
    c.json(
      (await readRollFiles(archivePath)).map((r) => toRoll(r.stored)),
      200,
    ),
  );

  routes.openapi(getRoll, async (c) => {
    const { rollId } = c.req.valid('param');
    const rollFile = await findRollFile(archivePath, rollId);
    if (rollFile === undefined) {
      return c.json({ error: `no roll with ID ${rollId}` }, 404);
    }
    return c.json(toRoll(rollFile.stored), 200);
  });

  routes.openapi(createRoll, async (c) => {
    const { roll } = c.req.valid('json');
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

  routes.openapi(createFrame, async (c) => {
    const { rollId } = c.req.valid('param');
    const { number } = c.req.valid('json');
    const rollFile = await findRollFile(archivePath, rollId);
    if (rollFile === undefined) {
      return c.json({ error: `no roll with ID ${rollId}` }, 404);
    }

    const { stored } = rollFile;
    const frame = {
      id: newIdWithUniqueFolder(stored.frames.map((f) => f.id)),
      number: number ?? null,
      versions: [],
    };
    await writeRollFile(rollFile.file, {
      ...stored,
      frames: [...stored.frames, frame],
    });

    return c.json(frame, 201);
  });

  routes.openapi(addVersion, async (c) => {
    const { rollId, frameId } = c.req.valid('param');
    const query = c.req.valid('query');
    const rollFile = await findRollFile(archivePath, rollId);
    const frame = rollFile?.stored.frames.find((f) => f.id === frameId);
    if (rollFile === undefined || frame === undefined) {
      return c.json({ error: `no frame ${frameId} in roll ${rollId}` }, 404);
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
      query.file,
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

  routes.openapi(getOriginal, async (c) => {
    const found = await findVersion(archivePath, c.req.valid('param'));
    if (found === undefined) {
      return c.json({ error: 'no such version' }, 404);
    }
    const image = await readFile(
      path.join(found.rollFolder, found.version.file),
    );
    return c.body(new Uint8Array(image), 200, { 'Content-Type': 'image/jpeg' });
  });

  routes.openapi(getThumbnail, async (c) => {
    const found = await findVersion(archivePath, c.req.valid('param'));
    if (found === undefined) {
      return c.json({ error: 'no such version' }, 404);
    }
    const image = await thumbnail(
      cachePath,
      path.join(found.rollFolder, found.version.file),
      found.version,
      c.req.valid('query').size,
    );
    return c.body(new Uint8Array(image), 200, {
      'Content-Type': 'image/webp',
    });
  });

  return routes;
}
