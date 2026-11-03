import type { ApiClient } from '@filmfile/contracts/client';
import type { Camera } from '@filmfile/contracts/equipment';

/** The camera a typed name stands for, by slug (null for none), or why there isn't one. */
export type ChosenCamera =
  | { readonly ok: true; readonly slug: string | null }
  | { readonly ok: false; readonly problem: string };

function named(cameras: readonly Camera[], name: string): Camera | undefined {
  return cameras.find(
    (camera) => camera.name.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * The camera with the name typed, ignoring case, or a new camera with that
 * name, created now. A blank name is no camera.
 */
export async function chooseCamera(
  api: ApiClient,
  cameras: readonly Camera[],
  typed: string,
): Promise<ChosenCamera> {
  const name = typed.trim();
  if (name === '') {
    return { ok: true, slug: null };
  }
  const existing = named(cameras, name);
  if (existing !== undefined) {
    return { ok: true, slug: existing.slug };
  }
  const { data, response } = await api.POST('/api/equipment/cameras', {
    body: { name },
  });
  if (data !== undefined) {
    return { ok: true, slug: data.slug };
  }
  switch (response.status) {
    case 409: {
      // The cameras given may be out of date, or not loaded yet: the camera
      // may have been added since.
      const latest = await api.GET('/api/equipment/cameras');
      const added = named(latest.data?.cameras ?? [], name);
      if (added !== undefined) {
        return { ok: true, slug: added.slug };
      }
      return {
        ok: false,
        problem: `There's already a camera with a name like ${name}. Choose it from the list.`,
      };
    }
    case 422:
      return {
        ok: false,
        problem: 'Enter a camera name with letters or digits, like Nikon FE.',
      };
    default:
      return {
        ok: false,
        problem: "Couldn't add the camera. Is the service running?",
      };
  }
}
