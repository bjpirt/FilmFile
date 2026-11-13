import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { beforeEach, describe, expect, test } from 'vitest';
import { siteStatus } from '@filmfile/contracts/sites';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

let rollId = '';
let shades = 0;

beforeEach(async () => {
  shades = 0;
  await post('/api/settings', {
    author: 'Ben Pirt',
    copyright: 'All rights reserved',
  });
  rollId = String(
    idOf(
      await (
        await post('/api/rolls', { roll: '2026-014', shot: '2026-09-12' })
      ).json(),
    ),
  );
});

/** A frame with a large scan, so the site makes every size of it. */
async function aFrameWithAScan(number: string): Promise<string> {
  const frameId = String(
    idOf(await (await post(`/api/rolls/${rollId}/frames`, { number })).json()),
  );
  shades += 20;
  const added = await request(
    `/api/rolls/${rollId}/frames/${frameId}/versions?file=scan-${number}.jpg`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: new Uint8Array(
        await aJpeg({ width: 1800, height: 1200, shade: shades }),
      ),
    },
  );
  expect(added.status).toBe(201);
  return frameId;
}

async function aSite(name = 'Iceland highlights'): Promise<string> {
  const response = await post('/api/sites', { name });
  const body: unknown = await response.json();
  return String(
    typeof body === 'object' && body !== null && 'slug' in body
      ? body.slug
      : '',
  );
}

