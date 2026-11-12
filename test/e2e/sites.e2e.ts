import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { expect, test } from './support/isolated-test.ts';
import { createRoll } from './support/journeys.ts';

test('sites: make one, choose its frames by a rule and by hand, rename it, find it all kept after a reload, and delete it (D91)', async ({
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

  // Frames by hand: one left off, one always included.
  await page
    .getByRole('button', { name: 'Never include Roll 2026-052, frame 2' })
    .click();
  await expect(page.getByText('5 frames match')).toBeVisible();
  await expect(page.getByText('Hidden: 1')).toBeVisible();
  await page
    .getByRole('button', { name: 'Always include Roll 2026-052, frame 3' })
    .click();
  await expect(page.getByText('Always included')).toBeVisible();

  // A rule: nothing is rated, so only the frame included by hand is left.
  await page.getByRole('button', { name: 'Add a rule ▾' }).click();
  await page.getByRole('menuitem', { name: 'Rated at least' }).click();
  await expect(page.getByText('1 frame matches')).toBeVisible();
  await expect(page.getByText('Saved')).toBeVisible();

  // Renaming moves the address; reloading finds everything kept.
  await page.getByLabel('Name').fill('Iceland 2026');
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(page).toHaveURL(/\/sites\/iceland-2026$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Iceland 2026' }),
  ).toBeVisible();
  await expect(page.getByText('1 frame matches')).toBeVisible();
  await expect(page.getByText('Hidden: 1')).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Rated at least' }),
  ).toHaveValue('4');

  // Put the frame back: the Hidden line goes.
  await page
    .getByRole('button', { name: 'Put back Roll 2026-052, frame 2' })
    .click();
  await expect(page.getByText(/^Hidden:/)).toHaveCount(0);

  // The Sites page lists it with its count; deleting asks first.
  await page.getByRole('link', { name: 'Sites' }).click();
  await expect(page.getByText('Iceland 2026 1 frame')).toBeVisible();
  await page.getByRole('link', { name: 'Iceland 2026' }).click();
  await page.getByRole('button', { name: 'Delete site…' }).click();
  await expect(page.getByText('Delete site Iceland 2026?')).toBeVisible();
  await page.getByRole('button', { name: 'Delete site', exact: true }).click();
  await expect(page).toHaveURL(/\/sites$/);
  await expect(
    page.getByText('No sites yet. Make one to share a set of frames.'),
  ).toBeVisible();
});
