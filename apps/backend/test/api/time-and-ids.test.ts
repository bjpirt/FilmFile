import { expect, test } from 'vitest';
import { FixedClock } from '../../src/adapters/outbound/memory/fixed-clock.ts';
import { SequentialIdGenerator } from '../../src/adapters/outbound/memory/sequential-id-generator.ts';
import { aJpeg } from '../support/a-jpeg.ts';
import { apiFor } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();

test('new rolls, frames and versions get their IDs and times from the clock and ID generator given', async () => {
  const { request, post } = apiFor(archive, {
    clock: new FixedClock('2026-11-02T12:00:00.000Z'),
    ids: new SequentialIdGenerator(),
  });

  const roll: unknown = await (
    await post('/api/rolls', { roll: '2026-014', shot: '2026' })
  ).json();
  const frame: unknown = await (
    await post('/api/rolls/00000000000000000000000001/frames', {})
  ).json();
  const version: unknown = await (
    await request(
      '/api/rolls/00000000000000000000000001/frames/00000000000000000000000002/versions?file=12340014.jpg',
      {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: new Uint8Array(await aJpeg()),
      },
    )
  ).json();

  expect(roll).toMatchObject({ id: '00000000000000000000000001' });
  expect(frame).toMatchObject({ id: '00000000000000000000000002' });
  expect(version).toMatchObject({
    id: '00000000000000000000000003',
    file: 'frames/00000002/00000003/12340014.jpg',
    added: '2026-11-02T12:00:00.000Z',
  });
});
