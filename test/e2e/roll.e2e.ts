import { expect, test } from '@playwright/test';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import {
  changeFrameNumber,
  createRoll,
  framesShown,
} from './support/journeys.ts';

test('catalogue a roll: create it with its details and scans, correct a number, and find it all still there after a reload', async ({
  page,
}) => {
  await createRoll(page, '2026-014', {
    name: 'Iceland, first day',
    description: 'Jökulsárlón at dawn.',
    month: 'September',
    day: '14',
    time: '06:30',
    camera: 'Nikon FE',
    newFilmStock: {
      make: 'Kodak',
      name: 'Portra',
      iso: '400',
      format: '35mm',
    },
    scans: fixtureSets.headToTail,
  });

  await page.reload();

  await expect(page.getByText('Iceland, first day')).toBeVisible();
  await expect(page.getByText('Nikon FE')).toBeVisible();
  await expect(page.getByText('Kodak Portra 400')).toBeVisible();
  await expect(page.getByText('14 Sep 2026, 06:30')).toBeVisible();
  await expect(page.getByText('Jökulsárlón at dawn.')).toBeVisible();
  await expect(framesShown(page)).toHaveText(['1', '2', '3', '4', '5', '6']);
  for (const thumbnail of await page.getByRole('img').all()) {
    // Loaded, not a broken image: the CSP and the thumbnail route both allow it.
    await expect
      .poll(() =>
        thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
  }

  await changeFrameNumber(page, '6', '6A');
  await page.reload();

  await expect(framesShown(page)).toHaveText(['1', '2', '3', '4', '5', '6A']);
});
