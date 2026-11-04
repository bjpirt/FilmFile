import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import {
  addVersionQuery,
  createFrameRequest,
  createRollRequest,
  deleteFramesQuery,
  frame,
  frameDetails,
  frameParams,
  ifMatchHeader,
  roll,
  rollList,
  rollParams,
  thumbnailQuery,
  updateFramesRequest,
  updateFrameRequest,
  updateRollRequest,
  updateVersionRequest,
  version,
  versionParams,
} from '@filmfile/contracts/rolls';
import { bodyLimit } from 'hono/body-limit';
import { imageTypeOf } from '../../../../domain/rolls/image-type.ts';
import type { AddVersion } from '../../../../application/use-cases/frames/add-version.ts';
import type { CreateFrame } from '../../../../application/use-cases/frames/create-frame.ts';
import type { DeleteVersion } from '../../../../application/use-cases/frames/delete-version.ts';
import type { DeleteFrames } from '../../../../application/use-cases/frames/delete-frames.ts';
import type { DeleteFrame } from '../../../../application/use-cases/frames/delete-frame.ts';
import type { GetFrameDetails } from '../../../../application/use-cases/frames/get-frame-details.ts';
import type { GetOriginal } from '../../../../application/use-cases/frames/get-original.ts';
import type { GetThumbnail } from '../../../../application/use-cases/frames/get-thumbnail.ts';
import type { UpdateFrame } from '../../../../application/use-cases/frames/update-frame.ts';
import type { UpdateVersion } from '../../../../application/use-cases/frames/update-version.ts';
import type { UpdateFrames } from '../../../../application/use-cases/frames/update-frames.ts';
import type { UpdateFrameNumbers } from '../../../../application/use-cases/frames/update-frame-numbers.ts';
import type { CreateRoll } from '../../../../application/use-cases/rolls/create-roll.ts';
import type { DeleteRoll } from '../../../../application/use-cases/rolls/delete-roll.ts';
import type { GetRoll } from '../../../../application/use-cases/rolls/get-roll.ts';
import type { ListRolls } from '../../../../application/use-cases/rolls/list-rolls.ts';
import type { UpdateRoll } from '../../../../application/use-cases/rolls/update-roll.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import {
  isFrameId,
  isRollId,
  isVersionId,
} from '../../../../domain/shared/ids.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { etagOf, versionFrom } from '../etag.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';
import { frameDetailsDto, frameDto, rollDto, versionDto } from './roll-dto.ts';

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

