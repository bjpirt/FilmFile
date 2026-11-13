import { escapeHtml } from './escape-html.ts';
import type { OrganiseBy } from './site-options.ts';

/** Which cards a page belongs to, for the menu. */
export type SiteView = 'events' | 'rolls';

/** "Events | Rolls" with Both, the view shown marked; nothing with one view. */
function viewsHtml(
  organiseBy: OrganiseBy,
  view: SiteView,
  root: string,
): string {
  if (organiseBy !== 'both') {
    return '';
  }
  const link = (to: SiteView, href: string, text: string) =>
    `<a href="${root}${href}"${to === view ? ' aria-current="page"' : ''}>${text}</a>`;
  return `<nav class="views" aria-label="View by">${link('events', 'index.html', 'Events')}${link('rolls', 'rolls.html', 'Rolls')}</nav>`;
}

/**
 * Every page of a site: its title, the stylesheet, a header with the site's
 * name leading home and the menu, then the page's own content. `root` is the
 * way up to the site's folder (`''` or `'../'`), so every link is relative.
 */
export function sitePageShell(page: {
  readonly title: string;
  readonly siteName: string;
  readonly organiseBy: OrganiseBy;
  readonly view: SiteView;
  readonly root: string;
  /** A cards page names the site as its heading; another page has its own. */
  readonly nameIsHeading: boolean;
  readonly body: string;
  /** Anything after the page, such as a frame page's script. */
  readonly after?: string;
}): string {
  const tag = page.nameIsHeading ? 'h1' : 'p';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)}</title>
<link rel="stylesheet" href="${page.root}assets/site.css">
</head>
<body>
<header class="site-header"><${tag} class="site-name"><a href="${page.root}index.html">${escapeHtml(page.siteName)}</a></${tag}>${viewsHtml(page.organiseBy, page.view, page.root)}</header>
<main class="page">
${page.body}
</main>
${page.after ?? ''}</body>
</html>
`;
}
