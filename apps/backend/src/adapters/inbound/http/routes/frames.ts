import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { invalidRequestResponse } from '@filmfile/contracts/errors';
import {
  frameSelection,
  searchFramesResponse,
} from '@filmfile/contracts/selections';
import type { SearchFrames } from '../../../../application/use-cases/selections/search-frames.ts';
import type {
  FrameRef,
  Rule,
  Selection,
} from '../../../../domain/selections/selection.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { isFrameId, isRollId } from '../../../../domain/shared/ids.ts';
import { isSlug, type Slug } from '../../../../domain/shared/slug.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';

const searchFrames = createRoute({
  method: 'post',
  path: '/search',
  summary: 'Find the frames on a selection',
  description:
    'Works out, from the archive as it is now, which frames meet the rules (and are pinned, and not left off), in shot order. Nothing is saved.',
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

type Body = (typeof frameSelection)['_output'];

/** The request's selection as the domain's, or undefined if an ID or slug is malformed. */
function selectionOf(body: Body): Selection | undefined {
  const slugs = (values: readonly string[]): Slug[] | undefined =>
    values.every(isSlug) ? values.filter(isSlug) : undefined;
  const refs = (list: Body['pinned']): FrameRef[] | undefined => {
    const out: FrameRef[] = [];
    for (const { rollId, frameId } of list) {
      if (!isRollId(rollId) || !isFrameId(frameId)) {
        return undefined;
      }
      out.push({ rollId, frameId });
    }
    return out;
  };
  const rules: Rule[] = [];
  for (const rule of body.rules) {
    switch (rule.kind) {
      case 'rating':
      case 'shot-after':
      case 'shot-before':
      case 'has':
        rules.push(rule);
        break;
      case 'roll': {
        if (!rule.rolls.every(isRollId)) {
          return undefined;
        }
        rules.push({ kind: 'roll', rolls: rule.rolls.filter(isRollId) });
        break;
      }
      case 'event': {
        const events = slugs(rule.events);
        if (events === undefined) {
          return undefined;
        }
        rules.push({ kind: 'event', events });
        break;
      }
      case 'camera': {
        const cameras = slugs(rule.cameras);
        if (cameras === undefined) {
          return undefined;
        }
        rules.push({ kind: 'camera', cameras });
        break;
      }
      case 'lens': {
        const lenses = slugs(rule.lenses);
        if (lenses === undefined) {
          return undefined;
        }
        rules.push({ kind: 'lens', lenses });
        break;
      }
      case 'film': {
        const films = slugs(rule.films);
        if (films === undefined) {
          return undefined;
        }
        rules.push({ kind: 'film', films });
        break;
      }
    }
  }
  const pinned = refs(body.pinned);
  const hidden = refs(body.hidden);
  return pinned === undefined || hidden === undefined
    ? undefined
    : { rules, pinned, hidden };
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
    return c.json({ count: found.length, frames: [...found] }, 200);
  });

  return routes;
}