/** A body or response that's a version's image: a JPEG, PNG or WebP (U34), or a TIFF or raw (U20). */
function versionImage(description: string) {
  const binary = { schema: z.string().meta({ format: 'binary' }) };
  return {
    description,
    content: {
      'image/jpeg': binary,
      'image/png': binary,
      'image/webp': binary,
      'image/tiff': binary,
      'image/x-sony-arw': binary,
      'application/octet-stream': binary,
    },
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

const updateRoll = createRoute({
  method: 'patch',
  path: '/{rollId}',
  summary: "Change a roll's details",
  description:
    "Send the roll's ETag as If-Match: the change is refused if the roll has changed since. The response's ETag is the roll's new version.",
  middleware: [requireJson] as const,
  request: {
    params: rollParams,
    headers: ifMatchHeader,
    body: {
      required: true,
      content: { 'application/json': { schema: updateRollRequest } },
    },
  },
  responses: {
    200: json(roll, 'The updated roll.'),
    400: malformed,
    404: json(errorResponse, 'There is no roll with that ID.'),
    409: json(errorResponse, 'The roll has changed since it was read.'),
    415: wrongType,
    422: invalid,
    428: json(errorResponse, 'If-Match is missing.'),
  },
});

const deleteRoll = createRoute({
  method: 'delete',
  path: '/{rollId}',
  summary: 'Delete a roll',
  description:
    "Deletes the roll with its frames (D38). Send the roll's ETag as If-Match: the delete is refused if the roll has changed since. The roll's whole folder moves into the archive's deleted/ folder; nothing is lost.",
  request: { params: rollParams, headers: ifMatchHeader },
  responses: {
    204: { description: 'The roll was deleted.' },
    404: json(errorResponse, 'There is no roll with that ID.'),
    409: json(errorResponse, 'The roll has changed since it was read.'),
    422: invalid,
    428: json(errorResponse, 'If-Match is missing.'),
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

const updateFrameNumbers = createRoute({
  method: 'patch',
  path: '/{rollId}/frames',
  summary: 'Change many frames in one save',
  description:
    "Their numbers, as when renumbering a roll, or the same details of their own for each, as when frames are selected and set together. Frames not listed are left alone. Send the roll's ETag as If-Match: the change is refused if the roll has changed since. The response's ETag is the roll's new version.",
  middleware: [requireJson] as const,
  request: {
    params: rollParams,
    headers: ifMatchHeader,
    body: {
      required: true,
      content: { 'application/json': { schema: updateFramesRequest } },
    },
  },
  responses: {
    200: json(roll, 'The roll, with its frames changed.'),
    400: malformed,
    404: json(errorResponse, 'No such roll, or a frame not in it.'),
    409: json(errorResponse, 'The roll has changed since it was read.'),
    415: wrongType,
    422: invalid,
    428: json(errorResponse, 'If-Match is missing.'),
  },
});

const updateFrame = createRoute({
  method: 'patch',
  path: '/{rollId}/frames/{frameId}',
  summary: "Change a frame's number or the version shown for it",
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

const deleteFrames = createRoute({
  method: 'delete',
  path: '/{rollId}/frames',
  summary: 'Delete many frames together',
  description:
    "As when frames are selected. Send the roll's ETag as If-Match: the delete is refused if the roll has changed since. The frames' files and JSON move into the archive's deleted/ folder; nothing is lost. Nothing is deleted if any frame isn't in the roll. The response's ETag is the roll's new version.",
  request: {
    params: rollParams,
    query: deleteFramesQuery,
    headers: ifMatchHeader,
  },
  responses: {
    204: { description: 'The frames were deleted.' },
    404: json(errorResponse, 'No such roll, or a frame not in it.'),
    409: json(errorResponse, 'The roll has changed since it was read.'),
    422: invalid,
    428: json(errorResponse, 'If-Match is missing.'),
  },
});

const deleteFrame = createRoute({
  method: 'delete',
  path: '/{rollId}/frames/{frameId}',
  summary: 'Delete a frame',
  description:
    "Send the roll's ETag as If-Match: the delete is refused if the roll has changed since. The frame's files and JSON move into the archive's deleted/ folder; nothing is lost. The response's ETag is the roll's new version.",
  request: { params: frameParams, headers: ifMatchHeader },
  responses: {
    204: { description: 'The frame was deleted.' },
    404: json(errorResponse, 'The roll has no frame with that ID.'),
    409: json(errorResponse, 'The roll has changed since it was read.'),
    422: invalid,
    428: json(errorResponse, 'If-Match is missing.'),
  },
});

const addVersion = createRoute({
  method: 'post',
  path: '/{rollId}/frames/{frameId}/versions',
  summary: 'Upload an image as a new version of a frame',
  description:
    'The body is the image itself: a lab scan, or another JPEG, PNG or WebP (U34). It is stored unchanged.',
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
    // Raws arrive as their own types, or none in particular; the signature decides.
    requireContentType(
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/tiff',
      'image/x-sony-arw',
      'application/octet-stream',
    ),
  ] as const,
  request: {
    params: frameParams,
    query: addVersionQuery,
    body: { required: true, ...versionImage('The image.') },
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

const updateVersion = createRoute({
  method: 'patch',
  path: '/{rollId}/frames/{frameId}/versions/{versionId}',
  summary: 'Turn a version',
  description:
    "Send the roll's ETag as If-Match: the change is refused if the roll has changed since. The version's file is never changed; only how it's shown. The response's ETag is the roll's new version.",
  middleware: [requireJson] as const,
  request: {
    params: versionParams,
    headers: ifMatchHeader,
    body: {
      required: true,
      content: { 'application/json': { schema: updateVersionRequest } },
    },
  },
  responses: {
    200: json(version, 'The updated version.'),
    400: malformed,
    404: json(errorResponse, 'The frame has no version with that ID.'),
    409: json(errorResponse, 'The roll has changed since it was read.'),
    415: wrongType,
    422: invalid,
    428: json(errorResponse, 'If-Match is missing.'),
  },
});

const getFrameDetails = createRoute({
  method: 'get',
  path: '/{rollId}/frames/{frameId}/details',
  summary: "Get a frame's resolved details",
  request: { params: frameParams },
  responses: {
    200: json(
      frameDetails,
      'The frame’s details, each with where it came from.',
    ),
    404: json(errorResponse, 'The roll has no frame with that ID.'),
    422: invalid,
  },
});

const deleteVersion = createRoute({
  method: 'delete',
  path: '/{rollId}/frames/{frameId}/versions/{versionId}',
  summary: 'Delete a version of a frame',
  description:
    "Send the roll's ETag as If-Match: the delete is refused if the roll has changed since. The version's files and JSON move into the archive's deleted/ folder; nothing is lost. A frame's only version can't be deleted: delete the frame instead. The response's ETag is the roll's new version.",
  request: { params: versionParams, headers: ifMatchHeader },
  responses: {
    204: { description: 'The version was deleted.' },
    404: json(errorResponse, 'The frame has no version with that ID.'),
    409: json(errorResponse, 'The roll has changed since it was read.'),
    422: invalid,
    428: json(errorResponse, 'If-Match is missing.'),
  },
});

const getOriginal = createRoute({
  method: 'get',
  path: '/{rollId}/frames/{frameId}/versions/{versionId}/file',
  summary: "Download a version's original file",
  request: { params: versionParams },
  responses: {
    200: versionImage('The original, unchanged.'),
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

/** A turn as the thumbnail's query gives it, in degrees. */
const turns = { '0': 0, '90': 90, '180': 180, '270': 270 } as const;

export interface RollUseCases {
  readonly createRoll: CreateRoll;
  readonly getRoll: GetRoll;
  readonly listRolls: ListRolls;
  readonly updateRoll: UpdateRoll;
  readonly deleteRoll: DeleteRoll;
  readonly createFrame: CreateFrame;
  readonly updateFrame: UpdateFrame;
  readonly updateVersion: UpdateVersion;
  readonly updateFrameNumbers: UpdateFrameNumbers;
  readonly updateFrames: UpdateFrames;
  readonly deleteFrame: DeleteFrame;
  readonly deleteFrames: DeleteFrames;
  readonly deleteVersion: DeleteVersion;
  readonly addVersion: AddVersion;
  readonly getFrameDetails: GetFrameDetails;
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

  routes.openapi(updateRoll, async (c) => {
    const { rollId } = c.req.valid('param');
    if (!isRollId(rollId)) {
      return c.json(notFound, 404);
    }
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the roll’s ETag as If-Match' }, 428);
    }
    const updated = await useCases.updateRoll.execute(ctx, {
      id: rollId,
      expectedVersion: versionFrom(ifMatch),
      ...c.req.valid('json'),
    });
    if (!updated.ok) {
      return domainErrorResponse(c, updated.error);
    }
    c.header('ETag', etagOf(updated.value.version));
    return c.json(rollDto(updated.value.roll), 200);
  });

  routes.openapi(deleteRoll, async (c) => {
    const { rollId } = c.req.valid('param');
    if (!isRollId(rollId)) {
      return c.json(notFound, 404);
    }
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the roll’s ETag as If-Match' }, 428);
    }
    const deleted = await useCases.deleteRoll.execute(ctx, {
      id: rollId,
      expectedVersion: versionFrom(ifMatch),
    });
    return deleted.ok
      ? c.body(null, 204)
      : domainErrorResponse(c, deleted.error);
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
      ? c.json(frameDto(created.value), 201)
      : domainErrorResponse(c, created.error);
  });

  routes.openapi(updateFrameNumbers, async (c) => {
    const { rollId } = c.req.valid('param');
    if (!isRollId(rollId)) {
      return c.json(notFound, 404);
    }
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the roll’s ETag as If-Match' }, 428);
    }
    const body = c.req.valid('json');
    const expectedVersion = versionFrom(ifMatch);
    const updated =
      'numbers' in body
        ? await useCases.updateFrameNumbers.execute(ctx, {
            rollId,
            expectedVersion,
            numbers: body.numbers.flatMap(({ frameId, number }) =>
              isFrameId(frameId) ? [{ frameId, number }] : [],
            ),
          })
        : await useCases.updateFrames.execute(ctx, {
            rollId,
            expectedVersion,
            ...body,
          });
    if (!updated.ok) {
      return domainErrorResponse(c, updated.error);
    }
    c.header('ETag', etagOf(updated.value.version));
    return c.json(rollDto(updated.value.roll), 200);
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
      ...c.req.valid('json'),
    });
    if (!updated.ok) {
      return domainErrorResponse(c, updated.error);
    }
    c.header('ETag', etagOf(updated.value.version));
    return c.json(frameDto(updated.value.frame), 200);
  });

  routes.openapi(deleteFrames, async (c) => {
    const { rollId } = c.req.valid('param');
    if (!isRollId(rollId)) {
      return c.json(notFound, 404);
    }
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the roll’s ETag as If-Match' }, 428);
    }
    const deleted = await useCases.deleteFrames.execute(ctx, {
      rollId,
      frameIds: c.req.valid('query').frameIds.split(','),
      expectedVersion: versionFrom(ifMatch),
    });
    if (!deleted.ok) {
      return domainErrorResponse(c, deleted.error);
    }
    c.header('ETag', etagOf(deleted.value.version));
    return c.body(null, 204);
  });

  routes.openapi(deleteFrame, async (c) => {
    const { rollId, frameId } = c.req.valid('param');
    if (!isRollId(rollId) || !isFrameId(frameId)) {
      return c.json(notFound, 404);
    }
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the roll’s ETag as If-Match' }, 428);
    }
    const deleted = await useCases.deleteFrame.execute(ctx, {
      rollId,
      frameId,
      expectedVersion: versionFrom(ifMatch),
    });
    if (!deleted.ok) {
      return domainErrorResponse(c, deleted.error);
    }
    c.header('ETag', etagOf(deleted.value.version));
    return c.body(null, 204);
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
      kind: c.req.valid('query').kind,
      bytes: new Uint8Array(await c.req.arrayBuffer()),
    });
    return added.ok
      ? c.json(versionDto(added.value), 201)
      : domainErrorResponse(c, added.error);
  });

  routes.openapi(deleteVersion, async (c) => {
    const { rollId, frameId, versionId } = c.req.valid('param');
    if (!isRollId(rollId) || !isFrameId(frameId) || !isVersionId(versionId)) {
      return c.json(notFound, 404);
    }
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the roll’s ETag as If-Match' }, 428);
    }
    const deleted = await useCases.deleteVersion.execute(ctx, {
      rollId,
      frameId,
      versionId,
      expectedVersion: versionFrom(ifMatch),
    });
    if (!deleted.ok) {
      return domainErrorResponse(c, deleted.error);
    }
    c.header('ETag', etagOf(deleted.value.version));
    return c.body(null, 204);
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
          // As its bytes show it to be, whatever its name says.
          'Content-Type':
            imageTypeOf(original.value) ?? 'application/octet-stream',
        })
      : domainErrorResponse(c, original.error);
  });

  routes.openapi(getFrameDetails, async (c) => {
    const { rollId, frameId } = c.req.valid('param');
    if (!isRollId(rollId) || !isFrameId(frameId)) {
      return c.json(notFound, 404);
    }
    const details = await useCases.getFrameDetails.execute(ctx, {
      rollId,
      frameId,
    });
    return details.ok
      ? c.json(frameDetailsDto(details.value), 200)
      : domainErrorResponse(c, details.error);
  });

  routes.openapi(updateVersion, async (c) => {
    const { rollId, frameId, versionId } = c.req.valid('param');
    if (!isRollId(rollId) || !isFrameId(frameId) || !isVersionId(versionId)) {
      return c.json(notFound, 404);
    }
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the roll’s ETag as If-Match' }, 428);
    }
    const updated = await useCases.updateVersion.execute(ctx, {
      rollId,
      frameId,
      versionId,
      expectedVersion: versionFrom(ifMatch),
      ...c.req.valid('json'),
    });
    if (!updated.ok) {
      return domainErrorResponse(c, updated.error);
    }
    c.header('ETag', etagOf(updated.value.version));
    return c.json(versionDto(updated.value.updated), 200);
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
      rotate: turns[c.req.valid('query').rotate],
    });
    return thumbnail.ok
      ? c.body(new Uint8Array(thumbnail.value), 200, {
          'Content-Type': 'image/webp',
        })
      : domainErrorResponse(c, thumbnail.error);
  });

  return routes;
}
