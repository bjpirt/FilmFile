import { escapeHtml } from './escape-html.ts';

/** The header's way home from a page other than the home page (D107). */
export function allEventsLink(root: string): string {
  return `<a class="all-events" href="${root}index.html">All events</a>`;
}

/**
 * Every page of a site: its title, the stylesheet, a header with the site's
 * name leading home, then the page's own content. `root` is the way up to the
 * site's folder (`''`, `'../'` or `'../../'`), so every link is relative.
 */
export function sitePageShell(page: {
  readonly title: string;
  readonly siteName: string;
  readonly root: string;
  /** The home page names the site as its heading; another page has its own. */
  readonly nameIsHeading: boolean;
  /** Anything more in the head, such as a frame page's stylesheet for when scripts are off. */
  readonly head?: string;
  /** Anything on the header's other side, such as the home page's counts. */
  readonly aside?: string;
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
${page.head ?? ''}</head>
<body>
<header class="site-header"><${tag} class="site-name"><a href="${page.root}index.html">${escapeHtml(page.siteName)}</a></${tag}>${page.aside ?? ''}</header>
<main class="page">
${page.body}
</main>
${page.after ?? ''}</body>
</html>
`;
}
