import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { aLabScan, fixtureSets, labScans } from './lab-scans.ts';

/** How much of the image is lit: the drawn segments are white on dark grey. */
async function brightness(image: Uint8Array): Promise<number> {
  const { channels } = await sharp(image).stats();
  return channels[0]?.mean ?? 0;
}

describe('aLabScan', () => {
  test('is a small JPEG', async () => {
    expect(await sharp(await aLabScan('12')).metadata()).toMatchObject({
      format: 'jpeg',
      width: 240,
      height: 160,
    });
  });

  test('shows its frame number: 8 lights every segment, 1 only two', async () => {
    expect(await brightness(await aLabScan('8'))).toBeGreaterThan(
      await brightness(await aLabScan('1')),
    );
  });

  test.each(['00', '12A', '14-15'])('can show %s', async (frameNumber) => {
    expect(await brightness(await aLabScan(frameNumber))).toBeGreaterThan(
      await brightness(await aLabScan('')),
    );
  });

  test('refuses a character it cannot draw', async () => {
    await expect(aLabScan('12B')).rejects.toThrow("can't draw B");
  });
});

describe('fixture sets', () => {
  test('name scans as the lab does: batch, then scan index', () => {
    expect(fixtureSets.headToTail.scans.map((s) => s.name)).toEqual([
      '12340001.jpg',
      '12340002.jpg',
      '12340003.jpg',
      '12340004.jpg',
      '12340005.jpg',
      '12340006.jpg',
    ]);
  });

  test.each([
    ['headToTail', ['1', '2', '3', '4', '5', '6']],
    ['tailToHead', ['6', '5', '4', '3', '2', '1']],
    ['labSkippedFrame', ['1', '2', '3', '5', '6']],
    ['startingAt00', ['00', '0', '1', '2', '3', '4']],
    ['with12A', ['10', '11', '12', '12A', '13', '14']],
  ] as const)('%s holds frames %j in scan order', (set, frameNumbers) => {
    expect(fixtureSets[set].scans.map((s) => s.frameNumber)).toEqual(
      frameNumbers,
    );
  });

  test('each set has its own lab batch, so their files never clash', () => {
    const batches = Object.values(fixtureSets).map((set) => set.batch);

    expect(new Set(batches).size).toBe(batches.length);
  });

  test('render as one distinct image per scan', async () => {
    const scans = await labScans(fixtureSets.with12A);

    expect(scans.map((s) => s.name)).toEqual(
      fixtureSets.with12A.scans.map((s) => s.name),
    );
    expect(
      new Set(scans.map((s) => Buffer.from(s.bytes).toString('base64'))).size,
    ).toBe(scans.length);
  });
});
