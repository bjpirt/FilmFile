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
  ifMatchHeader,
  roll,
  rollList,
  rollParams,
  thumbnailQuery,
  updateFrameRequest,
  version,
  versionParams,
} from '@filmfile/contracts/rolls';
import { bodyLimit } from 'hono/body-limit';
import type { AddVersion } from '../../../../application/use-cases/frames/add-version.ts';
import type { CreateFrame } from '../../../../application/use-cases/frames/create-frame.ts';
import type { GetOriginal } from '../../../../application/use-cases/frames/get-original.ts';
import type { GetThumbnail } from '../../../../application/use-cases/frames/get-thumbnail.ts';
import type { UpdateFrame } from '../../../../application/use-cases/frames/update-frame.ts';
import type { CreateRoll } from '../../../../application/use-cases/rolls/create-roll.ts';
import type { GetRoll } from '../../../../application/use-cases/rolls/get-roll.ts';
import type { ListRolls } from '../../../../application/use-cases/rolls/list-rolls.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import {
  isFrameId,
  isRollId,
  isVersionId,
} from '../../../../domain/shared/ids.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';
import { rollDto, versionDto } from './roll-dto.ts';

/** A roll's version as an ETag: quoted, as HTTP requires. */
function etagOf(version: string): string {
  return `"${version}"`;
}

/** The version in an If-Match header, which may be quoted and marked weak. */
function versionFrom(ifMatch: string): string {
  return ifMatch.replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
}

// D4: lab scans are a few MB; this leaves room for large scans to come.
const maxUploadMegabytes = 200;

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
  description:
    "A roll whose roll.json can't be read is listed under `unreadable`, with what's wrong, rather than failing the list.",
  responses: { 200: json(rollList, 'The rolls.') },
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

const updateFrame = createRoute({
  method: 'patch',
  path: '/{rollId}/frames/{frameId}',
  summary: "Set or clear a frame's number",
  description:
    "Send the roll's ETag as If-Match: the change is refused if the roll has changed since. The response's ETag is the roll's new version.",
  middleware: [requireJson] as const,
  request: {
    params: frameParams,
    headers: ifMatchHeader,
    body: {
      required: true,
      content: { 'application/json': { schema: updateFrameRequest } },
    },
  },
  responses: {
    200: json(frame, 'The updated frame.'),
    400: malformed,
    404: json(errorResponse, 'The roll has no frame with that ID.'),
    409: json(errorResponse, 'The roll has changed since it was read.'),
    415: wrongType,
    422: invalid,
    428: json(errorResponse, 'If-Match is missing.'),
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

export interface RollUseCases {
  readonly createRoll: CreateRoll;
  readonly getRoll: GetRoll;
  readonly listRolls: ListRolls;
  readonly createFrame: CreateFrame;
  readonly updateFrame: UpdateFrame;
  readonly addVersion: AddVersion;
  readonly getOriginal: GetOriginal;
  readonly getThumbnail: GetThumbnail;
}

/**
 * Rolls, their frames and the frames' versions. Each handler parses the
 * request, runs a use case and turns its result into a response. The route
 * schemas have already checked IDs are ULIDs; the type guards below only
 * give them their branded types.
 */
export function rollRoutes({
  ctx,
  useCases,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: RollUseCases;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });
  const notFound = { error: 'not found' };

  routes.openapi(listRolls, async (c) => {
    const { rolls, unreadable } = await useCases.listRolls.execute(ctx);
    return c.json(
      { rolls: rolls.map(rollDto), unreadable: [...unreadable] },
      200,
    );
  });

  routes.openapi(getRoll, async (c) => {
    const { rollId } = c.req.valid('param');
    if (!isRollId(rollId)) {
      return c.json(notFound, 404);
    }
    const found = await useCases.getRoll.execute(ctx, { id: rollId });
    if (!found.ok) {
      return domainErrorResponse(c, found.error);
    }
    // The version token, for a later edit to send back as If-Match.
    c.header('ETag', etagOf(found.value.version));
    return c.json(rollDto(found.value.roll), 200);
  });

  routes.openapi(createRoll, async (c) => {
    const created = await useCases.createRoll.execute(ctx, c.req.valid('json'));
    return created.ok
      ? c.json(rollDto(created.value), 201)
      : domainErrorResponse(c, created.error);
  });

  routes.openapi(createFrame, async (c) => {
    const { rollId } = c.req.valid('param');
    if (!isRollId(rollId)) {
      return c.json(notFound, 404);
    }
    const created = await useCases.createFrame.execute(ctx, {
      rollId,
      number: c.req.valid('json').number,
    });
    return created.ok
      ? c.json({ ...created.value, versions: [] }, 201)
      : domainErrorResponse(c, created.error);
  });

  routes.openapi(updateFrame, async (c) => {
    const { rollId, frameId } = c.req.valid('param');
    if (!isRollId(rollId) || !isFrameId(frameId)) {
      return c.json(notFound, 404);
    }
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the roll’s ETag as If-Match' }, 428);
    }
    const updated = await useCases.updateFrame.execute(ctx, {
      rollId,
      frameId,
      expectedVersion: versionFrom(ifMatch),
      number: c.req.valid('json').number,
    });
    if (!updated.ok) {
      return domainErrorResponse(c, updated.error);
    }
    c.header('ETag', etagOf(updated.value.version));
    return c.json({ ...updated.value.frame, versions: [] }, 200);
  });

  routes.openapi(addVersion, async (c) => {
    const { rollId, frameId } = c.req.valid('param');
    if (!isRollId(rollId) || !isFrameId(frameId)) {
      return c.json(notFound, 404);
    }
    const added = await useCases.addVersion.execute(ctx, {
      rollId,
      frameId,
      fileName: c.req.valid('query').file,
      bytes: new Uint8Array(await c.req.arrayBuffer()),
    });
    return added.ok
      ? c.json(versionDto(added.value), 201)
      : domainErrorResponse(c, added.error);
  });

  routes.openapi(getOriginal, async (c) => {
    const { rollId, frameId, versionId } = c.req.valid('param');
    if (!isRollId(rollId) || !isFrameId(frameId) || !isVersionId(versionId)) {
      return c.json(notFound, 404);
    }
    const original = await useCases.getOriginal.execute(ctx, {
      rollId,
      frameId,
      versionId,
    });
    return original.ok
      ? c.body(new Uint8Array(original.value), 200, {
          'Content-Type': 'image/jpeg',
        })
      : domainErrorResponse(c, original.error);
  });

  routes.openapi(getThumbnail, async (c) => {
    const { rollId, frameId, versionId } = c.req.valid('param');
    if (!isRollId(rollId) || !isFrameId(frameId) || !isVersionId(versionId)) {
      return c.json(notFound, 404);
    }
    const thumbnail = await useCases.getThumbnail.execute(ctx, {
      rollId,
      frameId,
      versionId,
      size: c.req.valid('query').size,
    });
    return thumbnail.ok
      ? c.body(new Uint8Array(thumbnail.value), 200, {
          'Content-Type': 'image/webp',
        })
      : domainErrorResponse(c, thumbnail.error);
  });

  return routes;
}
