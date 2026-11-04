import { describe, expect, test } from 'vitest';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

// A cross-site HTML form can only send text/plain, form or multipart bodies,
// so insisting on the expected type keeps forms from reaching the API.

const { request, post } = apiFor(useTempArchive());

function postWithType(
  url: string,
  body: BodyInit,
  contentType?: string,
): Promise<Response> {
  return request(url, {
    method: 'POST',
    body,
    ...(contentType === undefined
      ? {}
      : { headers: { 'Content-Type': contentType } }),
  });
}

describe('a JSON request body', () => {
  test.each([
    ['text/plain, as an HTML form can send', 'text/plain'],
    ['a form', 'application/x-www-form-urlencoded'],
    ['no content type', undefined],
  ])('is refused when sent as %s', async (_case, contentType) => {
    const response = await postWithType(
      '/api/rolls',
      '{"roll":"2026-014"}',
      contentType,
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({
      error: 'Content-Type must be application/json',
    });
  });

  test('is accepted with a charset', async () => {
    const response = await postWithType(
      '/api/rolls',
      '{"roll":"2026-014"}',
      'application/json; charset=utf-8',
    );

    expect(response.status).toBe(201);
  });

  test('is refused when creating a frame as text/plain', async () => {
    const roll = idOf(
      await (await post('/api/rolls', { roll: '2026-014' })).json(),
    );

    const response = await postWithType(
      `/api/rolls/${String(roll)}/frames`,
      '{}',
      'text/plain',
    );

    expect(response.status).toBe(415);
  });
});

describe('an uploaded scan', () => {
  test.each([
    ['text/plain', 'text/plain'],
    ['no content type', undefined],
  ])('is refused when sent as %s', async (_case, contentType) => {
    const roll = idOf(
      await (await post('/api/rolls', { roll: '2026-014' })).json(),
    );
    const frame = idOf(
      await (await post(`/api/rolls/${String(roll)}/frames`, {})).json(),
    );

    const response = await postWithType(
      `/api/rolls/${String(roll)}/frames/${String(frame)}/versions?file=12340014.jpg`,
      new Uint8Array(await aJpeg()),
      contentType,
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({
      error:
        'Content-Type must be one of image/jpeg, image/png, image/webp, image/tiff, image/x-sony-arw, application/octet-stream',
    });
  });
});
