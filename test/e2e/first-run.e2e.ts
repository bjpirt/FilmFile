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
  await setUp.getByLabel('Name').fill('Ben’s film archive');
  await setUp.getByLabel('Author').fill('Ben Pirt');
  await setUp.getByRole('button', { name: 'Set up archive' }).click();

  // The page asked for, now the archive is set up.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Events' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  const settings = page.getByRole('form', { name: 'Settings' });
  await expect(settings.getByLabel('Author')).toHaveValue('Ben Pirt');
  await settings.getByLabel('Copyright').fill('© Ben Pirt');
  await settings.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');

  await page.reload();

  await expect(settings.getByLabel('Name')).toHaveValue('Ben’s film archive');
  await expect(settings.getByLabel('Copyright')).toHaveValue('© Ben Pirt');
});
