import { escapeHtml } from './escape-html.ts';

/** The header's way home from a page other than the home page (D107). */
export function allEventsLink(root: string): string {
  return `<a class="all-events" href="${root}index.html">All events</a>`;
}

/** A page's tab title: its own name, then the site's title when it has one (D108). */
export function tabTitle(own: string, siteTitle: string): string {
  return siteTitle === '' ? own : `${own} · ${siteTitle}`;
}

/**
 * Every page of a site: its title, the stylesheet, a header with the site's
 * title leading home (none when it's blank, D108), the page's own content,
 * and a footer with the copyright notice when there is one. `root` is the way up to the
 * site's folder (`''`, `'../'` or `'../../'`), so every link is relative.
 */
export function sitePageShell(page: {
  readonly title: string;
  /** The site's title; blank for none. */
  readonly siteName: string;
  /** The copyright notice; blank for none. */
  readonly copyright: string;
  readonly root: string;
  /** The home page names the site as its heading; another page has its own. */
  readonly nameIsHeading: boolean;
  /** Anything on the header's other side, such as the home page's counts. */
  readonly aside?: string;
  readonly body: string;
  /** Anything after the page, such as a frame page's script. */
  readonly after?: string;
}): string {
  const tag = page.nameIsHeading ? 'h1' : 'p';
  const name =
    page.siteName === ''
      ? ''
      : `<${tag} class="site-name"><a href="${page.root}index.html">${escapeHtml(page.siteName)}</a></${tag}>`;
  const foot =
    page.copyright === ''
      ? ''
      : `<footer class="site-foot"><p>${escapeHtml(page.copyright)}</p></footer>\n`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)}</title>
<link rel="stylesheet" href="${page.root}assets/site.css">
</head>
<body>
<header class="site-header">${name}${page.aside ?? ''}</header>
<main class="page">
${page.body}
</main>
${foot}${page.after ?? ''}</body>
</html>
`;
}
