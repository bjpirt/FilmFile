import { expect, test } from './support/isolated-test.ts';
import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';
import {
  addScans,
  createRoll,
  framesShown,
  renumber,
} from './support/journeys.ts';

test('renumber a roll the lab scanned tail to head, and find the numbers saved after a reload', async ({
  page,
}) => {
  await createRoll(page, '2026-015');
  await addScans(page, fixtureSets.tailToHead);

  await renumber(page, { from: 'last', number: '1', direction: 'down' });
  await page.reload();

  // In frame order, each frame is now the scan with its number drawn on it.
  await expect(framesShown(page)).toHaveText(['1', '2', '3', '4', '5', '6']);
  const byNumber = [...fixtureSets.tailToHead.scans].sort(
    (a, b) => Number(a.frameNumber) - Number(b.frameNumber),
  );
  const pictures = page
    .getByRole('list', { name: 'Contact sheet' })
    .getByRole('img');
  for (const [i, scan] of byNumber.entries()) {
    await expect(pictures.nth(i)).toHaveAttribute('alt', scan.name);
  }
});
