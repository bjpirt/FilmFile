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
import { bodyLimit } from 'hono/body-limit';
import sharp from 'sharp';
import type { Clock } from '../../../../application/ports/clock.ts';
import type { IdGenerator } from '../../../../application/ports/id-generator.ts';
import type { RollRepository } from '../../../../application/ports/roll-repository.ts';
import type { CreateRoll } from '../../../../application/use-cases/rolls/create-roll.ts';
import type { GetRoll } from '../../../../application/use-cases/rolls/get-roll.ts';
import type { ListRolls } from '../../../../application/use-cases/rolls/list-rolls.ts';
import type { Frame, Roll, Version } from '../../../../domain/rolls/roll.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { isRollId } from '../../../../domain/shared/ids.ts';
import { hasErrorCode } from '../../../outbound/filesystem/error-codes.ts';
import { rollFolder } from '../../../outbound/filesystem/filesystem-roll-repository.ts';
import { safePath } from '../../../outbound/filesystem/safe-path.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { folderName, newIdWithUniqueFolder } from './folder-names.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';
import { rollDto, versionDto } from './roll-dto.ts';

const thumbnailPixels = { small: 400, large: 2048 } as const;

// D4: lab scans are a few MB; this leaves room for large scans to come.
const maxUploadMegabytes = 200;

// Images are decoded only up to this size, so a small file claiming huge
// dimensions (a decompression bomb) can't exhaust memory.
const maxPixels = 100_000_000;

/** JPEGs start with an SOI marker followed by another marker: FF D8 FF. */
function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** The image's dimensions from its header, or why it can't be accepted. */
async function inspectImage(
  image: Buffer,
): Promise<
  | { readonly width: number; readonly height: number }
  | 'unreadable'
  | 'too-many-pixels'
> {
  let width: number;
  let height: number;
  try {
    ({ width, height } = await sharp(image).metadata());
  } catch {
    // sharp throws for any image it can't parse; the client hears why below.
    return 'unreadable';
  }
  return width * height > maxPixels ? 'too-many-pixels' : { width, height };
}

/** A version's file, from the path stored in roll.json, which must stay in the roll's folder. */
function versionFile(
  archivePath: string,
  roll: Roll,
  version: Version,
): string {
  return safePath(
    rollFolder(archivePath, roll.roll),
    ...version.file.split('/'),
  );
}

