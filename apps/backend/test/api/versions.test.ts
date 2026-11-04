import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { aJpeg } from '../support/a-jpeg.ts';
import { anImage } from '../support/an-image.ts';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

let rollId = '';
let frameId = '';

beforeEach(async () => {
  rollId = String(
    idOf(await (await post('/api/rolls', { roll: '2026-014' })).json()),
  );
  frameId = String(
    idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
  );
});

function upload(
  image: Buffer,
  query = 'file=12340014.jpg',
  frame = frameId,
): Promise<Response> {
  return request(`/api/rolls/${rollId}/frames/${frame}/versions?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: new Uint8Array(image),
  });
}

describe('POST /api/rolls/{id}/frames/{frameId}/versions', () => {
  test.each([
    ['png', 'image/png', 'edit.png'],
    ['webp', 'image/webp', 'edit.webp'],
  ] as const)(
    'adds a %s, and gives it back with its own type',
    async (format, type, file) => {
      const image = await anImage(format, { width: 30, height: 20 });

      const response = await request(
        `/api/rolls/${rollId}/frames/${frameId}/versions?file=${file}`,
        {
          method: 'POST',
          headers: { 'Content-Type': type },
          body: new Uint8Array(image),
        },
      );
      expect(response.status).toBe(201);
      const version: unknown = await response.json();
      expect(version).toMatchObject({ width: 30, height: 20 });

      const original = await request(
        `/api/rolls/${rollId}/frames/${frameId}/versions/${String(idOf(version))}/file`,
      );
      expect(original.headers.get('Content-Type')).toBe(type);
      expect(Buffer.from(await original.arrayBuffer()).equals(image)).toBe(
        true,
      );
    },
  );

  test('refuses an image that is none of JPEG, PNG and WebP, whatever it claims', async () => {
    const gif = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0,
    ]);

    const response = await request(
      `/api/rolls/${rollId}/frames/${frameId}/versions?file=edit.png`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: gif,
      },
    );

    expect(response.status).toBe(415);
  });

  test('stores the scan unchanged in a folder for the version, inside a folder for the frame', async () => {
    const image = await aJpeg();

    const versionId = String(idOf(await (await upload(image)).json()));

    const stored = await readFile(
      path.join(
        archive.path(),
        'rolls/2026/2026-014/frames',
        frameId.slice(-8),
        versionId.slice(-8),
        '12340014.jpg',
      ),
    );
    expect(stored.equals(image)).toBe(true);
  });

  test('returns the version with its ID, hash, size and pixel dimensions', async () => {
    const image = await aJpeg({ width: 30, height: 20 });

    const response = await upload(image);
    const version: unknown = await response.json();

    expect(response.status).toBe(201);
    expect(version).toMatchObject({
      file: `frames/${frameId.slice(-8)}/${String(idOf(version)).slice(-8)}/12340014.jpg`,
      sha256: createHash('sha256').update(image).digest('hex'),
      bytes: image.length,
      width: 30,
      height: 20,
    });
    expect(idOf(version)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test('adds the version to its frame', async () => {
    const version: unknown = await (await upload(await aJpeg())).json();

    const roll: unknown = await (await request(`/api/rolls/${rollId}`)).json();

    expect(roll).toMatchObject({
      frames: [{ id: frameId, versions: [version] }],
    });
  });

  test('refuses a scan that is already in the roll', async () => {
    const image = await aJpeg();
    await upload(image);
    const otherFrame = String(
      idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
    );

    const response = await upload(image, 'file=12340015.jpg', otherFrame);

    expect(response.status).toBe(409);
  });

  test('keeps both of two different scans with the same name', async () => {
    const first = await aJpeg({ shade: 50 });
    const second = await aJpeg({ shade: 200 });

    const versions: unknown[] = [
      await (await upload(first)).json(),
      await (await upload(second)).json(),
    ];

    const roll: unknown = await (await request(`/api/rolls/${rollId}`)).json();
    expect(roll).toMatchObject({ frames: [{ versions }] });
    const files = await Promise.all(
      versions.map((version) =>
        readFile(
          path.join(
            archive.path(),
            'rolls/2026/2026-014/frames',
            frameId.slice(-8),
            String(idOf(version)).slice(-8),
            '12340014.jpg',
          ),
        ),
      ),
    );
    expect(files.map((file) => file.equals(first))).toEqual([true, false]);
    expect(files.map((file) => file.equals(second))).toEqual([false, true]);
  });

  test('returns 404 for a frame that is not in the roll', async () => {
    const response = await upload(
      await aJpeg(),
      undefined,
      '01JC8Z7K3M0000000000000000',
    );

    expect(response.status).toBe(404);
  });

  test.each([
    ['an unsafe file name', 'file=../12340014.jpg'],
    ['a file name with a folder', 'file=scans/12340014.jpg'],
    ['a file name that isn’t an image’s', 'file=12340014.gif'],
    ['no file name', ''],
  ])('rejects %s', async (_case, query) => {
    const response = await upload(await aJpeg(), query);

    expect(response.status).toBe(422);
  });
});
