import { expect, test } from '@playwright/test';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { createRoll } from './support/journeys.ts';

test('bulk edit: select some of a roll’s frames and give them another camera, leaving the rest with the roll’s', async ({
  page,
}) => {
  // A second camera in the archive, shot on for part of the next roll.
  await createRoll(page, '2026-041', {
    newCamera: { make: 'Minolta', model: 'X-700' },
  });
  await createRoll(page, '2026-042', {
    newCamera: { make: 'Pentax', model: 'MX' },
    scans: fixtureSets.headToTail,
  });

  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: 'Select frame 2' }).click();
  await page
    .getByRole('checkbox', { name: 'Select frame 4' })
    .click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Set camera…' }).click();
  const setCamera = page.getByRole('form', { name: 'Set camera' });
  await setCamera
    .getByLabel('Camera for 3 frames')
    .selectOption({ label: 'Minolta X-700' });
  await setCamera.getByRole('button', { name: 'Set' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Camera set on 3 frames.' }),
  ).toBeVisible();

  await page.reload();

  // Frames 2 to 4 are marked as having their own camera; 1, 5 and 6 aren't.
  await expect(page.getByText('Its own camera')).toHaveCount(3);
  await page.getByRole('link', { name: 'Open frame 3' }).click();
  const toggle = page.getByRole('button', { name: 'Show details' });
  if (await toggle.isVisible()) {
    await toggle.click();
  }
  const about = page.getByRole('complementary', { name: 'About this frame' });
  await expect(about.getByText('Minolta X-700')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Frame 5' }),
  ).toBeVisible();
  await expect(about.getByText('Pentax MX')).toBeVisible();
});
