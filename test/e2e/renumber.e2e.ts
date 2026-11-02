import { expect, test } from '@playwright/test';
import {
  fixtureSets,
  labScans,
} from '../../apps/backend/test/support/lab-scans.ts';

test('renumber a roll the lab scanned tail to head, and find the numbers saved after a reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Roll number').fill('2026-015');
  await page.getByRole('button', { name: 'Create roll' }).click();
  await page.getByRole('link', { name: '2026-015' }).click();
  const scans = await labScans(fixtureSets.tailToHead);
  await page.getByLabel('Choose lab scans').setInputFiles(
    scans.map(({ name, bytes }) => ({
      name,
      mimeType: 'image/jpeg',
      buffer: Buffer.from(bytes),
    })),
  );
  await expect(page.getByText('Uploaded 6 scans.')).toBeVisible();

  await page.getByRole('button', { name: 'Renumber…' }).click();
  await page.getByLabel('Which scan').selectOption('last');
  await page.getByLabel('Frame number of the last scan').fill('1');
  await page.getByLabel('Counting').selectOption('down');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByLabel('Which scan')).toBeHidden();

  await page.reload();
  await page.getByLabel('Scan order').check();
  // Each scan now carries the frame number drawn on it: 6, 5, 4, 3, 2, 1.
  await expect(page.locator('.contact-sheet .frame-number')).toHaveText(
    fixtureSets.tailToHead.scans.map((scan) => scan.frameNumber),
  );
});
