import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  errorResponse,
  invalidRequestResponse,
} from '@filmfile/contracts/errors';
import {
  createSiteRequest,
  site,
  siteIfMatchHeader,
  siteBuildProgress,
  siteBuildQuery,
  siteList,
  siteParams,
  siteStatus,
  updateSiteRequest,
} from '@filmfile/contracts/sites';
import type { VersionedSite } from '../../../../application/ports/site-repository.ts';
import type { CreateSite } from '../../../../application/use-cases/sites/create-site.ts';
import type { DeleteSite } from '../../../../application/use-cases/sites/delete-site.ts';
import type { GetSite } from '../../../../application/use-cases/sites/get-site.ts';
import type { ListSites } from '../../../../application/use-cases/sites/list-sites.ts';
import type { SiteBuilds } from '../../../../application/use-cases/sites/site-builds.ts';
import type { UpdateSite } from '../../../../application/use-cases/sites/update-site.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { isSlug } from '../../../../domain/shared/slug.ts';
import { domainErrorResponse } from '../domain-error-response.ts';
import { etagOf, versionFrom } from '../etag.ts';
import { requireContentType } from '../middleware/require-content-type.ts';
import { invalidRequestHook } from './invalid-request-hook.ts';
import { selectionBody, selectionOf } from './selection-body.ts';

function json<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { 'application/json': { schema } } };
}

const requireJson = requireContentType('application/json');

const listSites = createRoute({
  method: 'get',
  path: '/',
  summary: 'List the sites',
  responses: {
    200: json(
      siteList,
      'Every site by name, each with how many frames are on it now.',
    ),
  },
});

const createSite = createRoute({
  method: 'post',
  path: '/',
  summary: 'Add a site',
  description:
    "A new site has no rules, so every frame is on it. The response's ETag is the site's version.",
  middleware: [requireJson] as const,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: createSiteRequest } },
    },
  },
  responses: {
    201: json(site, 'The new site.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    409: json(errorResponse, 'A site with the same slug already exists.'),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(invalidRequestResponse, 'The request is invalid.'),
  },
});

const getSite = createRoute({
  method: 'get',
  path: '/{slug}',
  summary: 'Get a site',
  description: "The response's ETag is the site's version, for If-Match.",
  request: { params: siteParams },
  responses: {
    200: json(site, 'The site.'),
    404: json(errorResponse, 'There is no site with that slug.'),
    422: json(invalidRequestResponse, 'The slug is not a slug.'),
  },
});

const updateSite = createRoute({
  method: 'patch',
  path: '/{slug}',
  summary: "Change a site's name or selection",
  description:
    "Send the site's ETag as If-Match: the change is refused if the site has changed since. A new name makes a new slug, and the response says what it is. The response's ETag is the site's new version.",
  middleware: [requireJson] as const,
  request: {
    params: siteParams,
    headers: siteIfMatchHeader,
    body: {
      required: true,
      content: { 'application/json': { schema: updateSiteRequest } },
    },
  },
  responses: {
    200: json(site, 'The updated site.'),
    400: json(errorResponse, 'The body is not valid JSON.'),
    404: json(errorResponse, 'There is no site with that slug.'),
    409: json(
      errorResponse,
      'The site has changed since it was read, or another site has the new slug.',
    ),
    415: json(errorResponse, 'The body is not of the expected type.'),
    422: json(invalidRequestResponse, 'The request is invalid.'),
    428: json(errorResponse, 'If-Match is missing.'),
  },
});

const deleteSite = createRoute({
  method: 'delete',
  path: '/{slug}',
  summary: 'Delete a site',
  description:
    "Takes the site's definition away: its file moves to the archive's deleted/ folder. A folder it built in Sites/ is left where it is.",
  request: { params: siteParams },
  responses: {
    204: { description: 'The site is gone.' },
    404: json(errorResponse, 'There is no site with that slug.'),
    422: json(invalidRequestResponse, 'The slug is not a slug.'),
  },
});

const startBuild = createRoute({
  method: 'post',
  path: '/{slug}/build',
  summary: 'Build a site',
  description:
    'Starts writing the site into Sites/<slug>/ in the background, from the frames its selection finds now, making again only the images whose inputs changed (or, with rebuild, every image and page, or every page). Follow it with the status. A build already running is followed instead of started again.',
  request: { params: siteParams, query: siteBuildQuery },
  responses: {
    202: json(siteBuildProgress, 'The build, running.'),
    404: json(errorResponse, 'There is no site with that slug.'),
    422: json(
      invalidRequestResponse,
      'Sites/<slug> holds something that is not a built site, and is left alone; or rebuild is not all or pages.',
    ),
  },
});

