import { z } from 'zod';
import { isFrameId, type FrameId } from '../../../domain/shared/ids.ts';
import type { SiteManifest } from '../../../domain/sites/site-manifest.ts';
import type { GroupLabel } from '../../../domain/sites/site-photo.ts';

// The persistence model for `site.json`, read back to tell whether a built
// site is up to date. It's the manifest the domain writes, so reading it
// checks every field: a `site.json` that isn't one is treated as not a
// site's, and left alone.

// Fields added since a site was first built (D104) default when missing, so
// an older site.json still reads as a site's, only out of date.
const groupLabel = z.object({
  key: z.string(),
  heading: z.string(),
  detail: z.string().optional(),
  file: z.string().default(''),
});

const storedManifest = z.object({
  version: z.literal(1),
  options: z.object({
    title: z.string(),
    organiseBy: z.enum(['events', 'rolls', 'both']).default('both'),
    captions: z.array(z.enum(['title', 'shot', 'camera', 'lens', 'film'])),
  }),
  photos: z.array(
    z.object({
      frame: z.custom<FrameId>(
        (value) => typeof value === 'string' && isFrameId(value),
        'must be a ULID',
      ),
      alt: z.string(),
      images: z.array(
        z.object({
          src: z.string(),
          width: z.number(),
          madeFrom: z.string(),
        }),
      ),
      width: z.number(),
      height: z.number(),
      rating: z.number().nullable().default(null),
      roll: groupLabel,
      event: groupLabel.optional(),
      details: z.object({
        title: z.string().optional(),
        shot: z.string().optional(),
        camera: z.string().optional(),
        lens: z.string().optional(),
        film: z.string().optional(),
      }),
    }),
  ),
});

function label(stored: z.infer<typeof groupLabel>): GroupLabel {
  return {
    key: stored.key,
    heading: stored.heading,
    ...(stored.detail === undefined ? {} : { detail: stored.detail }),
    file: stored.file,
  };
}

/** The manifest in site.json's text; throws if the file isn't one. */
export function parseSiteManifestFile(text: string): SiteManifest {
  const stored = storedManifest.parse(JSON.parse(text));
  return {
    version: 1,
    options: stored.options,
    photos: stored.photos.map((photo) => ({
      frame: photo.frame,
      alt: photo.alt,
      images: photo.images,
      width: photo.width,
      height: photo.height,
      rating: photo.rating,
      roll: label(photo.roll),
      ...(photo.event === undefined ? {} : { event: label(photo.event) }),
      details: {
        ...(photo.details.title === undefined
          ? {}
          : { title: photo.details.title }),
        ...(photo.details.shot === undefined
          ? {}
          : { shot: photo.details.shot }),
        ...(photo.details.camera === undefined
          ? {}
          : { camera: photo.details.camera }),
        ...(photo.details.lens === undefined
          ? {}
          : { lens: photo.details.lens }),
        ...(photo.details.film === undefined
          ? {}
          : { film: photo.details.film }),
      },
    })),
  };
}