/** A WebP that fits within the size, made on first request and cached by content hash. */
async function thumbnail(
  cachePath: string,
  original: string,
  version: Version,
  size: keyof typeof thumbnailPixels,
): Promise<Buffer> {
  const cached = safePath(
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
  const made = await sharp(original, { limitInputPixels: maxPixels })
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
  summary: 'List every roll, ordered by roll number',
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
    409: json(errorResponse, 'A roll with that roll number already exists.'),
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
  middleware: [
    bodyLimit({
      maxSize: maxUploadMegabytes * 1024 * 1024,
      onError: (c) =>
        c.json(
          {
            error: `The file is larger than ${String(maxUploadMegabytes)} MB.`,
          },
          413,
        ),
    }),
    requireContentType('image/jpeg'),
  ] as const,
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
    413: json(errorResponse, 'The file is larger than 200 MB.'),
    415: json(errorResponse, 'The body is not a JPEG.'),
    422: json(
      z.union([invalidRequestResponse, errorResponse]),
      'The request is invalid, the file could not be read as an image, or it has more than 100 megapixels.',
    ),
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
  ctx,
  clock,
  ids,
  rolls,
  useCases,
}: {
  readonly archivePath: string;
  readonly cachePath: string;
  readonly ctx: ArchiveContext;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  // Frames and versions use the repository directly until their use cases (task H.7).
  readonly rolls: RollRepository;
  readonly useCases: {
    readonly createRoll: CreateRoll;
    readonly getRoll: GetRoll;
    readonly listRolls: ListRolls;
  };
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });

  /** The roll with this ID; the route's schema has already checked it's a ULID. */
  async function findRoll(rollId: string): Promise<Roll | undefined> {
    return isRollId(rollId) ? rolls.get(ctx, rollId) : undefined;
  }

  async function findVersion(ids: {
    rollId: string;
    frameId: string;
    versionId: string;
  }): Promise<{ roll: Roll; version: Version } | undefined> {
    const roll = await findRoll(ids.rollId);
    const version = roll?.frames
      .find((f) => f.id === ids.frameId)
      ?.versions.find((v) => v.id === ids.versionId);
    return roll === undefined || version === undefined
      ? undefined
      : { roll, version };
  }

  routes.openapi(listRolls, async (c) => {
    const listed = await useCases.listRolls.execute(ctx);
    return c.json(listed.map(rollDto), 200);
  });

  routes.openapi(getRoll, async (c) => {
    const { rollId } = c.req.valid('param');
    if (!isRollId(rollId)) {
      return c.json({ error: `no roll with ID ${rollId}` }, 404);
    }
    const found = await useCases.getRoll.execute(ctx, { id: rollId });
    return found.ok
      ? c.json(rollDto(found.value), 200)
      : domainErrorResponse(c, found.error);
  });

  routes.openapi(createRoll, async (c) => {
    const created = await useCases.createRoll.execute(ctx, c.req.valid('json'));
    return created.ok
      ? c.json(rollDto(created.value), 201)
      : domainErrorResponse(c, created.error);
  });

  routes.openapi(createFrame, async (c) => {
    const { rollId } = c.req.valid('param');
    const { number } = c.req.valid('json');
    const found = await findRoll(rollId);
    if (found === undefined) {
      return c.json({ error: `no roll with ID ${rollId}` }, 404);
    }

    const frame: Frame = {
      id: newIdWithUniqueFolder(
        found.frames.map((f) => f.id),
        () => ids.newFrameId(),
      ),
      number: number ?? null,
      versions: [],
    };
    const saved = await rolls.save(ctx, {
      ...found,
      frames: [...found.frames, frame],
    });
    return saved.ok
      ? c.json({ ...frame, versions: [] }, 201)
      : domainErrorResponse(c, saved.error);
  });

  routes.openapi(addVersion, async (c) => {
    const { rollId, frameId } = c.req.valid('param');
    const query = c.req.valid('query');
    const found = await findRoll(rollId);
    const frame = found?.frames.find((f) => f.id === frameId);
    if (found === undefined || frame === undefined) {
      return c.json({ error: `no frame ${frameId} in roll ${rollId}` }, 404);
    }

    const image = Buffer.from(await c.req.arrayBuffer());
    if (!isJpeg(image)) {
      return c.json({ error: 'The file is not a JPEG.' }, 415);
    }
    const sha256 = createHash('sha256').update(image).digest('hex');
    const duplicate = found.frames.find((f) =>
      f.versions.some((v) => v.sha256 === sha256),
    );
    if (duplicate !== undefined) {
      return c.json(
        { error: 'this scan is already in the roll', frameId: duplicate.id },
        409,
      );
    }

    const inspected = await inspectImage(image);
    if (inspected === 'unreadable') {
      return c.json({ error: 'The file could not be read as an image.' }, 422);
    }
    if (inspected === 'too-many-pixels') {
      return c.json(
        {
          error: `The image has more than ${String(maxPixels / 1_000_000)} megapixels.`,
        },
        422,
      );
    }

    const versionId = newIdWithUniqueFolder(
      frame.versions.map((v) => v.id),
      () => ids.newVersionId(),
    );
    const names = [
      'frames',
      folderName(frame.id),
      folderName(versionId),
      query.file,
    ];
    const target = safePath(rollFolder(archivePath, found.roll), ...names);
    await mkdir(path.dirname(target), { recursive: true });
    // 'wx' fails if the file exists: originals are never overwritten.
    await writeFile(target, image, { flag: 'wx' });

    const version: Version = {
      id: versionId,
      file: names.join('/'),
      sha256,
      bytes: image.length,
      width: inspected.width,
      height: inspected.height,
      added: clock.now(),
    };
    const saved = await rolls.save(ctx, {
      ...found,
      frames: found.frames.map((f) =>
        f.id === frame.id ? { ...f, versions: [...f.versions, version] } : f,
      ),
    });
    return saved.ok
      ? c.json(versionDto(version), 201)
      : domainErrorResponse(c, saved.error);
  });

  routes.openapi(getOriginal, async (c) => {
    const found = await findVersion(c.req.valid('param'));
    if (found === undefined) {
      return c.json({ error: 'no such version' }, 404);
    }
    const image = await readFile(
      versionFile(archivePath, found.roll, found.version),
    );
    return c.body(new Uint8Array(image), 200, { 'Content-Type': 'image/jpeg' });
  });

  routes.openapi(getThumbnail, async (c) => {
    const found = await findVersion(c.req.valid('param'));
    if (found === undefined) {
      return c.json({ error: 'no such version' }, 404);
    }
    const image = await thumbnail(
      cachePath,
      versionFile(archivePath, found.roll, found.version),
      found.version,
      c.req.valid('query').size,
    );
    return c.body(new Uint8Array(image), 200, {
      'Content-Type': 'image/webp',
    });
  });

  return routes;
}
