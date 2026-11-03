import { expect, test } from '@playwright/test';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import {
  addScans,
  changeFrameNumber,
  createRoll,
  framesShown,
} from './support/journeys.ts';

test('catalogue a roll: add its scans, correct a number, and find it all still there after a reload', async ({
  page,
}) => {
  await createRoll(page, '2026-014');
  await addScans(page, fixtureSets.headToTail);

  await page.reload();

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
