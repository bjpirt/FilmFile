import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { expect, test } from './support/isolated-test.ts';
import { createRoll } from './support/journeys.ts';

test('sites: make one, preview its frames by roll and event, choose them by a rule, exclude one with its ×, rename it, find it all kept after a reload, and delete it (D91)', async ({
  page,
}) => {
  await createRoll(page, '2026-052', { scans: fixtureSets.headToTail });

  // The Sites page starts empty; a new site has every frame.
  await page.getByRole('link', { name: 'Sites' }).click();
  await expect(
    page.getByText('No sites yet. Make one to share a set of frames.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New site' }).click();
  await page.getByLabel('Name').fill('Iceland highlights');
  await page.getByRole('button', { name: 'Add site' }).click();
  await expect(
    page.getByRole('heading', { name: 'Iceland highlights' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/sites\/iceland-highlights$/);
  await expect(page.getByText('6 frames match')).toBeVisible();

  // The preview groups the frames by roll, or by event: these are in none.
  await expect(
    page.getByRole('heading', { name: '2026-052 · 6 frames' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Event' }).check();
  await expect(
    page.getByRole('heading', { name: 'No event set · 6 frames' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Roll' }).check();

  // The × excludes a frame: greyed in its place, and not counted.
  await page
    .getByRole('button', { name: 'Exclude Roll 2026-052, frame 2' })
    .click();
  await expect(page.getByText('5 frames match, 1 excluded')).toBeVisible();

  // A rule: nothing is rated, so no frame is found, the excluded one neither.
  await page.getByRole('button', { name: 'Add a rule ▾' }).click();
  await page.getByRole('menuitem', { name: 'Rated at least' }).click();
  await expect(page.getByText('No frames match')).toBeVisible();

  // Renaming moves the address; reloading finds everything kept.
  await page.getByLabel('Name').fill('Iceland 2026');
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(page).toHaveURL(/\/sites\/iceland-2026$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Iceland 2026' }),
  ).toBeVisible();
  await expect(page.getByText('No frames match')).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Rated at least' }),
  ).toHaveValue('4');

  // Without the rule the excluded frame is found again, still excluded.
  await page
    .getByRole('button', { name: 'Remove rule: Rated at least' })
    .click();
  await expect(page.getByText('5 frames match, 1 excluded')).toBeVisible();

  // The ↺ includes it again.
  await page
    .getByRole('button', { name: 'Include Roll 2026-052, frame 2 again' })
    .click();
  await expect(page.getByText('6 frames match')).toBeVisible();

  // The Sites page lists it with its count; deleting asks first.
  await page.getByRole('link', { name: 'Sites' }).click();
  await expect(page.getByText('Iceland 2026 6 frames')).toBeVisible();
  await page.getByRole('link', { name: 'Iceland 2026' }).click();
  await page.getByRole('button', { name: 'Delete site…' }).click();
  await expect(page.getByText('Delete site Iceland 2026?')).toBeVisible();
  await page.getByRole('button', { name: 'Delete site', exact: true }).click();
  await expect(page).toHaveURL(/\/sites$/);
  await expect(
    page.getByText('No sites yet. Make one to share a set of frames.'),
  ).toBeVisible();
});
