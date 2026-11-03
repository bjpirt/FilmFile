import { expect, test } from '@playwright/test';
import { createRoll, rollsShown } from './support/journeys.ts';

// An event and rolls from a year no other journey uses, so its counts are
// its own.

test('organise by event: put rolls in an event, then find them from the Events page and the browse panel', async ({
  page,
}) => {
  await createRoll(page, '2021-501', { newEvent: 'Faroe Islands' });
  await expect(page.getByText('Faroe Islands')).toBeVisible();
  await createRoll(page, '2021-502', { event: 'Faroe Islands' });
  await createRoll(page, '2021-503');

  await page.getByRole('link', { name: 'Events' }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Faroe Islands' }),
  ).toHaveText('Faroe Islands2 rolls');

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
