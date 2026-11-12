import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { site as siteContract } from '@filmfile/contracts/sites';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

beforeEach(async () => {
  await post('/api/settings', { author: 'Ben Pirt' });
});

function patch(slug: string, body: unknown, ifMatch?: string) {
  return request(`/api/sites/${slug}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
    },
    body: JSON.stringify(body),
  });
}

/** A site made through the API, with the ETag it came with. */
async function aSite(name: string): Promise<{ slug: string; etag: string }> {
  const response = await post('/api/sites', { name });
  expect(response.status).toBe(201);
  const body: unknown = await response.json();
  return {
    slug: String(
      typeof body === 'object' && body !== null && 'slug' in body
        ? body.slug
        : '',
    ),
    etag: response.headers.get('ETag') ?? '',
  };
}

async function aRollWithFrames(count: number): Promise<{
  rollId: string;
  frameIds: string[];
}> {
  const rollId = String(
    idOf(
      await (
        await post('/api/rolls', { roll: '2026-001', shot: '2026' })
      ).json(),
    ),
  );
  const frameIds: string[] = [];
  for (let i = 0; i < count; i += 1) {
    frameIds.push(
      String(
        idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
      ),
    );
  }
  return { rollId, frameIds };
}

const siteFile = (slug: string) =>
  path.join(archive.path(), 'sites', `${slug}.json`);

describe('POST /api/sites', () => {
  test('adds a site with a slug made from its name, no rules and an ETag', async () => {
    const response = await post('/api/sites', { name: 'Iceland highlights' });

    expect(response.status).toBe(201);
    const created = siteContract.parse(await response.json());
    expect(created.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(created).toEqual({
      id: created.id,
      slug: 'iceland-highlights',
      name: 'Iceland highlights',
      selection: { rules: [], pinned: [], hidden: [] },
      presentation: {
        groupBy: 'nothing',
        captions: ['title'],
      },
    });
    expect(response.headers.get('ETag')).toMatch(/^"[0-9a-f]{64}"$/);
    expect(
      JSON.parse(await readFile(siteFile('iceland-highlights'), 'utf8')),
    ).toMatchObject({ schema: 1, name: 'Iceland highlights' });
  });

  test('says so when another site has the same slug', async () => {
    await aSite('Iceland');

    const response = await post('/api/sites', { name: 'iceland' });

    expect(response.status).toBe(409);
  });

  test.each([
    ['empty', ''],
    ['only symbols', '!!!'],
    ['too long', 'x'.repeat(101)],
  ])('refuses a name that is %s', async (_why, name) => {
    expect((await post('/api/sites', { name })).status).toBe(422);
  });

  test('refuses a body that is not JSON', async () => {
    const response = await request('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{}',
    });

    expect(response.status).toBe(415);
  });
});

describe('GET /api/sites', () => {
  test('lists the sites by name, each with how many frames are on it now', async () => {
    const { rollId, frameIds } = await aRollWithFrames(3);
    await aSite('Westfjords');
    const iceland = await aSite('Iceland');
    await patch(
      iceland.slug,
      {
        selection: {
          rules: [],
          pinned: [],
          hidden: [{ rollId, frameId: frameIds[0] }],
        },
      },
      iceland.etag,
    );

    const response = await request('/api/sites');

    expect(await response.json()).toEqual({
      sites: [
        { slug: 'iceland', name: 'Iceland', frameCount: 2 },
        { slug: 'westfjords', name: 'Westfjords', frameCount: 3 },
      ],
    });
  });

  test('has no sites to begin with', async () => {
    expect(await (await request('/api/sites')).json()).toEqual({ sites: [] });
  });
});

describe('GET /api/sites/{slug}', () => {
  test('gives the site with its ETag', async () => {
    const { slug, etag } = await aSite('Iceland');

    const response = await request(`/api/sites/${slug}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('ETag')).toBe(etag);
    expect(await response.json()).toMatchObject({ slug, name: 'Iceland' });
  });

  test('says there is no such site', async () => {
    expect((await request('/api/sites/nothing')).status).toBe(404);
  });
});

