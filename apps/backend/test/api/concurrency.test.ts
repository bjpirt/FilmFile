import { roll, type Frame } from '@filmfile/contracts/rolls';
import { expect, test } from 'vitest';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const { request, post } = apiFor(useTempArchive());

async function aRoll(): Promise<string> {
  return String(
    idOf(await (await post('/api/rolls', { roll: '2026-014' })).json()),
  );
}

async function framesOf(rollId: string): Promise<Frame[]> {
  return roll.parse(await (await request(`/api/rolls/${rollId}`)).json())
    .frames;
}

test('a roll comes with an ETag, which changes when the roll does', async () => {
  const rollId = await aRoll();
  const before = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');

  await post(`/api/rolls/${rollId}/frames`, {});
  const after = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');

  expect(before).toMatch(/^"[0-9a-f]{64}"$/);
  expect(after).toMatch(/^"[0-9a-f]{64}"$/);
  expect(after).not.toBe(before);
});

test('frames created at the same time all land', async () => {
  const rollId = await aRoll();

  const responses = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      post(`/api/rolls/${rollId}/frames`, { number: String(i + 1) }),
    ),
  );

  expect(responses.map((r) => r.status)).toEqual(Array(10).fill(201));
  expect(await framesOf(rollId)).toHaveLength(10);
});

test('scans uploaded at the same time all land', async () => {
  const rollId = await aRoll();
  const frameIds: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    frameIds.push(
      String(
        idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
      ),
    );
  }

  const responses = await Promise.all(
    frameIds.map(async (frameId, i) =>
      request(
        `/api/rolls/${rollId}/frames/${frameId}/versions?file=1234000${String(i)}.jpg`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: new Uint8Array(await aJpeg({ shade: i * 40 })),
        },
      ),
    ),
  );

  expect(responses.map((r) => r.status)).toEqual(Array(5).fill(201));
  const frames = await framesOf(rollId);
  expect(frames.map((frame) => frame.versions.length)).toEqual([1, 1, 1, 1, 1]);
});
