import { rm } from 'node:fs/promises';
import path from 'node:path';
import { settings } from '../../packages/contracts/src/settings.ts';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { expect, test } from './support/isolated-test.ts';
import { journeyAccountId, journeyBackupBucket } from './support/journey-r2.ts';
import {
  changeFrameNumber,
  createRoll,
  deleteFrame,
} from './support/journeys.ts';

test('back up the library: set the Cloudflare account and a bucket, stop the first sync part-way and carry it on, change the copyright and sync only what changed, sync from the header, then copy a renumbered frame and remove what was emptied from deleted/ (FF-225, FF-226, FF-241, FF-238)', async ({
  page,
}) => {
  await createRoll(page, '2026-081', { scans: fixtureSets.headToTail });
  const roll = page.url();

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

  // The first sync, stopped part-way, says how far it got (FF-241).
  await sync.getByRole('button', { name: 'Sync' }).click();
  await expect(
    // Some files backed up, not all: the fake R2 takes a while over each.
    sync.getByText(/^Backed up .+ of .+ \([1-9]\d* of \d+ files\)$/),
  ).toBeVisible({
    timeout: 30_000,
  });
  await sync.getByRole('button', { name: 'Cancel' }).click();
  await expect(
    sync.getByText(
      'Sync stopped. The next sync carries on where this one left off.',
    ),
  ).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(
    page
      .getByRole('banner')
      .getByRole('button', { name: /^First sync \d+% done$/ }),
  ).toBeVisible();
  await expect(
    sync.getByText(
      /^The first sync didn't finish: .+ backed up\. Sync carries on from there\.$/,
    ),
  ).toBeVisible();

  // Syncing again carries on, sending the rest.
  await sync.getByRole('button', { name: 'Sync' }).click();
  await expect(sync.getByText(/^Synced .+$/)).toBeVisible({ timeout: 30_000 });
  await expect(sync.getByText(/^Sent \d+ files? \(.+\)\.$/)).toBeVisible();

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

  // A renumbered frame is copied inside the bucket, not uploaded again (FF-238).
  await page.goto(roll);
  await changeFrameNumber(page, '6', '7');
  await page.goto('/settings');
  await sync.getByRole('button', { name: 'Sync' }).click();
  await expect(
    sync.getByText(/^Sent 1 file \(.+\) and copied 1 renamed file\.$/),
  ).toBeVisible({ timeout: 30_000 });

  // A frame deleted and emptied from deleted/ by hand leaves the backup once agreed.
  await page.goto(roll);
  await deleteFrame(page, '5');
  const { folder } = settings.parse(
    await (await page.request.get('/api/settings')).json(),
  );
  await rm(path.join(folder, 'Library', 'deleted'), { recursive: true });
  await page.goto('/settings');
  await sync.getByRole('button', { name: 'Sync' }).click();
  await expect(
    sync.getByText(
      /^This sync will also remove \d+ files? from the backup that are no longer in the library \(.+\)\.$/,
    ),
  ).toBeVisible({ timeout: 30_000 });
  await expect(header.getByRole('button', { name: 'Waiting…' })).toBeVisible();
  await sync.getByRole('button', { name: 'Remove them' }).click();
  await expect(
    sync.getByText(/removed \d+ files? from the backup\.$/),
  ).toBeVisible({ timeout: 30_000 });
});
