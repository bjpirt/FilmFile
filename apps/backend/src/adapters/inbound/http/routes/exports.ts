import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  quickExport,
  quickExportParams,
  quickExportRequest,
} from '@filmfile/contracts/exports';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import type { MakeQuickExport } from '../../../../application/use-cases/exports/make-quick-export.ts';
import type { PrepareQuickExport } from '../../../../application/use-cases/exports/prepare-quick-export.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { isFrameId, isRollId } from '../../../../domain/shared/ids.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';

function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

const prepareQuickExport = createRoute({
  method: 'post',
  path: '/quick',
  summary: 'Prepare to download a frame as a JPEG, once',
  description:
    'Checks the frame can be exported and gives a single-use address to download it from. Nothing is written to disk.',
  middleware: [requireContentType('application/json')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: quickExportRequest } },
    },
  },
  responses: {
    201: json(quickExport, 'Where to download the file from, once.'),
    404: json(errorResponse, 'No such roll or frame.'),
    422: json(
      invalidRequestResponse,
      'The request is invalid, the frame is hidden, or it has no scan to export.',
    ),
  },
});

const downloadQuickExport = createRoute({
  method: 'get',
  path: '/quick/{ticket}',
  summary: 'Download a prepared export',
  description:
    'Makes the JPEG and sends it as a download. The address works once.',
  request: { params: quickExportParams },
  responses: {
    200: {
      description: 'The JPEG, as an attachment named for the frame.',
      content: {
        'image/jpeg': { schema: z.string().meta({ format: 'binary' }) },
      },
    },
    404: json(errorResponse, 'The address is unknown, used or has expired.'),
  },
});

export interface ExportUseCases {
  readonly prepareQuickExport: PrepareQuickExport;
  readonly makeQuickExport: MakeQuickExport;
}

/** Exports made once and downloaded (D95). */
export function exportRoutes({
  ctx,
  useCases,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: ExportUseCases;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });

  routes.openapi(prepareQuickExport, async (c) => {
    const { frames, size, quality } = c.req.valid('json');
    const [frame] = frames;
    if (frame === undefined) {
      return c.json({ error: 'not found' }, 404);
    }
    const { rollId, frameId } = frame;
    if (!isRollId(rollId) || !isFrameId(frameId)) {
      return c.json({ error: 'not found' }, 404);
    }
    const prepared = await useCases.prepareQuickExport.execute(ctx, {
      rollId,
      frameId,
      recipe: { longestEdge: size, quality },
    });
    return prepared.ok
      ? c.json({ url: `/api/exports/quick/${prepared.value}` }, 201)
      : domainErrorResponse(c, prepared.error);
  });

  routes.openapi(downloadQuickExport, async (c) => {
    const made = await useCases.makeQuickExport.execute(ctx, {
      ticket: c.req.valid('param').ticket,
    });
    return made.ok
      ? c.body(new Uint8Array(made.value.jpeg), 200, {
          'Content-Type': 'image/jpeg',
          // The name is only letters, digits, dots and dashes (exportFileName).
          'Content-Disposition': `attachment; filename="${made.value.fileName}"`,
          'Cache-Control': 'no-store',
        })
      : domainErrorResponse(c, made.error);
  });

  return routes;
}
