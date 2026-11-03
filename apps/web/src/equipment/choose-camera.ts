import type { ApiClient } from '@filmfile/contracts/client';
import type { Camera } from '@filmfile/contracts/equipment';
import type { CameraChoice, NewCamera } from './camera-choice.ts';
import { cameraLabel } from './use-cameras.ts';

/** The camera chosen, by slug (null for none), or why there isn't one. */
export type ChosenCamera =
  | { readonly ok: true; readonly slug: string | null }
  | { readonly ok: false; readonly problem: string };

function labelled(
  cameras: readonly Camera[],
  label: string,
): Camera | undefined {
  return cameras.find(
    (camera) => cameraLabel(camera).toLowerCase() === label.toLowerCase(),
  );
}

/** The slug of the camera chosen, creating it now if it's new. */
export async function chooseCamera(
  api: ApiClient,
  choice: CameraChoice,
): Promise<ChosenCamera> {
  switch (choice.kind) {
    case 'none':
      return { ok: true, slug: null };
    case 'existing':
      return { ok: true, slug: choice.slug };
    case 'new':
      return createCamera(api, choice.details);
  }
}

async function createCamera(
  api: ApiClient,
  details: NewCamera,
): Promise<ChosenCamera> {
  const make = details.make.trim();
  const model = details.model.trim();
  if (make === '') {
    return { ok: false, problem: "Enter the new camera's make, like Nikon." };
  }
  if (model === '') {
    return { ok: false, problem: "Enter the new camera's model, like FE." };
  }
  const label = cameraLabel({ make, model });
  const { data, response } = await api.POST('/api/equipment/cameras', {
    body: { make, model },
  });
  if (data !== undefined) {
    return { ok: true, slug: data.slug };
  }
  switch (response.status) {
    case 409: {
      // The archive already has it, perhaps added since the list was loaded,
      // or under the same name in another case: use it.
      const latest = await api.GET('/api/equipment/cameras');
      const added = labelled(latest.data?.cameras ?? [], label);
      if (added !== undefined) {
        return { ok: true, slug: added.slug };
      }
      return {
        ok: false,
        problem: `There's already a camera with a name like ${label}. Choose it from the list.`,
      };
    }
    case 422:
      return {
        ok: false,
        problem:
          'Enter a make and model with letters or digits, like Nikon FE.',
      };
    default:
      return {
        ok: false,
        problem: "Couldn't add the camera. Is the service running?",
      };
  }
}
