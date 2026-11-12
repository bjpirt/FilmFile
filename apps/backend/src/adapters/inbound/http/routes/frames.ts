import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { invalidRequestResponse } from '@filmfile/contracts/errors';
import {
  frameSelection,
  searchFramesResponse,
} from '@filmfile/contracts/selections';
import type { SearchFrames } from '../../../../application/use-cases/selections/search-frames.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';
import { selectionOf } from './selection-body.ts';

const searchFrames = createRoute({
  method: 'post',
  path: '/search',
  summary: 'Find the frames on a selection',
  description:
    'Works out, from the archive as it is now, which frames meet the rules, in shot order, each marked if it is excluded by hand; the count leaves the excluded out. Nothing is saved.',
  middleware: [requireContentType('application/json')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: frameSelection } },
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
    const selection = selectionOf(c.req.valid('json'));
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
    return c.json({ count, frames: [...found] }, 200);
  });

  return routes;
}
