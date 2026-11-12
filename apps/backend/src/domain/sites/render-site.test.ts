import { expect, test } from 'vitest';
import { renderSite } from './render-site.ts';
import { noPhotosText } from './render-site-page.ts';
import type { SiteOptions } from './site-options.ts';
import type { GroupLabel, SitePhoto } from './site-photo.ts';
import { isFrameId, type FrameId } from '../shared/ids.ts';

const options: SiteOptions = {
  title: 'Iceland highlights',
  groupBy: 'nothing',
  captions: ['title'],
};

function frameId(name: string): FrameId {
  const id = name.padStart(26, '0');
  if (!isFrameId(id)) {
    throw new Error(`bad test data: ${name}`);
  }
  return id;
}

const roll: GroupLabel = { key: 'r1', heading: '2026-004 Iceland' };

function aPhoto(name: string, extra: Partial<SitePhoto> = {}): SitePhoto {
  return {
    frame: frameId(name),
    alt: `Frame ${name}`,
    images: [
      { src: `images/${name}-640.jpg`, width: 640, madeFrom: `h${name}a` },
      { src: `images/${name}-1600.jpg`, width: 1600, madeFrom: `h${name}b` },
    ],
    width: 1600,
    height: 1067,
    roll,
    details: {},
    ...extra,
  };
}

function page(photos: readonly SitePhoto[], over: Partial<SiteOptions> = {}) {
  const file = renderSite(photos, { ...options, ...over }).find(
    (candidate) => candidate.path === 'index.html',
  );
  if (file === undefined) {
    throw new Error('no index.html');
  }
  return file.content;
}

test('writes the page, its stylesheet and script', () => {
  expect(renderSite([], options).map((file) => file.path)).toEqual([
    'index.html',
    'assets/site.css',
    'assets/site.js',
  ]);
});

test('shows the title as the heading and the page title', () => {
  const html = page([aPhoto('1')]);
  expect(html).toContain('<title>Iceland highlights</title>');
  expect(html).toContain('<h1>Iceland highlights</h1>');
});

test('says so when there are no photos', () => {
  expect(page([])).toContain(noPhotosText);
});

test('links each photo to its widest image and offers all sizes', () => {
  const html = page([aPhoto('1')]);
  expect(html).toContain('<a href="images/1-1600.jpg">');
  expect(html).toContain(
    'srcset="images/1-640.jpg 640w, images/1-1600.jpg 1600w"',
  );
  expect(html).toContain('alt="Frame 1"');
  expect(html).toContain('class="photo shape-14995"');
  expect(html).not.toContain('style=');
});

test('sets a photo’s shape in the stylesheet, once for each shape', () => {
  const css = renderSite(
    [aPhoto('1'), aPhoto('2'), aPhoto('3', { width: 1000, height: 1000 })],
    options,
  ).find((file) => file.path === 'assets/site.css')?.content;
  expect(css).toContain('.shape-14995 {\n  --shape: 1.4995;\n}');
  expect(css).toContain('.shape-10000 {\n  --shape: 1;\n}');
  expect(css?.match(/\.shape-14995 \{/g)).toHaveLength(1);
});

test('uses only relative links, so it works from any folder', () => {
  expect(page([aPhoto('1')])).not.toMatch(/(?:href|src)="(?:\/|https?:)/);
});

test('writes the captions chosen, in a fixed order', () => {
  const photo = aPhoto('1', {
    details: { title: 'Black beach', shot: 'Sep 2026', camera: 'Leica M6' },
  });
  expect(page([photo], { captions: ['camera', 'title'] })).toContain(
    '<figcaption>Black beach · Leica M6</figcaption>',
  );
});

test('leaves the caption out when nothing chosen is known', () => {
  expect(page([aPhoto('1')])).not.toContain('<figcaption>');
});

test('splits the photos under a heading for each roll', () => {
  const other: GroupLabel = { key: 'r2', heading: '2026-005 Norway' };
  const html = page([aPhoto('1'), aPhoto('2', { roll: other })], {
    groupBy: 'roll',
  });
  expect(html).toContain('<h2>2026-004 Iceland</h2>');
  expect(html).toContain('<h2>2026-005 Norway</h2>');
});

test('shows an event’s date beside its heading, and "No event set" last', () => {
  const event: GroupLabel = { key: 'e', heading: 'Iceland', detail: '2026' };
  const html = page([aPhoto('1'), aPhoto('2', { event })], {
    groupBy: 'event',
  });
  expect(html).toContain('<h2>Iceland <small>2026</small></h2>');
  expect(html.indexOf('Iceland <small>')).toBeLessThan(
    html.indexOf('No event set'),
  );
});

test('escapes every word that came from the archive', () => {
  const photo = aPhoto('1', {
    alt: '"><script>x</script>',
    details: { title: '<b>Bold</b>' },
  });
  const html = page([photo], { title: 'A & B' });
  expect(html).not.toContain('<script>x');
  expect(html).not.toContain('<b>Bold');
  expect(html).toContain('<h1>A &amp; B</h1>');
});

test('makes byte-identical files from the same inputs', () => {
  expect(renderSite([aPhoto('1')], options)).toEqual(
    renderSite([aPhoto('1')], options),
  );
});