/** Starts a build (a rebuild, if asked) and waits for it to finish. */
async function build(slug: string, query = '') {
  const started = await post(`/api/sites/${slug}/build${query}`, {});
  expect(started.status).toBe(202);
  for (let tries = 0; tries < 200; tries += 1) {
    const status = siteStatus.parse(
      await (await request(`/api/sites/${slug}/status`)).json(),
    );
    if (status.build !== null && status.build.state !== 'running') {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('the build did not finish');
}

const siteFolder = (slug: string) => path.join(archive.folder(), 'Sites', slug);

/** The text of a built site's first event page. */
async function eventPage(slug: string): Promise<string> {
  const folder = path.join(siteFolder(slug), 'events');
  const file = (await readdir(folder)).find((name) => name.endsWith('.html'));
  return file === undefined ? '' : readFile(path.join(folder, file), 'utf8');
}

/** The path of a built site's first frame page, under its first event. */
async function aFramePage(slug: string): Promise<string> {
  const folder = path.join(siteFolder(slug), 'events');
  const event = (await readdir(folder)).find((name) => !name.endsWith('.html'));
  const [frame] = await readdir(path.join(folder, event ?? ''));
  return `events/${event ?? ''}/${frame ?? ''}`;
}

describe('POST /api/sites/{slug}/build', () => {
  test('leaves out a frame excluded by hand (D103)', async () => {
    const excluded = await aFrameWithAScan('1');
    await aFrameWithAScan('2');
    const slug = await aSite();
    const etag =
      (await request(`/api/sites/${slug}`)).headers.get('ETag') ?? '';
    await request(`/api/sites/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify({
        selection: { rules: [], excluded: [{ rollId, frameId: excluded }] },
      }),
    });

    const status = await build(slug);

    expect(status.build).toMatchObject({ state: 'done', photos: 1 });
  });

  test('builds the site into Sites/<slug>/ from the frames it finds', async () => {
    await aFrameWithAScan('1');
    await aFrameWithAScan('2');
    const slug = await aSite();

    const status = await build(slug);

    expect(status.build).toMatchObject({
      state: 'done',
      photos: 2,
      imagesMade: 8,
      imagesUnchanged: 0,
    });
    expect((await readdir(siteFolder(slug))).sort()).toEqual([
      'assets',
      'events',
      'images',
      'index.html',
      'site.json',
    ]);
    expect(await readdir(path.join(siteFolder(slug), 'images'))).toHaveLength(
      8,
    );
    const page = await readFile(
      path.join(siteFolder(slug), 'index.html'),
      'utf8',
    );
    expect(page).toContain('<title>Photographs</title>');
    expect(await eventPage(slug)).toContain('alt="Photo from 12 Sep 2026"');
  });

  test('makes images of the right size that say only who they are by', async () => {
    await aFrameWithAScan('1');
    const slug = await aSite();

    await build(slug);

    const images = await readdir(path.join(siteFolder(slug), 'images'));
    const widths: number[] = [];
    for (const image of images) {
      const file = await readFile(path.join(siteFolder(slug), 'images', image));
      const meta = await sharp(file).metadata();
      widths.push(meta.width);
      expect(meta.exif).toBeDefined();
    }
    expect(widths.sort((a, b) => a - b)).toEqual([240, 480, 960, 1600]);
  });

  test('says the site is up to date, and building again changes nothing', async () => {
    await aFrameWithAScan('1');
    const slug = await aSite();
    await build(slug);
    const before = await readFile(
      path.join(siteFolder(slug), 'site.json'),
      'utf8',
    );

    const again = await build(slug);

    expect(again.freshness).toBe('up-to-date');
    expect(again.message).toBe('Up to date');
    expect(again.build).toMatchObject({ imagesMade: 0, imagesUnchanged: 4 });
    expect(
      await readFile(path.join(siteFolder(slug), 'site.json'), 'utf8'),
    ).toBe(before);
  });

  test('leaves out a hidden frame, and counts it', async () => {
    await aFrameWithAScan('1');
    const hidden = await aFrameWithAScan('2');
    const etag =
      (await request(`/api/rolls/${rollId}`)).headers.get('ETag') ?? '';
    await request(`/api/rolls/${rollId}/frames/${hidden}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify({ hidden: true }),
    });
    const slug = await aSite();

    const status = await build(slug);

    expect(status.build).toMatchObject({ photos: 1 });
  });

  test('refuses to build over a folder holding something else, changing nothing', async () => {
    await aFrameWithAScan('1');
    const slug = await aSite();
    await mkdir(siteFolder(slug), { recursive: true });
    await writeFile(path.join(siteFolder(slug), 'notes.txt'), 'mine');

    const response = await post(`/api/sites/${slug}/build`, {});

    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).toContain(
      `Sites/${slug} holds something else`,
    );
    expect(await readdir(siteFolder(slug))).toEqual(['notes.txt']);
    const status = siteStatus.parse(
      await (await request(`/api/sites/${slug}/status`)).json(),
    );
    expect(status.freshness).toBe('in-the-way');
  });

  test('builds an empty page for a site with no frames', async () => {
    const slug = await aSite();

    const status = await build(slug);

    expect(status.build).toMatchObject({ state: 'done', photos: 0 });
    expect(
      await readFile(path.join(siteFolder(slug), 'index.html'), 'utf8'),
    ).toContain('This site has no photos yet.');
  });

  test('uses the site’s own title, the archive’s copyright, is organised by event with no rolls, and uses its captions', async () => {
    await aFrameWithAScan('1');
    const slug = await aSite();
    const settingsEtag =
      (await request('/api/settings')).headers.get('ETag') ?? '';
    await request('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': settingsEtag },
      body: JSON.stringify({ copyright: '© Ben Pirt' }),
    });
    const etag =
      (await request(`/api/sites/${slug}`)).headers.get('ETag') ?? '';
    await request(`/api/sites/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify({
        presentation: {
          title: 'Iceland in September',
          copyright: null,
          captions: ['shot'],
        },
      }),
    });

    await build(slug);

    const page = await readFile(
      path.join(siteFolder(slug), 'index.html'),
      'utf8',
    );
    expect(page).toContain('<title>Iceland in September</title>');
    expect(page).toContain('>Iceland in September</a></h1>');
    expect(page).toContain(
      '<footer class="site-foot"><p>© Ben Pirt</p></footer>',
    );
    expect(page).toContain('<h3>Other 2026 photos</h3>');
    expect(page).not.toContain('2026-014');
    expect(page).not.toContain('class="views"');
    expect(await readdir(siteFolder(slug))).toContain('events');
    expect(await readdir(siteFolder(slug))).not.toContain('rolls');
    expect(await readdir(siteFolder(slug))).not.toContain('rolls.html');
    expect(await eventPage(slug)).not.toContain('<figcaption>');
    expect(
      await readFile(
        path.join(siteFolder(slug), await aFramePage(slug)),
        'utf8',
      ),
    ).toContain('<dt>Date shot</dt><dd>12 Sep 2026</dd>');
  });

  test('with rebuild=all, makes every image again even when the site is up to date (FF-191)', async () => {
    await aFrameWithAScan('1');
    const slug = await aSite();
    await build(slug);

    const status = await build(slug, '?rebuild=all');

    expect(status.build).toMatchObject({
      state: 'done',
      imagesMade: 4,
      imagesUnchanged: 0,
    });
    expect(status.freshness).toBe('up-to-date');
  });

  test('with rebuild=pages, writes the pages again but makes no image (FF-193)', async () => {
    await aFrameWithAScan('1');
    const slug = await aSite();
    await build(slug);
    await writeFile(
      path.join(siteFolder(slug), 'index.html'),
      'changed by hand',
    );

    const status = await build(slug, '?rebuild=pages');

    expect(status.build).toMatchObject({
      state: 'done',
      imagesMade: 0,
      imagesUnchanged: 4,
    });
    expect(
      await readFile(path.join(siteFolder(slug), 'index.html'), 'utf8'),
    ).toContain('<!doctype html>');
  });

  test('refuses rebuild as anything but all or pages', async () => {
    const slug = await aSite();

    expect(
      (await post(`/api/sites/${slug}/build?rebuild=yes`, {})).status,
    ).toBe(422);
  });

  test('a new site has no title, and its copyright can be changed or left off (D108)', async () => {
    await aFrameWithAScan('1');
    const slug = await aSite();
    const present = async (copyright: string | null) => {
      const etag =
        (await request(`/api/sites/${slug}`)).headers.get('ETag') ?? '';
      await request(`/api/sites/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': etag },
        body: JSON.stringify({
          presentation: { title: '', copyright, captions: ['title'] },
        }),
      });
      await build(slug);
      return readFile(path.join(siteFolder(slug), 'index.html'), 'utf8');
    };

    const own = await present('© Someone else');
    expect(own).toContain('<p>© Someone else</p>');
    expect(own).toContain('<title>Photographs</title>');
    expect(own).not.toContain('class="site-name"');
    expect(await present('')).not.toContain('site-foot');
  });

  test('says there is no such site', async () => {
    expect((await post('/api/sites/nothing/build', {})).status).toBe(404);
  });
});

