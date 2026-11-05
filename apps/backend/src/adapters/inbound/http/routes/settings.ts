import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  createSettingsRequest,
  settings,
  settingsIfMatchHeader,
  updateSettingsRequest,
} from '@filmfile/contracts/settings';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import type { GetSettings } from '../../../../application/use-cases/settings/get-settings.ts';
import type { InitialiseSettings } from '../../../../application/use-cases/settings/initialise-settings.ts';
import type { UpdateSettings } from '../../../../application/use-cases/settings/update-settings.ts';
import type { Settings } from '../../../../domain/settings/settings.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { etagOf, versionFrom } from '../etag.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';

function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

const requireJson = requireContentType('application/json');

const getSettingsRoute = createRoute({
  method: 'get',
  path: '/',
  summary: "Get FilmFile's settings",
  description:
    "The response's ETag is the settings' version, for If-Match. It also says where the FilmFile folder is, read-only.",
  responses: {
    200: json(settings, 'The settings.'),
    404: json(errorResponse, "FilmFile isn't set up yet."),
  },
});

const initialiseSettingsRoute = createRoute({
  method: 'post',
  path: '/',
  summary: 'Set FilmFile up',
  middleware: [requireJson] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: createSettingsRequest } },
    },
  },
  responses: {
    201: json(settings, 'The settings, set up.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    409: json(errorResponse, 'FilmFile is already set up.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(invalidRequestResponse, 'The request is invalid.'),
  },
});

const updateSettingsRoute = createRoute({
  method: 'patch',
  path: '/',
  summary: 'Change the author or copyright',
  description:
    "Send the settings' ETag as If-Match: the change is refused if they have changed since. The response's ETag is their new version.",
  middleware: [requireJson] as const,
  request: {
    headers: settingsIfMatchHeader,
    body: {
      required: true,
      content: { 'application/json': { schema: updateSettingsRequest } },
    },
  },
  responses: {
    200: json(settings, 'The settings, changed.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    404: json(errorResponse, "FilmFile isn't set up yet."),
    409: json(errorResponse, 'The settings have changed since they were read.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(invalidRequestResponse, 'The request is invalid.'),
    428: json(errorResponse, 'If-Match is missing.'),
  },
});

export interface SettingsUseCases {
  readonly getSettings: GetSettings;
  readonly initialiseSettings: InitialiseSettings;
  readonly updateSettings: UpdateSettings;
}

/**
 * FilmFile's settings: set up once, then changed (D43, D65). Each answer
 * says where the FilmFile folder is, from the service's own settings: it's
 * not stored, and nothing sent can change it (D64).
 */
export function settingsRoutes({
  ctx,
  useCases,
  folderPath,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: SettingsUseCases;
  readonly folderPath: string;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });

  /** The settings as the API gives them, with the FilmFile folder's path. */
  function dto(stored: Settings) {
    return { ...stored, folder: folderPath };
  }

  routes.openapi(getSettingsRoute, async (c) => {
    const found = await useCases.getSettings.execute(ctx);
    if (!found.ok) {
      return domainErrorResponse(c, found.error);
    }
    c.header('ETag', etagOf(found.value.version));
    return c.json(dto(found.value.settings), 200);
  });

  routes.openapi(initialiseSettingsRoute, async (c) => {
    const created = await useCases.initialiseSettings.execute(
      ctx,
      c.req.valid('json'),
    );
    return created.ok
      ? c.json(dto(created.value), 201)
      : domainErrorResponse(c, created.error);
  });

  routes.openapi(updateSettingsRoute, async (c) => {
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the settings’ ETag as If-Match' }, 428);
    }
    const updated = await useCases.updateSettings.execute(ctx, {
      expectedVersion: versionFrom(ifMatch),
      ...c.req.valid('json'),
    });
    if (!updated.ok) {
      return domainErrorResponse(c, updated.error);
    }
    c.header('ETag', etagOf(updated.value.version));
    return c.json(dto(updated.value.settings), 200);
  });

  return routes;
}
