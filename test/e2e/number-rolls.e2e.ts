import { expect, test } from './support/isolated-test.ts';
import { chooseAction, createRoll, rollsShown } from './support/journeys.ts';

test('number filtered rolls by shot date around filed and filtered-out numbers', async ({
  page,
}) => {
  await createRoll(page, '2037-001', { year: '2036' });
  await chooseAction(page, 'Mark as filed');
  await expect(page.getByRole('img', { name: 'Filed' })).toBeVisible();

  await createRoll(page, '2037-002', { year: '2038' });
  await createRoll(page, '2038-011', { year: '2037', month: 'October' });
  await createRoll(page, '2038-012', { year: '2037', month: 'February' });
  await page.goto('/');

  const browse = page.getByRole('complementary', { name: 'Browse rolls' });
  await browse.getByRole('button', { name: /^2037/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Rolls from 2037' }),
  ).toBeVisible();
  await expect(rollsShown(page)).toHaveText(['2038-011', '2038-012']);

  await page.getByRole('button', { name: 'Number rolls…' }).click();
  await expect(page.getByText('2037-003', { exact: true })).toBeVisible();
  await expect(page.getByText('2037-004', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Apply' }).click();

  await browse.getByRole('button', { name: /^All rolls/ }).click();
  for (const number of ['2037-001', '2037-002', '2037-003', '2037-004']) {
    await expect(
      page.getByRole('main').getByRole('link', { name: number, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByRole('img', { name: 'Filed' })).toBeVisible();
});
