import { expect, test } from '@playwright/test';
import { createRoll, rollsShown } from './support/journeys.ts';

// Rolls from years, and on a camera and film stock, no other journey uses,
// so its counts are its own.

test('find rolls: group by year, filter by year, camera or film stock, switch views, and keep it all through reloads', async ({
  page,
}) => {
  await createRoll(page, '2023-301', {
    camera: 'Leica M6',
    newFilmStock: { make: 'Agfa', name: 'Vista', iso: '200' },
  });
  await createRoll(page, '2024-302', { camera: 'Leica M6' });
  await createRoll(page, '2024-303', { filmStock: 'Agfa Vista 200' });
  await page.goto('/');

  await page.getByLabel('Group by').selectOption('year');
  await expect(
    page.getByRole('heading', { level: 2, name: '2024 2 rolls' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: '2023 1 roll' }),
  ).toBeVisible();

  const browse = page.getByRole('complementary', { name: 'Browse rolls' });
  await browse.getByRole('button', { name: /^2024/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Rolls from 2024' }),
  ).toBeVisible();
  await expect(rollsShown(page)).toHaveText(['2024-302', '2024-303']);

  await page.getByRole('button', { name: 'List' }).click();
  await expect(page.getByRole('table')).toBeVisible();

  // The address keeps the view, grouping and filter.
  await page.reload();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(rollsShown(page)).toHaveText(['2024-302', '2024-303']);

  // Back goes to the grid, still filtered.
  await page.goBack();
  await expect(page.getByRole('table')).toBeHidden();
  await expect(rollsShown(page)).toHaveText(['2024-302', '2024-303']);

  // Rolls shot on a camera, from any year, still grouped by year.
  await browse.getByRole('button', { name: /^Leica M6/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Rolls shot on Leica M6' }),
  ).toBeVisible();
  await expect(rollsShown(page)).toHaveText(['2024-302', '2023-301']);

  // Rolls of a film stock.
  await browse.getByRole('button', { name: /^Agfa Vista 200/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Rolls of Agfa Vista 200' }),
  ).toBeVisible();
  await expect(rollsShown(page)).toHaveText(['2024-303', '2023-301']);

  // The browse panel can be put away, and stays away after a reload.
  await page.getByRole('button', { name: 'Hide the browse panel' }).click();
  await expect(browse).toBeHidden();
  await page.reload();
  await expect(browse).toBeHidden();
  await page.getByRole('button', { name: 'Show the browse panel' }).click();
  await expect(browse).toBeVisible();
});
