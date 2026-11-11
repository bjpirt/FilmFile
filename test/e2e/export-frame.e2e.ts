import { readFile } from 'node:fs/promises';
import { imageSizeOf } from '../../apps/backend/test/support/image-size.ts';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { expect, test } from './support/isolated-test.ts';
import { createRoll } from './support/journeys.ts';

test('export a frame: choose a size and quality in its frame view and find the JPEG downloaded, named for the roll and frame', async ({
  page,
}) => {
  await createRoll(page, '2026-052', { scans: fixtureSets.headToTail });
  await page.getByRole('link', { name: 'Open frame 2' }).click();
  await expect(page.getByRole('heading', { name: 'Frame 2' })).toBeVisible();

  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export frame 2' });
  await expect(dialog).toContainText('This frame: 2 of roll 2026-052');
  await dialog.getByLabel('Size').selectOption({ label: '1024 px' });
  await dialog.getByLabel('Quality').fill('70');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download' }).click();

  const file = await download;
  expect(file.suggestedFilename()).toBe('2026-052-2.jpg');
  const path = await file.path();
  const { format, width, height } = await imageSizeOf(await readFile(path));
  expect(format).toBe('jpeg');
  expect(Math.max(width, height)).toBeLessThanOrEqual(1024);
  await expect(dialog).toHaveCount(0);

  // The choices are what it starts with next time.
  await page.reload();
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByLabel('Size')).toHaveValue('1024');
  await expect(page.getByLabel('Quality')).toHaveValue('70');
});
