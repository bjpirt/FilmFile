import { expect, test } from '@playwright/test';

// Against the server whose archive is never set up beforehand.
test.use({ baseURL: 'http://127.0.0.1:4312' });

test('first run: set the archive up before anything else, then change its settings', async ({
  page,
}) => {
  await page.goto('/events');

  const setUp = page.getByRole('form', { name: 'Set up your archive' });
  await expect(
    page.getByRole('heading', { name: 'Set up your archive' }),
  ).toBeVisible();
  await setUp.getByLabel('Author').fill('Ben Pirt');
  await expect(setUp.getByLabel('Copyright')).toHaveValue(
    '© Ben Pirt. All rights reserved.',
  );
  await setUp.getByRole('button', { name: 'Set up archive' }).click();

  // The page asked for, now the archive is set up.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Events' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  const settings = page.getByRole('form', { name: 'Settings' });
  await expect(settings.getByLabel('Author')).toHaveValue('Ben Pirt');
  await settings.getByLabel('Copyright').fill('© 2026 Ben Pirt');
  await settings.getByRole('button', { name: 'Save' }).click();

  // Saved, it goes back to the rolls; the settings are there when reopened.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Rolls' }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(settings.getByLabel('Copyright')).toHaveValue('© 2026 Ben Pirt');
});
