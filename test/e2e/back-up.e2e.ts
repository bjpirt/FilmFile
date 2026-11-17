import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { expect, test } from './support/isolated-test.ts';
import { journeyAccountId, journeyBackupBucket } from './support/journey-r2.ts';
import { createRoll } from './support/journeys.ts';

test('back up the library: set the Cloudflare account and a bucket, sync everything, change the copyright and sync only what changed, then sync from the header (FF-225, FF-226)', async ({
  page,
}) => {
  await createRoll(page, '2026-081', { scans: fixtureSets.headToTail });

  await page.goto('/settings');
  const cloudflare = page.getByRole('form', { name: 'Cloudflare' });
  await cloudflare.getByLabel('Account ID').fill(journeyAccountId);
  await cloudflare.getByRole('button', { name: 'Save' }).click();
  await expect(cloudflare.getByText('Saved the account ID.')).toBeVisible();

  const sync = page.getByRole('region', { name: 'Sync' });
  await expect(sync.getByText('Say which bucket to sync with.')).toBeVisible();
  const where = sync.getByRole('form', { name: 'Where to sync' });
  await where.getByLabel('Bucket').fill(journeyBackupBucket);
  await where.getByLabel("This computer's name").fill('Journey computer');
  await where.getByRole('button', { name: 'Save' }).click();
  await expect(sync.getByText('Not synced yet')).toBeVisible();

  await sync.getByRole('button', { name: 'Sync' }).click();
  await expect(sync.getByText(/^Synced .+$/)).toBeVisible({ timeout: 30_000 });
  await expect(sync.getByText(/^Sent \d+ files \(.+\)\.$/)).toBeVisible();

  // Syncing again with nothing changed sends nothing.
  await sync.getByRole('button', { name: 'Sync' }).click();
  await expect(sync.getByText('Nothing had changed.')).toBeVisible({
    timeout: 30_000,
  });

  // A change to the settings is the one file sent.
  await page.getByLabel('Copyright').fill('© The journeys');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.goto('/settings');
  await sync.getByRole('button', { name: 'Sync' }).click();
  await expect(sync.getByText(/^Sent 1 file \(.+\)\.$/)).toBeVisible({
    timeout: 30_000,
  });

  // From any page, the header says how the backup stands and syncs (FF-226).
  await page.goto('/events');
  const header = page.getByRole('banner');
  await header.getByRole('button', { name: 'Synced just now' }).click();
  const panel = page.getByRole('dialog', { name: 'Sync' });
  await panel.getByRole('button', { name: 'Sync' }).click();
  await expect(panel.getByText('Nothing had changed.')).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    header.getByRole('button', { name: 'Synced just now' }),
  ).toBeVisible();
});
