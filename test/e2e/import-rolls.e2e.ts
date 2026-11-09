import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  fixtureSets,
  labScans,
  type FixtureSet,
} from '../../apps/backend/test/support/lab-scans.ts';
import { expect, test } from './support/isolated-test.ts';
import { framesShown, rollsShown } from './support/journeys.ts';

/** A folder of roll folders on disk, each with a fixture set's scans. */
async function aLabDownload(
  rolls: Record<string, FixtureSet>,
): Promise<string> {
  const lab = path.join(
    await mkdtemp(path.join(tmpdir(), 'filmfile-lab-')),
    'lab',
  );
  for (const [name, set] of Object.entries(rolls)) {
    const folder = path.join(lab, name);
    await mkdir(folder, { recursive: true });
    for (const { name: file, bytes } of await labScans(set)) {
      await writeFile(path.join(folder, file), bytes);
    }
  }
  return lab;
}

test('import a folder of roll folders: see each roll previewed with its date and number, import them, and find the rolls with their scans after a reload', async ({
  page,
}) => {
  const lab = await aLabDownload({
    '2031 Iceland': fixtureSets.headToTail,
    '2032 Norway': fixtureSets.tailToHead,
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'More roll actions' }).click();
  await page.getByRole('menuitem', { name: 'Bulk import rolls…' }).click();
  await page.getByLabel('Choose folder').setInputFiles(lab);

  const rows = page.getByRole('table', { name: 'Rolls to import' });
  await expect(rows.getByRole('row', { name: /2031 Iceland/ })).toContainText(
    '2031-001',
  );
  await expect(rows.getByRole('row', { name: /2032 Norway/ })).toContainText(
    '2032-001',
  );
  await page.getByRole('button', { name: 'Import 2 rolls' }).click();

  await expect(page.getByText('Imported 2 rolls, 12 frames.')).toBeVisible();
  await page.reload();
  await page.goto('/');
  await expect(rollsShown(page)).toHaveText(['2031-001', '2032-001']);

  await page.getByRole('link', { name: '2031-001', exact: true }).click();
  await expect(page.getByText('2031 Iceland')).toBeVisible();
  await expect(framesShown(page)).toHaveText(['1', '2', '3', '4', '5', '6']);
});
