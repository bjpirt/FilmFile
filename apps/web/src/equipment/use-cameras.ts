import type { ApiClient } from '@filmfile/contracts/client';
import type { Camera } from '@filmfile/contracts/equipment';
import { useQuery } from '@tanstack/react-query';

/** The archive's cameras, ordered by name; none until they've loaded. */
export function useCameras(api: ApiClient): readonly Camera[] {
  const cameras = useQuery({
    queryKey: ['cameras'],
    queryFn: async () => {
      const { data } = await api.GET('/api/equipment/cameras');
      if (data === undefined) {
        throw new Error("Couldn't load the cameras.");
      }
      return data.cameras;
    },
  });
  return cameras.data ?? [];
}

/** A camera as it's shown: make and model, e.g. "Nikon FE". */
export function cameraLabel(camera: Pick<Camera, 'make' | 'model'>): string {
  return [camera.make, camera.model].filter((part) => part !== '').join(' ');
}

/** What a roll's camera is called; its slug if the camera isn't known. */
export function cameraName(
  cameras: readonly Camera[],
  slug: string | null,
): string | undefined {
  if (slug === null) {
    return undefined;
  }
  const camera = cameras.find((c) => c.slug === slug);
  return camera === undefined ? slug : cameraLabel(camera);
}
