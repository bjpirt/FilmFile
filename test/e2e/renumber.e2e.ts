import { expect, test } from '@playwright/test';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import {
  addScans,
  createRoll,
  framesShown,
  renumber,
} from './support/journeys.ts';

test('renumber a roll the lab scanned tail to head, and find the numbers saved after a reload', async ({
  page,
}) => {
  await createRoll(page, '2026-015');
  await addScans(page, fixtureSets.tailToHead);

  await renumber(page, { from: 'last', number: '1', direction: 'down' });
  await page.reload();
  await page.getByLabel('Scan order').check();

  // Each scan now carries the frame number drawn on it: 6, 5, 4, 3, 2, 1.
  await expect(framesShown(page)).toHaveText(
    fixtureSets.tailToHead.scans.map((scan) => scan.frameNumber),
  );
});
