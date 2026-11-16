import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { expect, test } from './support/isolated-test.ts';
import { journeyAccountId, journeyBucket } from './support/journey-r2.ts';
import { createRoll } from './support/journeys.ts';

test('publish a site: set the Cloudflare account in Settings and a site’s bucket, publish it, see it up to date, change and build it, see files to update, publish again and unpublish (FF-234, FF-236)', async ({
  page,
}) => {
  // The account, once, in Settings; the keys are in the journey's own credentials file.
  await page.goto('/settings');
  const cloudflare = page.getByRole('form', { name: 'Cloudflare' });
  await expect(
    cloudflare.getByText(
      'Keys: found in the [filmfile] profile of ~/.aws/credentials',
    ),
  ).toBeVisible();
  await cloudflare.getByLabel('Account ID').fill(journeyAccountId);
  await cloudflare.getByRole('button', { name: 'Save' }).click();
  await expect(cloudflare.getByText('Saved the account ID.')).toBeVisible();

  await createRoll(page, '2026-071', { scans: fixtureSets.headToTail });
  await page.getByRole('link', { name: 'Sites' }).click();
  await page.getByRole('button', { name: 'New site' }).click();
  await page.getByLabel('Name').fill('Harbour');
  await page.getByRole('button', { name: 'Add site' }).click();

  const publish = page.getByRole('region', { name: 'Publish' });
  await expect(
    publish.getByText('Say where to publish the site.'),
  ).toBeVisible();
  const where = publish.getByRole('form', { name: 'Where to publish' });
  await where.getByLabel('Bucket').fill(journeyBucket);
  await where.getByLabel('Address').fill('https://photos.example.com');
  await where.getByRole('button', { name: 'Save' }).click();
  await expect(
    publish.getByText('Not built yet: Publish builds it first.'),
  ).toBeVisible();

  // Publishing builds the site first, then uploads it.
  await publish.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(publish.getByText(/^Published .+, up to date$/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    publish.getByRole('link', { name: 'View site' }),
  ).toHaveAttribute('href', 'https://photos.example.com');

  // A change, built, leaves the bucket behind the site.
  await page.getByLabel('Site title').fill('The harbour');
  await page.getByLabel('Site title').blur();
  await page.getByRole('button', { name: 'Build site' }).click();
  await expect(page.getByText('Up to date', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    publish.getByText(/^Published .+: \d+ files? to update$/),
  ).toBeVisible({ timeout: 10_000 });

  await publish.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(publish.getByText(/^Published .+, up to date$/)).toBeVisible({
    timeout: 30_000,
  });

  // Unpublishing asks first, then empties the bucket.
  await publish.getByRole('button', { name: 'Unpublish…' }).click();
  const asking = page.getByRole('alertdialog', { name: 'Unpublish Harbour' });
  await expect(
    asking.getByText(
      /^Unpublish Harbour\? This removes [\d,]+ files from journey-site\.$/,
    ),
  ).toBeVisible();
  await asking.getByRole('button', { name: 'Unpublish' }).click();
  await expect(publish.getByText('Not published')).toBeVisible();
});
