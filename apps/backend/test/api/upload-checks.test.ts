import { readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { beforeEach, describe, expect, test } from 'vitest';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

let versionsUrl = '';

beforeEach(async () => {
  const rollId = String(
    idOf(await (await post('/api/rolls', { roll: '2026-014' })).json()),
  );
  const frameId = String(
    idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
  );
  versionsUrl = `/api/rolls/${rollId}/frames/${frameId}/versions?file=12340014.jpg`;
});

function upload(body: BodyInit): Promise<Response> {
  return request(versionsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body,
    // Needed by Node to send a stream as a request body.
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  });
}

/** Files stored for the roll's frames, to check that a refused upload left nothing. */
async function storedFiles(): Promise<string[]> {
  const frames = path.join(archive.path(), 'rolls/2026/2026-014/frames');
  return readdir(frames, { recursive: true }).catch(() => []);
}

/** A stream of zeros, sent a megabyte at a time, as a large upload would arrive. */
function megabytes(count: number): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull: (controller) => {
      if (sent === count) {
        controller.close();
        return;
      }
      sent += 1;
      controller.enqueue(new Uint8Array(1024 * 1024));
    },
  });
}

/** A real JPEG whose header claims more pixels than it has, as a decompression bomb would. */
async function aJpegClaiming(
  width: number,
  height: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const image = new Uint8Array(await aJpeg());
  const frameHeader = image.findIndex(
    (byte, i) => byte === 0xff && image[i + 1] === 0xc0,
  );
  // After the marker: length (2 bytes), precision (1), height (2), width (2).
  new DataView(image.buffer).setUint16(frameHeader + 5, height);
  new DataView(image.buffer).setUint16(frameHeader + 7, width);
  return image;
}

describe('an uploaded scan', () => {
  test('is refused once it passes 200 MB, without being stored', async () => {
    const response = await upload(megabytes(201));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: 'The file is larger than 200 MB.',
    });
    expect(await storedFiles()).toEqual([]);
  });

  test('is refused when it is not really a JPEG, whatever its name and type say', async () => {
    const png = await sharp({
      create: { width: 3, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();

    const response = await upload(new Uint8Array(png));

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: 'The file is not a JPEG.' });
    expect(await storedFiles()).toEqual([]);
  });

  test('is refused when it starts like a JPEG but cannot be read', async () => {
    const response = await upload(
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: 'The file could not be read as an image.',
    });
    expect(await storedFiles()).toEqual([]);
  });

  test('is refused when it has more than 100 megapixels', async () => {
    const response = await upload(await aJpegClaiming(20_000, 10_000));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: 'The image has more than 100 megapixels.',
    });
    expect(await storedFiles()).toEqual([]);
  });

  test('is accepted at exactly 100 megapixels', async () => {
    const response = await upload(await aJpegClaiming(10_000, 10_000));

    expect(response.status).toBe(201);
  });
});
