import { expect, test } from '@playwright/test';
import {
  fixtureSets,
  labScans,
} from '../../apps/backend/test/support/lab-scans.ts';

test('create a roll, add its lab scans, correct a number, and find it all still there after a reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Roll number').fill('2026-014');
  await page.getByRole('button', { name: 'Create roll' }).click();
  await page.getByRole('link', { name: '2026-014' }).click();

  const scans = await labScans(fixtureSets.headToTail);
  await page.getByLabel('Choose lab scans').setInputFiles(
    scans.map(({ name, bytes }) => ({
      name,
      mimeType: 'image/jpeg',
      buffer: Buffer.from(bytes),
    })),
  );
  await expect(page.getByText('Uploaded 6 scans.')).toBeVisible();

  await page.reload();

  const thumbnails = page.getByRole('img');
  await expect(thumbnails).toHaveCount(6);
  for (const thumbnail of await thumbnails.all()) {
    // Loaded, not a broken image: the CSP and the thumbnail route both allow it.
    await expect
      .poll(() =>
        thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  for (const number of ['1', '2', '3', '4', '5', '6']) {
    await expect(page.getByText(number, { exact: true })).toBeVisible();
  }

  // Correct one frame's number, and find it saved after another reload.
  await page.getByRole('button', { name: 'Change frame number 6' }).click();
  await page.getByLabel('Frame number', { exact: true }).fill('6A');
  await page.getByLabel('Frame number', { exact: true }).press('Enter');
  await expect(
    page.getByRole('button', { name: 'Change frame number 6A' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('6A', { exact: true })).toBeVisible();
});
