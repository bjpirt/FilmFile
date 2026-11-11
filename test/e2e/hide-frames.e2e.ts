import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { expect, test } from './support/isolated-test.ts';
import { chooseAction, createRoll } from './support/journeys.ts';

test('hide frames: from a thumbnail and from the frame view, see them counted, show them and unhide one (D99)', async ({
  page,
}) => {
  await createRoll(page, '2026-051', { scans: fixtureSets.headToTail });
  await expect(page.getByText('6 frames')).toBeVisible();

  // From a thumbnail: the frame leaves the sheet and is counted.
  await page.getByRole('button', { name: 'Hide frame 2' }).click();
  await expect(page.getByRole('link', { name: 'Open frame 2' })).toHaveCount(0);
  await expect(page.getByText('5 frames (1 hidden)')).toBeVisible();

  // From the frame view, with H, which moves on.
  await page.getByRole('link', { name: 'Open frame 3' }).click();
  await expect(page.getByRole('heading', { name: 'Frame 3' })).toBeVisible();
  await page.keyboard.press('h');
  await expect(page.getByRole('heading', { name: 'Frame 4' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('4 frames (2 hidden)')).toBeVisible();

  // Show them, and unhide one by its closed eye; it survives a reload.
  await chooseAction(page, 'Show hidden frames');
  await expect(page).toHaveURL(/\?hidden=show$/);
  await page.getByRole('button', { name: 'Unhide frame 2' }).click();
  await expect(page.getByText('6 frames (1 hidden)')).toBeVisible();
  await page.reload();
  await expect(page.getByText('6 frames (1 hidden)')).toBeVisible();
});
