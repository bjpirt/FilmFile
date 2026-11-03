import type { ApiClient } from '@filmfile/contracts/client';
import type { Lens } from '@filmfile/contracts/equipment';
import { useQuery } from '@tanstack/react-query';

/** The archive's lenses, in order; none until they've loaded. */
export function useLenses(api: ApiClient): readonly Lens[] {
  const lenses = useQuery({
    queryKey: ['lenses'],
    queryFn: async () => {
      const { data } = await api.GET('/api/equipment/lenses');
      if (data === undefined) {
        throw new Error("Couldn't load the lenses.");
      }
      return data.lenses;
    },
  });
  return lenses.data ?? [];
}

/** A lens as it's shown: make, name, focal length and aperture, e.g. "Nikon Nikkor AI-S 50mm f/1.8". */
export function lensLabel(
  lens: Pick<Lens, 'make' | 'name' | 'focalLength' | 'maxAperture'>,
): string {
  return [
    lens.make,
    lens.name,
    ...(lens.focalLength === null ? [] : [`${String(lens.focalLength)}mm`]),
    ...(lens.maxAperture === null ? [] : [`f/${String(lens.maxAperture)}`]),
  ].join(' ');
}

/** What a roll's lens is called; its slug if the lens isn't known. */
export function lensName(
  lenses: readonly Lens[],
  slug: string | null,
): string | undefined {
  if (slug === null) {
    return undefined;
  }
  const lens = lenses.find((l) => l.slug === slug);
  return lens === undefined ? slug : lensLabel(lens);
}
