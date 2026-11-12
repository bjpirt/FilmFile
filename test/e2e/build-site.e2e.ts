import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { expect, test } from './support/isolated-test.ts';
import { createRoll } from './support/journeys.ts';

test('build a site: make one of two rolls’ frames, build it, open it in the browser and find the photos, then change it and build again (D92)', async ({
  page,
}) => {
  await createRoll(page, '2026-053', { scans: fixtureSets.headToTail });
  await createRoll(page, '2026-054', { scans: fixtureSets.headToTail });

  await page.getByRole('link', { name: 'Sites' }).click();
  await page.getByRole('button', { name: 'New site' }).click();
  await page.getByLabel('Name').fill('Iceland');
  await page.getByRole('button', { name: 'Add site' }).click();
  await expect(page.getByText('12 frames match')).toBeVisible();
  await expect(page.getByText('Not built yet')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open site' })).toHaveCount(0);

  // Group the photos by roll before building.
  // "Build site" waits until the choice is saved, so the build uses it.
  await page.getByLabel('Group by').selectOption({ label: 'Roll' });

  await page.getByRole('button', { name: 'Build site' }).click();
  await expect(
    page.getByText(
      /^Site built in Sites\/iceland: 12 photos \(\d+ images? made, 0 unchanged\)\.$/,
    ),
  ).toBeVisible();
  await expect(page.getByText('Up to date')).toBeVisible();

  // Open it: the photos are there, under a heading for each roll.
  const [site] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('link', { name: 'Open site' }).click(),
  ]);
  await expect(site.getByRole('heading', { name: 'Iceland' })).toBeVisible();
  await expect(site.getByRole('heading', { name: '2026-053' })).toBeVisible();
  await expect(site.getByRole('heading', { name: '2026-054' })).toBeVisible();
  await expect(site.locator('.photo img')).toHaveCount(12);
  // The lightbox opens a photo, and Esc closes it.
  await site.locator('.photo a').first().click();
  await expect(site.getByRole('dialog')).toBeVisible();
  await site.keyboard.press('Escape');
  await expect(site.getByRole('dialog')).toHaveCount(0);
  await site.close();

  // Exclude a frame: out of date; building again makes no new image.
  await page
    .getByRole('button', { name: 'Exclude Roll 2026-053, frame 2' })
    .click();
  await expect(page.getByText('Out of date: 1 removed')).toBeVisible();
  await page.getByRole('button', { name: 'Build site' }).click();
  await expect(
    page.getByText(
      /^Site built in Sites\/iceland: 11 photos \(0 images made, \d+ unchanged\)\.$/,
    ),
  ).toBeVisible();
  await expect(page.getByText('Up to date')).toBeVisible();
});
