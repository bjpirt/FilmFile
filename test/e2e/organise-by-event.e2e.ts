import { expect, test, type Page } from '@playwright/test';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { createRoll } from './support/journeys.ts';

// An event and rolls from a year no other journey uses, so its counts are
// its own.

/** The frames on an event's page, each as "Frame N of roll YYYY-NNN". */
function eventFrames(page: Page) {
  return page.getByRole('list', { name: 'Frames' }).getByRole('listitem');
}

test('organise by event: put rolls in an event, date it and add another on the Events page, and see its frames from every roll', async ({
  page,
}) => {
  await createRoll(page, '2021-501', {
    newEvent: 'Faroe Islands',
    scans: fixtureSets.headToTail,
  });
  await expect(page.getByText('Faroe Islands')).toBeVisible();
  await createRoll(page, '2021-502', {
    event: 'Faroe Islands',
    scans: fixtureSets.labSkippedFrame,
  });
  await createRoll(page, '2021-503');

  await page.getByRole('link', { name: 'Events' }).click();
  await page.getByRole('button', { name: 'Edit Faroe Islands' }).click();
  const edit = page.getByRole('form', { name: 'Edit Faroe Islands' });
  await edit.getByLabel('Year').fill('2021');
  await edit.getByLabel('Month').selectOption({ label: 'June' });
  await edit.getByRole('button', { name: 'Save event' }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Faroe Islands' }),
  ).toHaveText('Faroe Islands2 rolls · 11 photos · Jun 2021Edit');

  await page.getByRole('button', { name: 'New event' }).click();
  const add = page.getByRole('form', { name: 'New event' });
  await add.getByLabel('Name').fill('Shetland 2021');
  await add.getByRole('button', { name: 'Add event' }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Shetland 2021' }),
  ).toHaveText('Shetland 20210 rolls · 0 photosEdit');

  // The event is its frames, from both rolls, not the rolls themselves.
  await page.getByRole('link', { name: 'Faroe Islands' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Faroe Islands' }),
  ).toBeVisible();
  await expect(page.getByText('11 frames')).toBeVisible();
  await expect(eventFrames(page)).toHaveCount(11);

  await page.getByLabel('Group by').selectOption({ label: 'Roll' });
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    '2021-501 6 frames',
    '2021-502 5 frames',
  ]);
  await page.reload();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    '2021-501 6 frames',
    '2021-502 5 frames',
  ]);

  // The browse panel leads to the same page.
  await page.goto('/');
  await page
    .getByRole('complementary', { name: 'Browse rolls' })
    .getByRole('link', { name: /^Faroe Islands/ })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Faroe Islands' }),
  ).toBeVisible();
});
