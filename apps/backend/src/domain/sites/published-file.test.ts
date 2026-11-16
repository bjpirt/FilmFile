import { expect, test } from 'vitest';
import { publishedFileKind } from './published-file.ts';

test.each([
  [
    'images/frame-1-abc.jpg',
    'image/jpeg',
    'public, max-age=31536000, immutable',
    true,
  ],
  ['index.html', 'text/html; charset=utf-8', 'public, max-age=300', false],
  ['assets/site.css', 'text/css; charset=utf-8', 'public, max-age=300', false],
  [
    'assets/site.js',
    'text/javascript; charset=utf-8',
    'public, max-age=300',
    false,
  ],
  ['assets/odd.xyz', 'application/octet-stream', 'public, max-age=300', false],
])('sends %s as %s', (path, contentType, cacheControl, isImage) => {
  expect(publishedFileKind(path)).toEqual({
    contentType,
    cacheControl,
    isImage,
  });
});
