import { expect, test } from '@playwright/test';

// Against the server whose FilmFile folder is never set up beforehand.
test.use({ baseURL: 'http://127.0.0.1:4312' });

test('first run: set FilmFile up before anything else, then change its settings and see where the folder is', async ({
  page,
}) => {
  await page.goto('/events');

  const setUp = page.getByRole('form', { name: 'Set up FilmFile' });
  await expect(
    page.getByRole('heading', { name: 'Set up FilmFile' }),
  ).toBeVisible();
  await setUp.getByLabel('Author').fill('Ben Pirt');
  await expect(setUp.getByLabel('Copyright')).toHaveValue(
    '© Ben Pirt. All rights reserved.',
  );
  await setUp.getByRole('button', { name: 'Set up' }).click();

  // The page asked for, now FilmFile is set up.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Events' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  const settings = page.getByRole('form', { name: 'Settings' });
  await expect(settings.getByLabel('Author')).toHaveValue('Ben Pirt');
  // The folder FilmFile is kept in, to select and copy, and how to change it.
  await expect(
    page.getByRole('heading', { name: 'FilmFile folder' }),
  ).toBeVisible();
  await expect(page.getByText(/filmfile-e2e-folder-/)).toBeVisible();
  await expect(
    page.getByText(
      'Change it in the app with File › Open FilmFile Folder…, or set FILMFILE_FOLDER and restart.',
    ),
  ).toBeVisible();

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
