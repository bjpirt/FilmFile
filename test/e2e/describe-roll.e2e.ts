import { expect, test } from '@playwright/test';
import { createRoll } from './support/journeys.ts';

test('describe a roll: add its name, description, date shot and a new camera later, and find them on the roll and in the rolls list', async ({
  page,
}) => {
  await createRoll(page, '2025-401');

  await page.getByRole('button', { name: 'Edit details' }).click();
  const details = page.getByRole('form', { name: 'Roll details' });
  await details.getByLabel('Name').fill('Westfjords');
  await details.getByLabel('Description').fill('Puffins at Látrabjarg.');
  await details.getByLabel('Month').selectOption({ label: 'June' });
  await details.getByLabel('Camera').fill('Olympus OM-1');
  await details.getByRole('button', { name: 'Save details' }).click();

  await expect(details).toBeHidden();
  await page.reload();
  await expect(page.getByText('Westfjords')).toBeVisible();
  await expect(page.getByText('Olympus OM-1')).toBeVisible();
  await expect(page.getByText('Jun 2025')).toBeVisible();
  await expect(page.getByText('Puffins at Látrabjarg.')).toBeVisible();

  await page.getByRole('link', { name: 'All rolls' }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: '2025-401' }),
  ).toContainText('WestfjordsOlympus OM-1 · Jun 2025');
});