describe('GET /api/sites/{slug}/status', () => {
  test('says a site never built is not built, then out of date once frames change', async () => {
    await aFrameWithAScan('1');
    const slug = await aSite();
    const first = siteStatus.parse(
      await (await request(`/api/sites/${slug}/status`)).json(),
    );
    expect(first).toEqual({
      freshness: 'not-built',
      message: 'Not built yet',
      build: null,
    });
    await build(slug);

    await aFrameWithAScan('2');

    const second = siteStatus.parse(
      await (await request(`/api/sites/${slug}/status`)).json(),
    );
    expect(second.freshness).toBe('out-of-date');
    expect(second.message).toBe('Out of date: 1 frame added');
  });

  test('says a site is out of date when its title changes, but not when it’s renamed within its slug (D108)', async () => {
    await aFrameWithAScan('1');
    const slug = await aSite('Iceland');
    await build(slug);
    const change = async (body: unknown) => {
      const etag =
        (await request(`/api/sites/${slug}`)).headers.get('ETag') ?? '';
      await request(`/api/sites/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': etag },
        body: JSON.stringify(body),
      });
      return siteStatus.parse(
        await (await request(`/api/sites/${slug}/status`)).json(),
      ).freshness;
    };

    expect(await change({ name: 'ICELAND' })).toBe('up-to-date');
    expect(
      await change({
        presentation: {
          title: 'Iceland',
          copyright: null,
          captions: ['title'],
        },
      }),
    ).toBe('out-of-date');
  });

  test('says there is no such site', async () => {
    expect((await request('/api/sites/nothing/status')).status).toBe(404);
  });
});

describe('DELETE /api/sites/{slug}/build', () => {
  test('says no site is being built when none is', async () => {
    const slug = await aSite();

    expect(
      (await request(`/api/sites/${slug}/build`, { method: 'DELETE' })).status,
    ).toBe(404);
  });
});

describe('GET /built-sites/{slug}/', () => {
  test('opens the built site: its home page, a roll’s and an event’s page, stylesheet, script and images', async () => {
    await aFrameWithAScan('1');
    const slug = await aSite();
    await build(slug);

    const page = await request(`/built-sites/${slug}/`);
    expect(page.status).toBe(200);
    expect(page.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    const html = await page.text();
    expect(html).toContain('<title>Photographs</title>');
    expect(page.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'",
    );

    for (const [file, type] of [
      [await aFramePage(slug), 'text/html; charset=utf-8'],
      ['events/_no-event-2026.html', 'text/html; charset=utf-8'],
      ['assets/site.css', 'text/css; charset=utf-8'],
      ['assets/site.js', 'text/javascript; charset=utf-8'],
    ] as const) {
      const response = await request(`/built-sites/${slug}/${file}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe(type);
    }
    const image = /images\/[^" ]+\.jpg/.exec(html)?.[0] ?? '';
    const jpeg = await request(`/built-sites/${slug}/${image}`);
    expect(jpeg.status).toBe(200);
    expect(jpeg.headers.get('Content-Type')).toBe('image/jpeg');
  });

  test('sends the address without its slash to the one with it, so relative links work', async () => {
    const response = await request('/built-sites/iceland');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/built-sites/iceland/');
  });

  test('gives nothing else: not the manifest, not another file, nothing outside assets and images', async () => {
    await aFrameWithAScan('1');
    const slug = await aSite();
    await build(slug);
    await writeFile(path.join(siteFolder(slug), 'secret.txt'), 'no');

    for (const file of [
      'site.json',
      'secret.txt',
      'assets/../site.json',
      'assets/nothing.css',
      'images/',
      'rolls/nothing.html',
      'events/../site.json',
      'events/a/b/c.html',
      'events/a/../../site.json',
      'events/secret.txt',
      'rolls.json',
    ]) {
      expect((await request(`/built-sites/${slug}/${file}`)).status, file).toBe(
        404,
      );
    }
    expect((await request('/built-sites/Not-A-Slug/')).status).toBe(404);
  });

  test('says there is nothing for a site never built', async () => {
    const slug = await aSite();

    expect((await request(`/built-sites/${slug}/`)).status).toBe(404);
  });

  test('refuses anything but reading', async () => {
    const slug = await aSite();

    const response = await request(`/built-sites/${slug}/index.html`, {
      method: 'POST',
    });

    expect([403, 404]).toContain(response.status);
  });
});
