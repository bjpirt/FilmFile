import { readFile } from 'node:fs/promises';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import { readZip } from '../../apps/backend/test/support/read-zip.ts';
import { expect, test } from './support/isolated-test.ts';
import { chooseAction, createRoll } from './support/journeys.ts';

test('export selected frames: pick some of a roll’s frames, choose a layout and names, and find a zip of them downloaded', async ({
  page,
}) => {
  await createRoll(page, '2026-054', { scans: fixtureSets.headToTail });

  await chooseAction(page, 'Bulk actions');
  await page.getByRole('checkbox', { name: 'Select frame 2' }).click();
  await page.getByRole('checkbox', { name: 'Select frame 4' }).click();
  await page.getByRole('button', { name: 'Export…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export 2 frames' });
  await expect(dialog).toContainText('2 selected frames');
  await dialog.getByLabel('Size').selectOption({ label: '1024 px' });
  await dialog
    .getByLabel('Layout')
    .selectOption({ label: 'A folder per roll' });
  await dialog.getByLabel('File names').fill('{roll}-{frame}');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download' }).click();

  const file = await download;
  expect(file.suggestedFilename()).toBe('2026-054.zip');
  const zip = readZip(new Uint8Array(await readFile(await file.path())));
  expect(zip.map(({ name }) => name)).toEqual([
    '2026-054/2026-054-2.jpg',
    '2026-054/2026-054-4.jpg',
  ]);
  // Each file is a JPEG.
  for (const { data } of zip) {
    expect([...data.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  }
  await expect(dialog).toHaveCount(0);
});
