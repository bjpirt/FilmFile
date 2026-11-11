import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  folderExportParams,
  folderExportRequest,
  folderExportStatus,
  quickExport,
  quickExportParams,
  quickExportRequest,
  startedFolderExport,
} from '@filmfile/contracts/exports';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import type { FolderExports } from '../../../../application/use-cases/exports/folder-exports.ts';
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
  summary: 'Prepare to download frames as a JPEG or a zip, once',
  description:
    'Checks what is to be exported and gives a single-use address to download it from. Nothing is written to disk.',
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
      'The request is invalid, a file name pattern has a {placeholder} that is not one, or a JPEG is asked of a frame that is hidden or has no scan.',
    ),
  },
});

const downloadQuickExport = createRoute({
  method: 'get',
  path: '/quick/{ticket}',
  summary: 'Download a prepared export',
  description:
    'Makes the JPEG, or the zip as a stream, and sends it as a download. The address works once.',
  request: { params: quickExportParams },
  responses: {
    200: {
      description:
        'The JPEG named for the frame, or the zip named for the roll, as an attachment.',
      content: {
        'image/jpeg': { schema: z.string().meta({ format: 'binary' }) },
        'application/zip': { schema: z.string().meta({ format: 'binary' }) },
      },
    },
    404: json(errorResponse, 'The address is unknown, used or has expired.'),
  },
});

/**
 * A download's name for the browser: an ASCII fallback, and the real name,
 * which can have spaces and other letters, percent-encoded as RFC 6266 says.
 */
function attachment(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\%]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * The parts as a stream read one at a time, as the download is: a part is
 * made only when it's asked for, and a download that's cancelled stops the
 * rest being made.
 */
function streamOf(
  parts: AsyncIterable<Uint8Array>,
): ReadableStream<Uint8Array> {
  const iterator = parts[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();
      if (next.done === true) {
        controller.close();
      } else {
        controller.enqueue(next.value);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

const startFolderExport = createRoute({
  method: 'post',
  path: '/folder',
  summary: 'Write frames into a folder chosen in the desktop app',
  description:
    "Only when the service was started by the desktop app (the health response says so). The app asks for a folder with its own dialog, and the service writes the JPEGs there itself, as the layout and file names say, never replacing a file that's there. The request answers once the folder is chosen, with an export to follow, or with none if the person cancelled.",
  middleware: [requireContentType('application/json')] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: folderExportRequest } },
    },
  },
  responses: {
    200: json(
      startedFolderExport,
      'The export started, or the person cancelled.',
    ),
    404: json(errorResponse, 'No such roll or frame.'),
    422: json(
      invalidRequestResponse,
      'The request is invalid, or the service has no desktop app to ask.',
    ),
  },
});

const getFolderExport = createRoute({
  method: 'get',
  path: '/folder/{job}',
  summary: 'How far an export into a folder has got',
  request: { params: folderExportParams },
  responses: {
    200: json(folderExportStatus, 'Where the export has got to.'),
    404: json(errorResponse, 'No such export.'),
  },
});

const cancelFolderExport = createRoute({
  method: 'delete',
  path: '/folder/{job}',
  summary: 'Stop an export into a folder',
  description: 'Stops after the file in progress. What has been written stays.',
  request: { params: folderExportParams },
  responses: {
    204: { description: 'Asked to stop.' },
    404: json(errorResponse, 'No such export.'),
  },
});

export interface ExportUseCases {
  readonly folderExports: FolderExports;
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
    const { frames, size, quality, metadata, output, layout, fileNames, name } =
      c.req.valid('json');
    const wanted = [];
    for (const { rollId, frameId } of frames) {
      if (!isRollId(rollId) || !isFrameId(frameId)) {
        return c.json({ error: 'not found' }, 404);
      }
      wanted.push({ rollId, frameId });
    }
    const prepared = await useCases.prepareQuickExport.execute(ctx, {
      frames: wanted,
      recipe: { longestEdge: size, quality, metadata },
      output,
      naming: { layout, pattern: fileNames },
      name,
    });
    return prepared.ok
      ? c.json({ url: `/api/exports/quick/${prepared.value}` }, 201)
      : domainErrorResponse(c, prepared.error);
  });

  routes.openapi(downloadQuickExport, async (c) => {
    const made = await useCases.makeQuickExport.execute(ctx, {
      ticket: c.req.valid('param').ticket,
    });
    if (!made.ok) {
      return domainErrorResponse(c, made.error);
    }
    const headers = {
      'Content-Disposition': attachment(made.value.fileName),
      'Cache-Control': 'no-store',
    };
    return made.value.kind === 'jpeg'
      ? c.body(new Uint8Array(made.value.jpeg), 200, {
          ...headers,
          'Content-Type': 'image/jpeg',
        })
      : c.body(streamOf(made.value.parts), 200, {
          ...headers,
          'Content-Type': 'application/zip',
        });
  });

  routes.openapi(startFolderExport, async (c) => {
    const { frames, size, quality, metadata, layout, fileNames, name } =
      c.req.valid('json');
    const wanted = [];
    for (const { rollId, frameId } of frames) {
      if (!isRollId(rollId) || !isFrameId(frameId)) {
        return c.json({ error: 'not found' }, 404);
      }
      wanted.push({ rollId, frameId });
    }
    const started = await useCases.folderExports.start(ctx, {
      frames: wanted,
      recipe: { longestEdge: size, quality, metadata },
      naming: { layout, pattern: fileNames },
      name,
    });
    return started.ok
      ? c.json({ job: started.value ?? null }, 200)
      : domainErrorResponse(c, started.error);
  });

  routes.openapi(getFolderExport, (c) => {
    const status = useCases.folderExports.status(c.req.valid('param').job);
    return status.ok
      ? c.json(status.value, 200)
      : domainErrorResponse(c, status.error);
  });

  routes.openapi(cancelFolderExport, (c) => {
    const cancelled = useCases.folderExports.cancel(c.req.valid('param').job);
    return cancelled.ok
      ? c.body(null, 204)
      : domainErrorResponse(c, cancelled.error);
  });

  return routes;
}
