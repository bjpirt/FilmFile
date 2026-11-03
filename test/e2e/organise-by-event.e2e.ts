import { expect, test } from '@playwright/test';
import { createRoll, rollsShown } from './support/journeys.ts';

// An event and rolls from a year no other journey uses, so its counts are
// its own.

test('organise by event: put rolls in an event, give it a date and add another on the Events page, and find the rolls from both ways in', async ({
  page,
}) => {
  await createRoll(page, '2021-501', { newEvent: 'Faroe Islands' });
  await expect(page.getByText('Faroe Islands')).toBeVisible();
  await createRoll(page, '2021-502', { event: 'Faroe Islands' });
  await createRoll(page, '2021-503');

  await page.getByRole('link', { name: 'Events' }).click();
  await page.getByRole('button', { name: 'Edit Faroe Islands' }).click();
  const edit = page.getByRole('form', { name: 'Edit Faroe Islands' });
  await edit.getByLabel('Year').fill('2021');
  await edit.getByLabel('Month').selectOption({ label: 'June' });
  await edit.getByRole('button', { name: 'Save event' }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Faroe Islands' }),
  ).toHaveText('Faroe Islands · Jun 20212 rollsEdit');

  await page.getByRole('button', { name: 'New event' }).click();
  const add = page.getByRole('form', { name: 'New event' });
  await add.getByLabel('Name').fill('Shetland 2021');
  await add.getByRole('button', { name: 'Add event' }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Shetland 2021' }),
  ).toHaveText('Shetland 20210 rollsEdit');

  await page.getByRole('link', { name: 'Faroe Islands' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Rolls at Faroe Islands' }),
  ).toBeVisible();
  await expect(rollsShown(page)).toHaveText(['2021-501', '2021-502']);

  // The browse panel offers the same way in.
  await page.getByRole('button', { name: /^All rolls/ }).click();
  await page
    .getByRole('complementary', { name: 'Browse rolls' })
    .getByRole('button', { name: /^Faroe Islands/ })
    .click();
  await expect(rollsShown(page)).toHaveText(['2021-501', '2021-502']);
});
