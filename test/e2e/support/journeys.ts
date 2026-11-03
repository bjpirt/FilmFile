import { expect, type Locator, type Page } from '@playwright/test';
import {
  labScans,
  type FixtureSet,
} from '../../../apps/backend/test/support/lab-scans.ts';

// Steps several journeys share, written as a person would do them: by role,
// label and visible text. When the UI changes how a step is done, it changes
// here, and the journeys read the same (D22).

/** Creates a roll from the rolls page and opens it. */
export async function createRoll(
  page: Page,
  rollNumber: string,
): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Roll number').fill(rollNumber);
  await page.getByRole('button', { name: 'Create roll' }).click();
  await page.getByRole('link', { name: rollNumber }).click();
  await expect(
    page.getByRole('heading', { name: `Roll ${rollNumber}` }),
  ).toBeVisible();
}

/** Adds a fixture set's lab scans to the open roll. */
export async function addScans(page: Page, set: FixtureSet): Promise<void> {
  const scans = await labScans(set);
  await page.getByLabel('Choose lab scans').setInputFiles(
    scans.map(({ name, bytes }) => ({
      name,
      mimeType: 'image/jpeg',
      buffer: Buffer.from(bytes),
    })),
  );
  await expect(
    page.getByText(`Uploaded ${String(scans.length)} scans.`),
  ).toBeVisible();
}

/** Renumbers the open roll, e.g. "last scan is frame 1, counting down", and saves. */
export async function renumber(
  page: Page,
  {
    from,
    number,
    direction,
  }: { from: 'first' | 'last'; number: string; direction: 'up' | 'down' },
): Promise<void> {
  await page.getByRole('button', { name: 'Renumber…' }).click();
  await page.getByLabel('Which scan').selectOption(from);
  await page.getByLabel(`Frame number of the ${from} scan`).fill(number);
  await page.getByLabel('Counting').selectOption(direction);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByLabel('Which scan')).toBeHidden();
}

/** Changes one frame's number on the open roll. */
export async function changeFrameNumber(
  page: Page,
  from: string,
  to: string,
): Promise<void> {
  await page
    .getByRole('button', { name: `Change frame number ${from}` })
    .click();
  await page.getByLabel('Frame number', { exact: true }).fill(to);
  await page.getByLabel('Frame number', { exact: true }).press('Enter');
  await expect(
    page.getByRole('button', { name: `Change frame number ${to}` }),
  ).toBeVisible();
}

/** The open roll's frames, in the order shown; each one's text is its frame number. */
export function framesShown(page: Page): Locator {
  return page
    .getByRole('list', { name: 'Contact sheet' })
    .getByRole('listitem');
}
