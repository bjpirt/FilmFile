import { beforeEach, describe, expect, test } from 'vitest';
import { searchFramesResponse } from '@filmfile/contracts/selections';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

beforeEach(async () => {
  await post('/api/settings', { author: 'Ben Pirt' });
});

async function aRoll(body: Record<string, unknown>): Promise<string> {
  const created: unknown = await (
    await post('/api/rolls', { shot: '2026', ...body })
  ).json();
  return String(idOf(created));
}

/** A frame on the roll, with these details set on it. */
async function aFrame(
  rollId: string,
  details: Record<string, unknown> = {},
): Promise<string> {
  const created: unknown = await (
    await post(`/api/rolls/${rollId}/frames`, {})
  ).json();
  const frameId = String(idOf(created));
  if (Object.keys(details).length > 0) {
    const etag =
      (await request(`/api/rolls/${rollId}`)).headers.get('ETag') ?? '';
    const patched = await request(`/api/rolls/${rollId}/frames/${frameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify(details),
    });
    expect(patched.status).toBe(200);
  }
  return frameId;
}

const search = (selection: Record<string, unknown>) =>
  post('/api/frames/search', {
    rules: [],
    pinned: [],
    hidden: [],
    ...selection,
  });

async function found(selection: Record<string, unknown>): Promise<string[]> {
  const body = searchFramesResponse.parse(
    await (await search(selection)).json(),
  );
  return body.frames.map((frame) => frame.frameId);
}

describe('POST /api/frames/search', () => {
  test('with no rules finds every frame, with how many', async () => {
    const roll = await aRoll({ roll: '2026-001' });
    const one = await aFrame(roll);
    const two = await aFrame(roll);

    const response = await search({});

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      count: 2,
      frames: [
        { rollId: roll, frameId: one, why: 'rules' },
        { rollId: roll, frameId: two, why: 'rules' },
      ],
    });
  });

  test('finds the frames rated at least so many stars', async () => {
    const roll = await aRoll({ roll: '2026-001' });
    await aFrame(roll, { rating: 3 });
    const four = await aFrame(roll, { rating: 4 });
    const five = await aFrame(roll, { rating: 5 });
    await aFrame(roll);

    expect(await found({ rules: [{ kind: 'rating', atLeast: 4 }] })).toEqual([
      four,
      five,
    ]);
  });

  test('finds the frames in an event, their own or their roll’s', async () => {
    await post('/api/events', { name: 'Iceland' });
    await post('/api/events', { name: 'Norway' });
    const iceland = await aRoll({ roll: '2026-001', event: 'iceland' });
    const norway = await aRoll({ roll: '2026-002', event: 'norway' });
    const inherited = await aFrame(iceland);
    const own = await aFrame(norway, { event: 'iceland' });
    await aFrame(norway);

    expect(
      await found({ rules: [{ kind: 'event', events: ['iceland'] }] }),
    ).toEqual([inherited, own]);
  });

  test('puts frames in shot order, a frame’s own date first', async () => {
    const later = await aRoll({ roll: '2026-001', shot: '2026-09' });
    const earlier = await aRoll({ roll: '2026-002', shot: '2026-03' });
    const a = await aFrame(later);
    const b = await aFrame(earlier);
    const c = await aFrame(later, { shot: '2026-01' });

    expect(await found({})).toEqual([c, b, a]);
  });

  test('compares dates at the precision of the limit', async () => {
    const roll = await aRoll({ roll: '2026-001' });
    const august = await aFrame(roll, { shot: '2026-08-31' });
    const september = await aFrame(roll, { shot: '2026-09-14' });
    const october = await aFrame(roll, { shot: '2026-10-01' });

    expect(
      await found({ rules: [{ kind: 'shot-after', date: '2026-09' }] }),
    ).toEqual([september, october]);
    expect(
      await found({ rules: [{ kind: 'shot-before', date: '2026-09' }] }),
    ).toEqual([august, september]);
  });

  test('includes a pinned frame whatever the rules say, and says so', async () => {
    const roll = await aRoll({ roll: '2026-001' });
    const rated = await aFrame(roll, { rating: 5 });
    const pinned = await aFrame(roll);

    const response = await search({
      rules: [{ kind: 'rating', atLeast: 5 }],
      pinned: [{ rollId: roll, frameId: pinned }],
    });

    expect(await response.json()).toEqual({
      count: 2,
      frames: [
        { rollId: roll, frameId: rated, why: 'rules' },
        { rollId: roll, frameId: pinned, why: 'pinned' },
      ],
    });
  });

  test('leaves out a frame left off by hand', async () => {
    const roll = await aRoll({ roll: '2026-001' });
    const one = await aFrame(roll);
    const two = await aFrame(roll);

    expect(await found({ hidden: [{ rollId: roll, frameId: one }] })).toEqual([
      two,
    ]);
  });

  test('never finds a hidden frame, even a pinned one', async () => {
    const roll = await aRoll({ roll: '2026-001' });
    await aFrame(roll);
    const hidden = await aFrame(roll, { hidden: true });

    expect(
      await found({ pinned: [{ rollId: roll, frameId: hidden }] }),
    ).toHaveLength(1);
  });

  test('skips a pinned frame that is no longer there', async () => {
    const roll = await aRoll({ roll: '2026-001' });
    const one = await aFrame(roll);

    expect(
      await found({
        pinned: [{ rollId: roll, frameId: '0'.repeat(26) }],
      }),
    ).toEqual([one]);
  });

  test.each([
    ['an unknown rule', { rules: [{ kind: 'colour', is: 'red' }] }],
    ['a rating of six stars', { rules: [{ kind: 'rating', atLeast: 6 }] }],
    [
      'a date that is not a date',
      { rules: [{ kind: 'shot-after', date: '2026-13' }] },
    ],
    ['a badly made roll ID', { rules: [{ kind: 'roll', rolls: ['nope'] }] }],
    [
      'a badly made slug',
      { rules: [{ kind: 'event', events: ['Not A Slug'] }] },
    ],
    ['a missing list', { rules: [], pinned: undefined }],
  ])('refuses %s', async (_name, selection) => {
    expect((await search(selection)).status).toBe(422);
  });

  test('refuses a body that is not JSON', async () => {
    const response = await request('/api/frames/search', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{}',
    });

    expect(response.status).toBe(415);
  });
});
