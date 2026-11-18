import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import {
  answerRemovalsRequest,
  saveSyncSettingsRequest,
  syncProgress,
  syncSettings,
  syncStatus,
} from '@filmfile/contracts/sync';
import type { GetSyncSettings } from '../../../../application/use-cases/sync/get-sync-settings.ts';
import type { LibrarySync } from '../../../../application/use-cases/sync/library-sync.ts';
import type { SaveSyncSettings } from '../../../../application/use-cases/sync/save-sync-settings.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';

function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

const requireJson = requireContentType('application/json');

const getSettings = createRoute({
  method: 'get',
  path: '/settings',
  summary: "This computer's sync settings",
  description:
    'Kept by the desktop app for this computer, never in the FilmFile folder (D120). Without the app, available is false.',
  responses: { 200: json(syncSettings, 'The settings.') },
});

const putSettings = createRoute({
  method: 'put',
  path: '/settings',
  summary: "Set this computer's bucket and name",
  description:
    'A different bucket forgets the last sync, which was the other bucket’s.',
  middleware: [requireJson] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: saveSyncSettingsRequest } },
    },
  },
  responses: {
    200: json(syncSettings, 'The settings, saved.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(
      invalidRequestResponse,
      'A field is not valid, or sync is not available here.',
    ),
  },
});

const getStatus = createRoute({
  method: 'get',
  path: '/',
  summary: 'How syncing stands',
  description:
    'Whether a sync can be started, when this computer last finished one, and how the latest sync since the service started went.',
  responses: { 200: json(syncStatus, 'How it stands.') },
});

const startSync = createRoute({
  method: 'post',
  path: '/',
  summary: 'Sync the library',
  description:
    'Starts backing the library up in the background (D117): claims an empty bucket for it, sends what is new or changed since the last sync, then writes the manifest and sync record. Follow it with the status. A sync already running is followed instead of started again.',
  responses: {
    202: json(syncProgress, 'The sync, running.'),
    422: json(
      invalidRequestResponse,
      'Sync is not available here, or no Cloudflare account or bucket is set.',
    ),
  },
});

const cancelSync = createRoute({
  method: 'delete',
  path: '/',
  summary: 'Stop syncing',
  description:
    'The uploads going are cut off and no more start; the sync reads stopping until they have. The bucket’s sync record stays as it was. Asking again while it stops is no failure.',
  responses: {
    204: { description: 'Asked to stop.' },
    422: json(invalidRequestResponse, 'No sync is running.'),
  },
});

const answerRemovals = createRoute({
  method: 'post',
  path: '/removals',
  summary: 'Say whether to remove files gone from the library',
  description:
    'Answers a sync waiting to remove files from the bucket that are gone from the library and that no roll.json mentions (FF-238, D123). Either way the sync carries on.',
  middleware: [requireJson] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: answerRemovalsRequest } },
    },
  },
  responses: {
    204: { description: 'Answered.' },
    400: json(errorResponse, 'The body is not valid JSON.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(
      invalidRequestResponse,
      'The body is not valid, or no sync is waiting for an answer.',
    ),
  },
});

export interface SyncUseCases {
  readonly getSyncSettings: GetSyncSettings;
  readonly saveSyncSettings: SaveSyncSettings;
  readonly librarySync: LibrarySync;
}

/** Backing up and syncing the library (FF-225, D115–D120). */
export function syncRoutes({
  ctx,
  useCases,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: SyncUseCases;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });

  routes.openapi(getSettings, async (c) =>
    c.json(await useCases.getSyncSettings.execute(), 200),
  );

  routes.openapi(putSettings, async (c) => {
    const saved = await useCases.saveSyncSettings.execute(c.req.valid('json'));
    return saved.ok
      ? c.json(await useCases.getSyncSettings.execute(), 200)
      : domainErrorResponse(c, saved.error);
  });

  routes.openapi(getStatus, async (c) =>
    c.json(await useCases.librarySync.status(ctx), 200),
  );

  routes.openapi(startSync, async (c) => {
    const started = await useCases.librarySync.start(ctx);
    return started.ok
      ? c.json(started.value, 202)
      : domainErrorResponse(c, started.error);
  });

  routes.openapi(cancelSync, (c) => {
    const cancelled = useCases.librarySync.cancel();
    return cancelled.ok
      ? c.body(null, 204)
      : domainErrorResponse(c, cancelled.error);
  });

  routes.openapi(answerRemovals, (c) => {
    const answered = useCases.librarySync.answer(c.req.valid('json').remove);
    return answered.ok
      ? c.body(null, 204)
      : domainErrorResponse(c, answered.error);
  });

  return routes;
}
