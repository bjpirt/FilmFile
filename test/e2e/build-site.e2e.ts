import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { expect, test } from './support/isolated-test.ts';
import { createRoll } from './support/journeys.ts';

test('build a site: make one of two rolls’ frames, build it, open it in the browser, find the cards, a roll’s photos and a frame’s page, then change it and build again (D92)', async ({
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

  await page.getByRole('button', { name: 'Build site' }).click();
  await expect(
    page.getByText(
      /^Site built in Sites\/iceland: 12 photos \(\d+ images? made, 0 unchanged\)\.$/,
    ),
  ).toBeVisible();
  await expect(page.getByText('Up to date')).toBeVisible();

  // Open it: the event cards, then the roll cards from the menu (D104).
  const [site] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('link', { name: 'Open site' }).click(),
  ]);
  await expect(site.getByRole('heading', { name: 'Iceland' })).toBeVisible();
  await expect(
    site.getByRole('heading', { name: 'No event set' }),
  ).toBeVisible();
  await site
    .getByRole('navigation', { name: 'View by' })
    .getByRole('link', { name: 'Rolls' })
    .click();
  await expect(site.getByRole('heading', { name: '2026-053' })).toBeVisible();
  await expect(site.getByRole('heading', { name: '2026-054' })).toBeVisible();

  // A roll's card opens its page of photos, and leads back.
  await site.getByRole('link', { name: /^2026-053/ }).click();
  await expect(
    site.getByRole('heading', { name: '2026-053', level: 1 }),
  ).toBeVisible();
  await expect(site.locator('.photo img')).toHaveCount(6);
  // A photo opens its own page with the filmstrip; → steps, Esc goes back (D105).
  await site.locator('.photo a').first().click();
  await expect(site.getByText('1 of 6')).toBeVisible();
  await expect(
    site.getByRole('navigation', { name: 'Filmstrip' }).getByRole('link'),
  ).toHaveCount(6);
  await expect(site.getByRole('link', { name: 'Previous frame' })).toHaveCount(
    0,
  );
  await site.keyboard.press('ArrowRight');
  await expect(site.getByText('2 of 6')).toBeVisible();
  await site.keyboard.press('Escape');
  await expect(
    site.getByRole('heading', { name: '2026-053', level: 1 }),
  ).toBeVisible();
  await site.getByRole('link', { name: '← All rolls' }).click();
  await expect(site.getByRole('heading', { name: '2026-054' })).toBeVisible();
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
