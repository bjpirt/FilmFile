import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { invalidRequestResponse } from '@filmfile/contracts/errors';
import {
  searchFramesRequest,
  searchFramesResponse,
} from '@filmfile/contracts/selections';
import type {
  FoundFrame,
  SearchFrames,
} from '../../../../application/use-cases/selections/search-frames.ts';
import { groupPhotos } from '../../../../domain/sites/group-photos.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';
import { selectionOf } from './selection-body.ts';

const searchFrames = createRoute({
  method: 'post',
  path: '/search',
  summary: 'Find the frames on a selection',
  description:
    'Works out, from the archive as it is now, which frames meet the rules, in shot order, each marked if it is excluded by hand, and grouped by roll or event if asked; the count leaves the excluded out. Nothing is saved.',
  middleware: [requireContentType('application/json')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: searchFramesRequest } },
    },
  },
  responses: {
    200: {
      description: 'The matching frames and their count.',
      content: { 'application/json': { schema: searchFramesResponse } },
    },
    422: {
      description: 'The request is invalid.',
      content: { 'application/json': { schema: invalidRequestResponse } },
    },
  },
});

export interface FrameSelectionUseCases {
  readonly searchFrames: SearchFrames;
}

/** A found frame as the API gives it. */
const refOf = ({ rollId, frameId, excluded }: FoundFrame) => ({
  rollId,
  frameId,
  excluded,
});

/** Finding frames by rules (D93). */
export function frameRoutes({
  ctx,
  useCases,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: FrameSelectionUseCases;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });

  routes.openapi(searchFrames, async (c) => {
    const { groupBy, ...body } = c.req.valid('json');
    const selection = selectionOf(body);
    if (selection === undefined) {
      return c.json(
        {
          error: 'invalid request' as const,
          issues: [{ path: [], message: 'an ID or slug is malformed' }],
        },
        422,
      );
    }
    const found = await useCases.searchFrames.execute(ctx, { selection });
    const count = found.filter((frame) => !frame.excluded).length;
    const frames = found.map(refOf);
    if (groupBy === undefined) {
      return c.json({ count, frames }, 200);
    }
    const groups = groupPhotos(found, groupBy).map(({ label, photos }) => ({
      key: label?.key ?? '',
      heading: label?.heading ?? '',
      ...(label?.detail === undefined ? {} : { detail: label.detail }),
      frames: photos.map(refOf),
    }));
    return c.json({ count, frames, groups }, 200);
  });

  return routes;
}
