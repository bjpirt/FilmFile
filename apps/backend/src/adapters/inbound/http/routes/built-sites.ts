import { Hono } from 'hono';
import type { GetBuiltSiteFile } from '../../../../application/use-cases/sites/get-built-site-file.ts';
import type { ArchiveContext } from '../../../../domain/shared/archive-context.ts';
import { isSlug } from '../../../../domain/shared/slug.ts';

export interface BuiltSiteUseCases {
  readonly getBuiltSiteFile: GetBuiltSiteFile;
}

/**
 * Opens a built site in the browser, read-only: `/built-sites/<slug>/` is its
 * page and the rest of what it holds, as its relative links ask. Only what a
 * build makes for showing is ever given, nothing else in `Sites/`.
 */
export function builtSiteRoutes({
  ctx,
  useCases,
}: {
  readonly ctx: ArchiveContext;
  readonly useCases: BuiltSiteUseCases;
}): Hono {
  const routes = new Hono();

  // The page's relative links need the slash after the site's name.
  routes.get('/:slug', (c) => {
    const slug = c.req.param('slug');
    return isSlug(slug)
      ? c.redirect(`/built-sites/${slug}/`)
      : c.text('not found', 404);
  });

  routes.get('/:slug/*', async (c) => {
    const slug = c.req.param('slug');
    if (!isSlug(slug)) {
      return c.text('not found', 404);
    }
    const prefix = `/built-sites/${slug}/`;
    const path = decodeURIComponent(c.req.path.slice(prefix.length));
    const file = await useCases.getBuiltSiteFile.execute(ctx, { slug, path });
    if (!file.ok) {
      return c.text('not found', 404);
    }
    return c.body(new Uint8Array(file.value.bytes), 200, {
      'Content-Type': file.value.contentType,
      // A built site changes whenever it's built again.
      'Cache-Control': 'no-cache',
    });
  });

  return routes;
}
