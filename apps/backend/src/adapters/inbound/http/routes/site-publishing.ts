import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import {
  publishFailedResponse,
  sitePublished,
  sitePublishProgress,
  siteParams,
} from '@filmfile/contracts/sites';
import type { SitePublishes } from '../../../../application/use-cases/sites/site-publishes.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { isSlug } from '../../../../domain/shared/slug.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';

function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

const getPublished = createRoute({
  method: 'get',
  path: '/{slug}/published',
  summary: 'How a site stands in its bucket',
  description:
    "Lists the bucket and compares it with the built site by path, size and MD5: whether it is published, up to date or has files to update, when it was published, and how the latest publish went. Needs the site's publish target. When the bucket cannot be asked (no keys in the [filmfile] profile of ~/.aws/credentials, keys refused, no such bucket, unreachable) it still answers, with stands unknown and why in check, so how the latest publish went can be read.",
  request: { params: siteParams },
  responses: {
    200: json(sitePublished, 'Where the bucket stands.'),
    404: json(errorResponse, 'There is no site with that slug.'),
    422: json(invalidRequestResponse, 'The site has no publish target.'),
  },
});

const startPublish = createRoute({
  method: 'post',
  path: '/{slug}/publish',
  summary: 'Publish a site',
  description:
    'Starts publishing in the background: builds the site first when it is not built or is out of date, then uploads only the files that are missing or differ (images first, then pages, CSS and script) and removes what the site no longer has. Follow it with the published status. A publish already running is followed instead of started again.',
  request: { params: siteParams },
  responses: {
    202: json(sitePublishProgress, 'The publish, running.'),
    404: json(errorResponse, 'There is no site with that slug.'),
    409: json(
      errorResponse,
      'The site is being built or unpublished, so it can not be published now.',
    ),
    422: json(invalidRequestResponse, 'The site has no publish target.'),
  },
});

const cancelPublish = createRoute({
  method: 'delete',
  path: '/{slug}/publish',
  summary: 'Stop publishing a site',
  description:
    'No more files are started and those already going finish. Nothing already uploaded is taken back.',
  request: { params: siteParams },
  responses: {
    204: { description: 'Asked to stop.' },
    404: json(errorResponse, 'That site is not being published.'),
  },
});

const unpublish = createRoute({
  method: 'delete',
  path: '/{slug}/published',
  summary: 'Unpublish a site',
  description:
    "Removes every file in the site's bucket, which is used only for the site. Nothing else is touched.",
  request: { params: siteParams },
  responses: {
    204: { description: 'The bucket is empty.' },
    404: json(errorResponse, 'There is no site with that slug.'),
    409: json(
      errorResponse,
      'The site is being built, published or unpublished.',
    ),
    422: json(
      invalidRequestResponse,
      'The site has no publish target, or nothing is published.',
    ),
    502: json(
      publishFailedResponse,
      'The bucket could not be reached or used: no keys, keys refused, no such bucket, or unreachable.',
    ),
  },
});

export interface SitePublishUseCases {
  readonly sitePublishes: SitePublishes;
}

/** Putting a site on the web, and taking it down (FF-201, D111). */
export function sitePublishingRoutes({
  ctx,
  useCases,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: SitePublishUseCases;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });
  const notFound = { error: 'not found' };

  routes.openapi(getPublished, async (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const status = await useCases.sitePublishes.status(ctx, { slug });
    return status.ok
      ? c.json(status.value, 200)
      : domainErrorResponse(c, status.error);
  });

  routes.openapi(startPublish, async (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const started = await useCases.sitePublishes.start(ctx, { slug });
    return started.ok
      ? c.json(started.value, 202)
      : domainErrorResponse(c, started.error);
  });

  routes.openapi(cancelPublish, (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const cancelled = useCases.sitePublishes.cancel({ slug });
    return cancelled.ok
      ? c.body(null, 204)
      : domainErrorResponse(c, cancelled.error);
  });

  routes.openapi(unpublish, async (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const removed = await useCases.sitePublishes.unpublish(ctx, { slug });
    return removed.ok
      ? c.body(null, 204)
      : domainErrorResponse(c, removed.error);
  });

  return routes;
}
