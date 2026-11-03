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

/** What a roll's camera is called; its slug if the camera isn't known. */
export function cameraName(
  cameras: readonly Camera[],
  slug: string | null,
): string | undefined {
  if (slug === null) {
    return undefined;
  }
  return cameras.find((camera) => camera.slug === slug)?.name ?? slug;
}