describe('PATCH /api/sites/{slug}', () => {
  const selection = {
    rules: [
      { kind: 'rating', atLeast: 4 },
      { kind: 'shot-after', date: '2026-09' },
    ],
    pinned: [],
    hidden: [],
  };

  test('saves a selection against the ETag, with a new ETag', async () => {
    const { slug, etag } = await aSite('Iceland');

    const response = await patch(slug, { selection }, etag);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ slug, selection });
    expect(response.headers.get('ETag')).not.toBe(etag);
    expect(await (await request(`/api/sites/${slug}`)).json()).toMatchObject({
      selection,
    });
  });

  test('writing it again with nothing changed leaves the file byte-identical', async () => {
    const { slug, etag } = await aSite('Iceland');
    const saved = await patch(slug, { selection }, etag);
    const before = await readFile(siteFile(slug), 'utf8');

    const again = await patch(
      slug,
      { selection },
      saved.headers.get('ETag') ?? '',
    );

    expect(again.status).toBe(200);
    expect(await readFile(siteFile(slug), 'utf8')).toBe(before);
    expect(again.headers.get('ETag')).toBe(saved.headers.get('ETag'));
  });

  test('refuses a change to a site that changed since it was read, keeping what is there', async () => {
    const { slug, etag } = await aSite('Iceland');
    await patch(slug, { selection }, etag);

    const stale = await patch(slug, { name: 'Mine' }, etag);

    expect(stale.status).toBe(409);
    expect(await (await request(`/api/sites/${slug}`)).json()).toMatchObject({
      name: 'Iceland',
      selection,
    });
  });

  test('wants the ETag as If-Match', async () => {
    const { slug } = await aSite('Iceland');

    expect((await patch(slug, { name: 'Iceland 2026' })).status).toBe(428);
  });

  test('saves how the site is presented, and gives it back', async () => {
    const { slug, etag } = await aSite('Iceland');
    const presentation = {
      groupBy: 'event',
      captions: ['title', 'shot'],
    };

    const response = await patch(slug, { presentation }, etag);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ presentation });
    expect(await (await request(`/api/sites/${slug}`)).json()).toMatchObject({
      presentation,
    });
  });

  test.each([
    ['an unknown way to group', { groupBy: 'colour', captions: [] }],
    ['an unknown caption', { groupBy: 'roll', captions: ['gps'] }],
    [
      'a title, which is now the name (FF-179)',
      { title: 'Iceland', groupBy: 'roll', captions: [] },
    ],
    [
      'an intro, which sites no longer have (FF-179)',
      { intro: 'Two weeks.', groupBy: 'roll', captions: [] },
    ],
  ])('refuses a presentation with %s', async (_why, presentation) => {
    const { slug, etag } = await aSite('Iceland');

    expect((await patch(slug, { presentation }, etag)).status).toBe(422);
  });

  test('a new name makes a new slug, and the site moves to it', async () => {
    const { slug, etag } = await aSite('Iceland');

    const response = await patch(slug, { name: 'Iceland 2026' }, etag);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      slug: 'iceland-2026',
      name: 'Iceland 2026',
    });
    expect((await request('/api/sites/iceland')).status).toBe(404);
    expect((await request('/api/sites/iceland-2026')).status).toBe(200);
    expect(await readdir(path.join(archive.path(), 'sites'))).toEqual([
      'iceland-2026.json',
    ]);
  });

  test('refuses a name whose slug another site has, leaving both', async () => {
    await aSite('Norway');
    const { slug, etag } = await aSite('Iceland');

    const response = await patch(slug, { name: 'Norway' }, etag);

    expect(response.status).toBe(409);
    expect((await request('/api/sites/iceland')).status).toBe(200);
    expect((await request('/api/sites/norway')).status).toBe(200);
  });

  test('changing only the capitals of a name keeps the slug', async () => {
    const { slug, etag } = await aSite('iceland');

    const response = await patch(slug, { name: 'Iceland' }, etag);

    expect(await response.json()).toMatchObject({
      slug: 'iceland',
      name: 'Iceland',
    });
  });

  test.each([
    [
      'a rule that does not exist',
      { selection: { rules: [{ kind: 'colour' }], pinned: [], hidden: [] } },
    ],
    ['a name with nothing in it', { name: '!!!' }],
    ['a field it does not have', { colour: 'red' }],
    ['a selection missing its lists', { selection: { rules: [] } }],
  ])('refuses %s', async (_why, body) => {
    const { slug, etag } = await aSite('Iceland');

    expect((await patch(slug, body, etag)).status).toBe(422);
  });

  test('says there is no such site', async () => {
    expect((await patch('nothing', { name: 'x' }, '"v"')).status).toBe(404);
  });
});

describe('DELETE /api/sites/{slug}', () => {
  test('takes the definition away to deleted/, leaving what the site built', async () => {
    const { slug } = await aSite('Iceland');
    const built = path.join(archive.folder(), 'Sites', 'iceland');
    await mkdir(built, { recursive: true });
    await writeFile(path.join(built, 'index.html'), '<p>built</p>');

    const response = await request(`/api/sites/${slug}`, { method: 'DELETE' });

    expect(response.status).toBe(204);
    expect((await request(`/api/sites/${slug}`)).status).toBe(404);
    expect(await readdir(path.join(archive.path(), 'deleted'))).toEqual([
      expect.stringMatching(/-site-iceland$/),
    ]);
    expect(await readFile(path.join(built, 'index.html'), 'utf8')).toBe(
      '<p>built</p>',
    );
  });

  test('says there is no such site', async () => {
    expect(
      (await request('/api/sites/nothing', { method: 'DELETE' })).status,
    ).toBe(404);
  });
});
