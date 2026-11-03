import type { ApiClient } from '@filmfile/contracts/client';
import type { LensChoice, NewLens } from './lens-choice.ts';
import { lensLabel } from './use-lenses.ts';

/** The lens chosen, by slug (null for none), or why there isn't one. */
export type ChosenLens =
  | { readonly ok: true; readonly slug: string | null }
  | { readonly ok: false; readonly problem: string };

function problem(text: string): ChosenLens {
  return { ok: false, problem: text };
}

/** A number as typed, null for none, or undefined if it isn't a positive number. */
function numberIn(typed: string): number | null | undefined {
  const text = typed.trim();
  if (text === '') {
    return null;
  }
  return /^\d+(\.\d+)?$/.test(text) && Number(text) > 0
    ? Number(text)
    : undefined;
}

/** The slug of the lens chosen, creating it now if it's new. */
export async function chooseLens(
  api: ApiClient,
  choice: LensChoice,
): Promise<ChosenLens> {
  switch (choice.kind) {
    case 'none':
      return { ok: true, slug: null };
    case 'existing':
      return { ok: true, slug: choice.slug };
    case 'new':
      return createLens(api, choice.details);
  }
}

async function createLens(
  api: ApiClient,
  details: NewLens,
): Promise<ChosenLens> {
  const make = details.make.trim();
  const name = details.name.trim();
  const focalLength = numberIn(details.focalLength);
  const maxAperture = numberIn(details.maxAperture);
  if (make === '') {
    return problem("Enter the new lens's make, like Nikon.");
  }
  if (name === '') {
    return problem("Enter the new lens's name, like Nikkor AI-S.");
  }
  if (focalLength === undefined) {
    return problem('Enter the focal length in millimetres, like 50.');
  }
  if (maxAperture === undefined) {
    return problem('Enter the widest aperture as an f-number, like 1.8.');
  }
  const label = lensLabel({ make, name, focalLength, maxAperture });
  const { data, response } = await api.POST('/api/equipment/lenses', {
    body: { make, name, focalLength, maxAperture },
  });
  if (data !== undefined) {
    return { ok: true, slug: data.slug };
  }
  switch (response.status) {
    case 409: {
      // The archive already has it, perhaps added since the list was loaded:
      // use it.
      const latest = await api.GET('/api/equipment/lenses');
      const added = (latest.data?.lenses ?? []).find(
        (lens) => lensLabel(lens).toLowerCase() === label.toLowerCase(),
      );
      return added === undefined
        ? problem(
            `There's already a lens with a name like ${label}. Choose it from the list.`,
          )
        : { ok: true, slug: added.slug };
    }
    case 422:
      return problem(
        'Check the focal length and aperture: numbers, like 50 and 1.8.',
      );
    default:
      return problem("Couldn't add the lens. Is the service running?");
  }
}
