import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  archive,
  archiveIfMatchHeader,
  createArchiveRequest,
  updateArchiveRequest,
} from '@filmfile/contracts/archive';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import type { GetArchive } from '../../../../application/use-cases/archive/get-archive.ts';
import type { InitialiseArchive } from '../../../../application/use-cases/archive/initialise-archive.ts';
import type { UpdateArchive } from '../../../../application/use-cases/archive/update-archive.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { etagOf, versionFrom } from '../etag.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';

function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

const requireJson = requireContentType('application/json');

const getArchive = createRoute({
  method: 'get',
  path: '/',
  summary: "Get the archive's details",
  description: "The response's ETag is the archive's version, for If-Match.",
  responses: {
    200: json(archive, "The archive's details."),
    404: json(errorResponse, "The archive isn't set up yet."),
  },
});

const initialiseArchive = createRoute({
  method: 'post',
  path: '/',
  summary: 'Set the archive up',
  middleware: [requireJson] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: createArchiveRequest } },
    },
  },
  responses: {
    201: json(archive, 'The archive, set up.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    409: json(errorResponse, 'The archive is already set up.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(invalidRequestResponse, 'The request is invalid.'),
  },
});

const updateArchive = createRoute({
  method: 'patch',
  path: '/',
  summary: "Change the archive's name, author or copyright",
  description:
    "Send the archive's ETag as If-Match: the change is refused if the archive has changed since. The response's ETag is the archive's new version.",
  middleware: [requireJson] as const,
  request: {
    headers: archiveIfMatchHeader,
    body: {
      required: true,
      content: { 'application/json': { schema: updateArchiveRequest } },
    },
  },
  responses: {
    200: json(archive, 'The archive, changed.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    404: json(errorResponse, "The archive isn't set up yet."),
    409: json(errorResponse, 'The archive has changed since it was read.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(invalidRequestResponse, 'The request is invalid.'),
    428: json(errorResponse, 'If-Match is missing.'),
  },
});

export interface ArchiveUseCases {
  readonly getArchive: GetArchive;
  readonly initialiseArchive: InitialiseArchive;
  readonly updateArchive: UpdateArchive;
}

/** The archive's own details: set up once, then changed (D43). */
export function archiveRoutes({
  ctx,
  useCases,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: ArchiveUseCases;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });

  routes.openapi(getArchive, async (c) => {
    const found = await useCases.getArchive.execute(ctx);
    if (!found.ok) {
      return domainErrorResponse(c, found.error);
    }
    c.header('ETag', etagOf(found.value.version));
    return c.json(found.value.archive, 200);
  });

  routes.openapi(initialiseArchive, async (c) => {
    const created = await useCases.initialiseArchive.execute(
      ctx,
      c.req.valid('json'),
    );
    return created.ok
      ? c.json(created.value, 201)
      : domainErrorResponse(c, created.error);
  });

  routes.openapi(updateArchive, async (c) => {
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the archive’s ETag as If-Match' }, 428);
    }
    const updated = await useCases.updateArchive.execute(ctx, {
      expectedVersion: versionFrom(ifMatch),
      ...c.req.valid('json'),
    });
    if (!updated.ok) {
      return domainErrorResponse(c, updated.error);
    }
    c.header('ETag', etagOf(updated.value.version));
    return c.json(updated.value.archive, 200);
  });

  return routes;
}
