import { expect, type Locator, type Page } from '@playwright/test';
import {
  labScans,
  type FixtureSet,
} from '../../../apps/backend/test/support/lab-scans.ts';

// Steps several journeys share, written as a person would do them: by role,
// label and visible text. When the UI changes how a step is done, it changes
// here, and the journeys read the same (D22).

/** A new roll's details, all optional; the date as the new roll page asks for it. */
export interface NewRoll {
  readonly name?: string;
  readonly description?: string;
  readonly year?: string;
  readonly month?: string;
  readonly day?: string;
  readonly time?: string;
  /** A camera the archive has, as the list shows it, e.g. "Nikon FE". */
  readonly camera?: string;
  /** A camera to add, from Add new…. */
  readonly newCamera?: { readonly make: string; readonly model: string };
  /** A lens to add, from Add new…. */
  readonly newLens?: {
    readonly make: string;
    readonly name: string;
    readonly focalLength?: string;
    readonly maxAperture?: string;
  };
  /** A film stock the archive has, as the list shows it, e.g. "Kodak Portra 400". */
  readonly filmStock?: string;
  /** A film stock to add, from Add new…. */
  readonly newFilmStock?: {
    readonly make: string;
    readonly name: string;
    readonly iso?: string;
    readonly format?: string;
  };
  readonly scans?: FixtureSet;
}

async function scanFiles(set: FixtureSet) {
  return (await labScans(set)).map(({ name, bytes }) => ({
    name,
    mimeType: 'image/jpeg',
    buffer: Buffer.from(bytes),
  }));
}

/** Creates a roll on the new roll page, with any details and scans given, and opens it. */
export async function createRoll(
  page: Page,
  rollNumber: string,
  details: NewRoll = {},
): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'New roll' }).click();
  await page.getByLabel('Roll number').fill(rollNumber);
  if (details.name !== undefined) {
    await page.getByLabel('Name').fill(details.name);
  }
  if (details.description !== undefined) {
    await page.getByLabel('Description').fill(details.description);
  }
  if (details.year !== undefined) {
    await page.getByLabel('Year').fill(details.year);
  }
  if (details.month !== undefined) {
    await page.getByLabel('Month').selectOption({ label: details.month });
  }
  if (details.day !== undefined) {
    await page.getByLabel('Day').selectOption({ label: details.day });
  }
  if (details.time !== undefined) {
    await page.getByLabel('Time').fill(details.time);
  }
  if (details.camera !== undefined) {
    await page.getByLabel('Camera').selectOption({ label: details.camera });
  }
  if (details.newCamera !== undefined) {
    await addCamera(page, details.newCamera);
  }
  if (details.newLens !== undefined) {
    const { make, name, focalLength, maxAperture } = details.newLens;
    await page.getByLabel('Lens').selectOption({ label: 'Add new…' });
    const newLens = page.getByRole('group', { name: 'New lens' });
    await newLens.getByLabel('Make').fill(make);
    await newLens.getByLabel('Name').fill(name);
    if (focalLength !== undefined) {
      await newLens.getByLabel('Focal length').fill(focalLength);
    }
    if (maxAperture !== undefined) {
      await newLens.getByLabel('Max aperture').fill(maxAperture);
    }
  }
  if (details.filmStock !== undefined) {
    await page
      .getByLabel('Film stock')
      .selectOption({ label: details.filmStock });
  }
  if (details.newFilmStock !== undefined) {
    const { make, name, iso, format } = details.newFilmStock;
    await page.getByLabel('Film stock').selectOption({ label: 'Add new…' });
    const newFilmStock = page.getByRole('group', { name: 'New film stock' });
    await newFilmStock.getByLabel('Make').fill(make);
    await newFilmStock.getByLabel('Name').fill(name);
    if (iso !== undefined) {
      await newFilmStock.getByLabel('ISO').fill(iso);
    }
    if (format !== undefined) {
      await newFilmStock.getByLabel('Format').selectOption({ label: format });
    }
  }
  if (details.scans !== undefined) {
    await page
      .getByLabel('Choose scans')
      .setInputFiles(await scanFiles(details.scans));
  }
  await page.getByRole('button', { name: 'Create roll' }).click();
  await expect(
    page.getByRole('heading', { name: `Roll ${rollNumber}` }),
  ).toBeVisible();
}

/** Chooses Add new… for the camera and gives the new camera's make and model. */
export async function addCamera(
  page: Page,
  { make, model }: { readonly make: string; readonly model: string },
): Promise<void> {
  await page.getByLabel('Camera').selectOption({ label: 'Add new…' });
  const newCamera = page.getByRole('group', { name: 'New camera' });
  await newCamera.getByLabel('Make').fill(make);
  await newCamera.getByLabel('Model').fill(model);
}

/** Adds a fixture set's lab scans to the open roll. */
export async function addScans(page: Page, set: FixtureSet): Promise<void> {
  const chooser = page.getByLabel('Choose scans');
  // On a roll with frames, the drop zone opens from Add scans.
  if (!(await chooser.isVisible())) {
    await page.getByRole('button', { name: 'Add scans' }).click();
  }
  await chooser.setInputFiles(await scanFiles(set));
  await expect(
    page.getByText(`Uploaded ${String(set.scans.length)} scans.`),
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

/** The rolls shown on the rolls page, by roll number, in order. */
export function rollsShown(page: Page): Locator {
  return page.getByRole('main').getByRole('link', { name: /^\d{4}-\d{3}$/ });
}
