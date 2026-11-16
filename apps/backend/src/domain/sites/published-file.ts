/** What a file of a built site is sent as when it's published (FF-201). */
export interface PublishedFileKind {
  readonly contentType: string;
  readonly cacheControl: string;
  /** Images go up first, so pages never point at one that isn't there yet. */
  readonly isImage: boolean;
}

const contentTypes: Readonly<Record<string, string>> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
};

// An image's name carries a hash of what it's made from (D92), so it never
// changes under its name and can be kept for good. Pages and the files they
// load can change, so they're kept only a few minutes.
const imageCache = 'public, max-age=31536000, immutable';
const pageCache = 'public, max-age=300';

/** How a built site's file, by its path in the site, is sent. */
export function publishedFileKind(path: string): PublishedFileKind {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  const isImage = path.startsWith('images/');
  return {
    contentType: contentTypes[extension] ?? 'application/octet-stream',
    cacheControl: isImage ? imageCache : pageCache,
    isImage,
  };
}
