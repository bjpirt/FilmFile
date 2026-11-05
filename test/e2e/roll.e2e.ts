import { expect, test } from '@playwright/test';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import {
  changeFrameNumber,
  chooseAction,
  createRoll,
  deleteFrame,
  rollsShown,
  framesShown,
} from './support/journeys.ts';

test('catalogue a roll: create it with its details and scans, correct a number, delete a frame, find it all still there after a reload, look through it frame by frame, describe a frame and delete it, then delete the roll', async ({
  page,
}) => {
  await createRoll(page, '2026-014', {
    name: 'Iceland, first day',
    notes: 'Jökulsárlón at dawn.',
    month: 'September',
    day: '14',
    time: '06:30',
    newCamera: { make: 'Nikon', model: 'FE' },
    newLens: {
      make: 'Nikon',
      name: 'Nikkor AI-S',
      focalLength: '50',
      maxAperture: '1.8',
    },
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
  await expect(page.getByText('Nikon Nikkor AI-S 50mm f/1.8')).toBeVisible();
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

  await deleteFrame(page, '6A');
  await page.reload();

  await expect(framesShown(page)).toHaveText(['1', '2', '3', '4', '5']);

  // Look through the frames large, then back to the roll.
  await page.getByRole('link', { name: 'Open frame 1' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Frame 1' }),
  ).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Frame 2' }),
  ).toBeVisible();
  await page
    .getByRole('list', { name: 'Filmstrip' })
    .getByRole('link', { name: 'Frame 5' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Frame 5' }),
  ).toBeVisible();
  // Describe it: a title, saved on leaving the field, and a rating from the keys.
  await page.getByRole('button', { name: 'Show details' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Ice on black sand');
  await page.getByRole('textbox', { name: 'Notes' }).focus();
  await expect(page.getByText('Ice on black sand')).toBeVisible();
  await page.getByRole('textbox', { name: 'Notes' }).blur();
  await page.keyboard.press('4');
  await expect(page.getByLabel('Rated 4 of 5', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Frame 5' }),
  ).toBeVisible();
  await expect(page.getByText('Ice on black sand')).toBeVisible();
  await expect(page.getByLabel('Rated 4 of 5', { exact: true })).toBeVisible();

  // Delete it from the frame view, which moves on to the frame before.
  await page.getByRole('button', { name: 'Delete frame' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete frame 5' })
    .getByRole('button', { name: 'Delete' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Frame 4' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { name: 'Roll 2026-014' }),
  ).toBeVisible();
  await expect(framesShown(page)).toHaveText(['1', '2', '3', '4']);

  await chooseAction(page, 'Delete roll…');
  await page
    .getByRole('alertdialog', { name: 'Delete roll 2026-014' })
    .getByRole('button', { name: 'Delete roll' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Rolls' }),
  ).toBeVisible();
  await expect(rollsShown(page).filter({ hasText: '2026-014' })).toHaveCount(0);
});
