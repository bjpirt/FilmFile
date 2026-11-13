import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { expect, test } from './support/isolated-test.ts';
import { createRoll } from './support/journeys.ts';

test('build a site: make one of two rolls’ frames, build it, open it in the browser, find an event under its year, its photos and a frame’s page, and no rolls, then change it, build again, rebuild from scratch and rebuild its pages only (D92, D107, FF-191, FF-193)', async ({
  page,
}) => {
  await createRoll(page, '2026-053', {
    year: '2026',
    month: 'September',
    newEvent: 'Westfjords walk',
    newCamera: { make: 'Olympus', model: 'OM-2' },
    scans: fixtureSets.headToTail,
  });
  await createRoll(page, '2026-054', { scans: fixtureSets.headToTail });

  await page.getByRole('link', { name: 'Sites' }).click();
  await page.getByRole('button', { name: 'New site' }).click();
  await page.getByLabel('Name').fill('Iceland');
  await page.getByRole('button', { name: 'Add site' }).click();
  await expect(page.getByText('12 frames match')).toBeVisible();
  await expect(page.getByText('Not built yet')).toBeVisible();
  // Its own title and copyright notice, apart from its name (D108).
  await page.getByLabel('Site title').fill('Iceland in September');
  await page.getByLabel('Copyright notice').fill('© The journeys');
  await page.getByLabel('Copyright notice').blur();
  await expect(page.getByRole('link', { name: 'Open site' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Build site' }).click();
  await expect(
    page.getByText(
      /^Site built in Sites\/iceland: 12 photos \(\d+ images? made, 0 unchanged\)\.$/,
    ),
  ).toBeVisible();
  await expect(page.getByText('Up to date')).toBeVisible();

  // Open it: the events under their years, newest first (D107).
  const [site] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('link', { name: 'Open site' }).click(),
  ]);
  await expect(
    site.getByRole('heading', { name: 'Iceland in September' }),
  ).toBeVisible();
  await expect(site.getByText('© The journeys')).toBeVisible();
  await expect(
    site.getByRole('heading', { name: '2026', exact: true }),
  ).toBeVisible();
  await expect(
    site.getByRole('heading', { name: /^Other (\d{4} )?photos$/ }),
  ).toBeVisible();

  // An event's card opens its page of photos.
  await site.getByRole('link', { name: /Westfjords walk/ }).click();
  await expect(
    site.getByRole('heading', { name: 'Westfjords walk', level: 1 }),
  ).toBeVisible();
  await expect(site.locator('.photo img')).toHaveCount(6);
  // A photo opens its own page with the filmstrip; → steps, Esc goes back (D105).
  await site.locator('.photo a').first().click();
  await expect(site.getByText('1 / 6')).toBeVisible();
  await expect(
    site.getByRole('navigation', { name: 'Filmstrip' }).getByRole('link'),
  ).toHaveCount(6);
  await expect(site.getByRole('link', { name: 'Previous frame' })).toHaveCount(
    0,
  );
  // Its camera is shown under it, as a new site shows camera, lens and film.
  await expect(site.getByText('Olympus OM-2')).toBeVisible();
  await site.keyboard.press('ArrowRight');
  await expect(site.getByText('2 / 6')).toBeVisible();
  // On a phone the filmstrip scrolls so the frame shown is in its middle
  // (as near as it can: not the last few, at the strip's end).
  await site.setViewportSize({ width: 320, height: 640 });
  await site
    .getByRole('navigation', { name: 'Filmstrip' })
    .getByRole('link')
    .nth(3)
    .click();
  await expect(site.getByText('4 / 6')).toBeVisible();
  const offCentre = await site.evaluate(() => {
    const strip = document.querySelector('.filmstrip');
    const shown = strip?.querySelector('[aria-current="page"]');
    if (!strip || !shown) return Infinity;
    const box = strip.getBoundingClientRect();
    const frame = shown.getBoundingClientRect();
    return Math.abs(frame.left + frame.width / 2 - (box.left + box.width / 2));
  });
  expect(offCentre).toBeLessThan(2);
  await site.setViewportSize({ width: 1280, height: 720 });
  await site.keyboard.press('Escape');
  await expect(
    site.getByRole('heading', { name: 'Westfjords walk', level: 1 }),
  ).toBeVisible();
  // At the foot, the one other card on the home page: the other roll's photos (D107).
  await expect(
    site.getByRole('navigation', { name: 'Other events' }).getByRole('link'),
  ).toHaveCount(1);
  await site.getByRole('link', { name: 'All events', exact: true }).click();

  // No roll is named anywhere on the site (D107).
  await expect(site.getByText('2026-053')).toHaveCount(0);
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

  // Rebuild from scratch: every image made again, though it was up to date (FF-191).
  await page.getByRole('button', { name: 'Rebuild from scratch' }).click();
  await expect(
    page.getByText(
      /^Site built in Sites\/iceland: 11 photos \([1-9]\d* images made, 0 unchanged\)\.$/,
    ),
  ).toBeVisible();
  await expect(page.getByText('Up to date')).toBeVisible();

  // Rebuild pages only: the pages written again, every image kept (FF-193).
  await page.getByRole('button', { name: 'Rebuild pages only' }).click();
  await expect(
    page.getByText(
      /^Site built in Sites\/iceland: 11 photos \(0 images made, [1-9]\d* unchanged\)\.$/,
    ),
  ).toBeVisible();
});
