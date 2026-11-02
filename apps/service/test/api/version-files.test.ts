import { readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { beforeEach, describe, expect, test } from 'vitest';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

let versionUrl = '';

async function uploadVersion(
  image: Buffer,
  roll = '2026-014',
): Promise<string> {
  const rollId = String(
    idOf(await (await post('/api/rolls', { roll })).json()),
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
});
