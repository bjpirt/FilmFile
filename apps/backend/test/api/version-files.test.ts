import { readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { beforeEach, describe, expect, test } from 'vitest';
import { composeLocal } from '../../src/composition/compose-local.ts';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor, idOf, origin, port } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

let versionUrl = '';

async function uploadVersion(
  image: Buffer,
  roll = '2026-014',
): Promise<string> {
  const rollId = String(
    idOf(
      await (await post('/api/rolls', { roll, shot: roll.slice(0, 4) })).json(),
    ),
  );
  const frameId = String(
    idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
  );
  const versionsUrl = `/api/rolls/${rollId}/frames/${frameId}/versions`;
  const version: unknown = await (
    await request(`${versionsUrl}?file=12340014.jpg`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: new Uint8Array(image),
    })
  ).json();
  return `${versionsUrl}/${String(idOf(version))}`;
}

async function imageSize(
  response: Response,
): Promise<{ format: string | undefined; width: number; height: number }> {
  const { format, width, height } = await sharp(
    Buffer.from(await response.arrayBuffer()),
  ).metadata();
  return { format, width, height };
}

describe('GET …/versions/{versionId}/file', () => {
  test('returns the original scan unchanged', async () => {
    const image = await aJpeg();
    versionUrl = await uploadVersion(image);

    const response = await request(`${versionUrl}/file`);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(Buffer.from(await response.arrayBuffer()).equals(image)).toBe(true);
  });
});

describe('GET …/versions/{versionId}/thumbnail', () => {
  beforeEach(async () => {
    versionUrl = await uploadVersion(
      await aJpeg({ width: 3000, height: 2000 }),
    );
  });

  test.each([
    ['small', 400, 267],
    ['large', 2048, 1365],
  ])(
    'returns a %s WebP that fits within its size',
    async (size, width, height) => {
      const response = await request(`${versionUrl}/thumbnail?size=${size}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('image/webp');
      expect(await imageSize(response)).toEqual({
        format: 'webp',
        width,
        height,
      });
    },
  );

  test('turns it as asked, a quarter turn at a time', async () => {
    const response = await request(
      `${versionUrl}/thumbnail?size=small&rotate=90`,
    );

    expect(await imageSize(response)).toEqual({
      format: 'webp',
      width: 267,
      height: 400,
    });
  });

  test('refuses a turn that isn’t a quarter turn', async () => {
    const response = await request(
      `${versionUrl}/thumbnail?size=small&rotate=45`,
    );

    expect(response.status).toBe(422);
  });

  test('never enlarges a scan smaller than the thumbnail', async () => {
    versionUrl = await uploadVersion(
      await aJpeg({ width: 30, height: 20 }),
      '2026-015',
    );

    const response = await request(`${versionUrl}/thumbnail?size=small`);

    expect(await imageSize(response)).toMatchObject({ width: 30, height: 20 });
  });

  test('keeps thumbnails in the cache folder, not the archive', async () => {
    await request(`${versionUrl}/thumbnail?size=small`);

    const isWebp = (file: string): boolean => file.endsWith('.webp');
    const cached = await readdir(archive.cachePath(), { recursive: true });
    const archived = await readdir(archive.path(), { recursive: true });

    expect(cached.some(isWebp)).toBe(true);
    expect(archived.some(isWebp)).toBe(false);
  });

  test('rejects a size other than small or large', async () => {
    const response = await request(`${versionUrl}/thumbnail?size=huge`);

    expect(response.status).toBe(422);
  });

  test('returns 404 for a version that does not exist', async () => {
    const unknown = versionUrl.replace(/[^/]+$/, '01JC8Z7K3M0000000000000000');

    const response = await request(`${unknown}/thumbnail?size=small`);

    expect(response.status).toBe(404);
  });

  // Its address names its bytes, so the browser keeps it (FF-204, D114).
  test.each(['size=small', 'size=large', 'size=small&rotate=90'])(
    'lets the browser keep it for a year (%s)',
    async (query) => {
      const response = await request(`${versionUrl}/thumbnail?${query}`);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe(
        'private, max-age=31536000, immutable',
      );
    },
  );

  test('still carries the security headers every response has', async () => {
    const response = await request(`${versionUrl}/thumbnail?size=small`);

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'",
    );
  });

  test.each([
    [
      'a version that does not exist',
      404,
      () =>
        request(
          `${versionUrl.replace(/[^/]+$/, '01JC8Z7K3M0000000000000000')}/thumbnail?size=small`,
        ),
    ],
    [
      'a size that is not small or large',
      422,
      () => request(`${versionUrl}/thumbnail?size=huge`),
    ],
    [
      'a request from another site',
      403,
      () =>
        composeLocal({
          folderPath: archive.folder(),
          archivePath: archive.path(),
          cachePath: archive.cachePath(),
          port,
        }).request(`${origin}${versionUrl}/thumbnail?size=small`, {
          headers: { Origin: 'https://attacker.example' },
        }),
    ],
  ])('lets nothing be kept for %s', async (_case, status, send) => {
    const response = await send();

    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBeNull();
  });
});

describe('PATCH …/versions/{versionId}', () => {
  async function etagOf(url: string): Promise<string> {
    const rollUrl = url.split('/frames/')[0] ?? '';
    return (await request(rollUrl)).headers.get('ETag') ?? '';
  }

  function patch(url: string, body: unknown, ifMatch?: string) {
    return request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
      },
      body: JSON.stringify(body),
    });
  }

  beforeEach(async () => {
    versionUrl = await uploadVersion(await aJpeg());
  });

  test('turns the version, returning it and the roll’s new ETag', async () => {
    const etag = await etagOf(versionUrl);

    const response = await patch(versionUrl, { rotate: 90 }, etag);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ rotate: 90 });
    const roll = await request(versionUrl.split('/frames/')[0] ?? '');
    expect(response.headers.get('ETag')).toBe(roll.headers.get('ETag'));
    expect(await roll.json()).toMatchObject({
      frames: [{ versions: [{ rotate: 90 }] }],
    });
  });

  test('keeps the original file as it was', async () => {
    const before = await (await request(`${versionUrl}/file`)).arrayBuffer();

    await patch(versionUrl, { rotate: 180 }, await etagOf(versionUrl));

    const after = await (await request(`${versionUrl}/file`)).arrayBuffer();
    expect(Buffer.from(after).equals(Buffer.from(before))).toBe(true);
  });

  test.each([
    ['no If-Match', { rotate: 90 }, undefined, 428],
    ['a stale If-Match', { rotate: 90 }, '"stale"', 409],
    ['a turn that isn’t a quarter turn', { rotate: 45 }, 'etag', 422],
  ])('refuses %s', async (_case, body, ifMatch, status) => {
    const etag = ifMatch === 'etag' ? await etagOf(versionUrl) : ifMatch;

    expect((await patch(versionUrl, body, etag)).status).toBe(status);
  });
});
