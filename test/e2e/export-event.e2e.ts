import { readFile } from 'node:fs/promises';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { readZip } from '../../apps/backend/test/support/read-zip.ts';
import { expect, test } from './support/isolated-test.ts';
import { createRoll } from './support/journeys.ts';

test('export an event’s frames: select some from two rolls on its page and find a zip named for the event, each frame from its own roll', async ({
  page,
}) => {
  await createRoll(page, '2021-601', {
    newEvent: 'Harbour trip',
    scans: fixtureSets.headToTail,
  });
  await createRoll(page, '2021-602', {
    event: 'Harbour trip',
    scans: fixtureSets.labSkippedFrame,
  });

  await page.getByRole('link', { name: 'Events' }).click();
  await page.getByRole('link', { name: 'Harbour trip' }).click();
  await expect(page.getByText('11 frames')).toBeVisible();
  await page.getByLabel('Group by').selectOption({ label: 'Roll' });

  await page.getByRole('button', { name: 'Select' }).click();
  await page
    .getByRole('checkbox', { name: 'Select frame 1 of roll 2021-601' })
    .click();
  await page
    .getByRole('checkbox', { name: 'Select frame 1 of roll 2021-602' })
    .click();
  await expect(page.getByRole('status', { name: 'Selection' })).toHaveText(
    '2 frames selected',
  );
  await page.getByRole('button', { name: 'Export…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export 2 frames' });
  await dialog
    .getByLabel('Layout')
    .selectOption({ label: 'A folder per roll' });
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download' }).click();

  const file = await download;
  expect(file.suggestedFilename()).toBe('Harbour trip.zip');
  const zip = readZip(new Uint8Array(await readFile(await file.path())));
  expect(zip.map(({ name }) => name)).toEqual([
    '2021-601/2021-601-1.jpg',
    '2021-602/2021-602-1.jpg',
  ]);
});