const getStatus = createRoute({
  method: 'get',
  path: '/{slug}/status',
  summary: 'Whether a site is built and up to date',
  description:
    'Compares the built site with what it would be built from now, and gives how the latest build went.',
  request: { params: siteParams },
  responses: {
    200: json(siteStatus, 'Where the site stands.'),
    404: json(errorResponse, 'There is no site with that slug.'),
  },
});

const cancelBuild = createRoute({
  method: 'delete',
  path: '/{slug}/build',
  summary: 'Stop building a site',
  description: 'Stops after the image in progress, leaving the site as it was.',
  request: { params: siteParams },
  responses: {
    204: { description: 'Asked to stop.' },
    404: json(errorResponse, 'That site is not being built.'),
  },
});

export interface SiteUseCases {
  readonly siteBuilds: SiteBuilds;
  readonly listSites: ListSites;
  readonly createSite: CreateSite;
  readonly getSite: GetSite;
  readonly updateSite: UpdateSite;
  readonly deleteSite: DeleteSite;
}

function siteBody({ site }: VersionedSite) {
  return {
    id: site.id,
    slug: site.slug,
    name: site.name,
    selection: selectionBody(site.selection),
    presentation: {
      title: site.presentation.title,
      copyright: site.presentation.copyright,
      captions: [...site.presentation.captions],
    },
  };
}

/** The archive's sites (D91). */
export function siteRoutes({
  ctx,
  useCases,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: SiteUseCases;
}): OpenAPIHono {
  const routes = new OpenAPIHono({ defaultHook: invalidRequestHook });
  const notFound = { error: 'not found' };

  routes.openapi(listSites, async (c) => {
    const sites = await useCases.listSites.execute(ctx);
    return c.json({ sites: [...sites] }, 200);
  });

  routes.openapi(createSite, async (c) => {
    const created = await useCases.createSite.execute(ctx, c.req.valid('json'));
    if (!created.ok) {
      return domainErrorResponse(c, created.error);
    }
    c.header('ETag', etagOf(created.value.version));
    return c.json(siteBody(created.value), 201);
  });

  routes.openapi(getSite, async (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const found = await useCases.getSite.execute(ctx, { slug });
    if (!found.ok) {
      return domainErrorResponse(c, found.error);
    }
    c.header('ETag', etagOf(found.value.version));
    return c.json(siteBody(found.value), 200);
  });

  routes.openapi(updateSite, async (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const ifMatch = c.req.valid('header')['if-match'];
    if (ifMatch === undefined) {
      return c.json({ error: 'send the site’s ETag as If-Match' }, 428);
    }
    const { name, selection: wanted, presentation } = c.req.valid('json');
    const selection = wanted === undefined ? undefined : selectionOf(wanted);
    if (wanted !== undefined && selection === undefined) {
      return c.json(
        {
          error: 'invalid request' as const,
          issues: [
            { path: ['selection'], message: 'an ID or slug is malformed' },
          ],
        },
        422,
      );
    }
    const updated = await useCases.updateSite.execute(ctx, {
      slug,
      expectedVersion: versionFrom(ifMatch),
      name,
      selection,
      presentation,
    });
    if (!updated.ok) {
      return domainErrorResponse(c, updated.error);
    }
    c.header('ETag', etagOf(updated.value.version));
    return c.json(siteBody(updated.value), 200);
  });

  routes.openapi(deleteSite, async (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const deleted = await useCases.deleteSite.execute(ctx, { slug });
    return deleted.ok
      ? c.body(null, 204)
      : domainErrorResponse(c, deleted.error);
  });

  routes.openapi(startBuild, async (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const { rebuild } = c.req.valid('query');
    const started = await useCases.siteBuilds.start(ctx, { slug, rebuild });
    return started.ok
      ? c.json(started.value, 202)
      : domainErrorResponse(c, started.error);
  });

  routes.openapi(getStatus, async (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const status = await useCases.siteBuilds.status(ctx, { slug });
    return status.ok
      ? c.json({ ...status.value, build: status.value.build ?? null }, 200)
      : domainErrorResponse(c, status.error);
  });

  routes.openapi(cancelBuild, (c) => {
    const { slug } = c.req.valid('param');
    if (!isSlug(slug)) {
      return c.json(notFound, 404);
    }
    const cancelled = useCases.siteBuilds.cancel({ slug });
    return cancelled.ok
      ? c.body(null, 204)
      : domainErrorResponse(c, cancelled.error);
  });

  return routes;
}
