import type { FrameId } from '../shared/ids.ts';
import { siteDesign } from './site-design.ts';
import type { SiteManifest } from './site-manifest.ts';
import type { SiteOptions } from './site-options.ts';
import type { SitePhoto } from './site-photo.ts';

/** Why a built site no longer matches the archive. */
export interface SiteChanges {
  readonly added: readonly FrameId[];
  readonly removed: readonly FrameId[];
  /** Frames on both, whose words, shape or images differ. */
  readonly changed: readonly FrameId[];
  /** The frames are the same but their order isn't. */
  readonly reordered: boolean;
  readonly optionsChanged: boolean;
  /** It was built with an earlier version of the site's design. */
  readonly designChanged: boolean;
}

export type SiteStatus =
  | { readonly state: 'not-built' }
  | { readonly state: 'up-to-date' }
  | { readonly state: 'out-of-date'; readonly changes: SiteChanges };

export interface SiteBuildPlan {
  readonly status: SiteStatus;
  /** The images (by path) that don't exist yet: only these are made. */
  readonly imagesToMake: readonly string[];
  /** The images (by path) the built site has and no longer needs. */
  readonly imagesToRemove: readonly string[];
}

/** JSON with its keys in order, so two equal values compare equal however they were built. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    typeof inner === 'object' && inner !== null && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)),
        )
      : inner,
  );
}

const imagePaths = (photos: readonly SitePhoto[]): Set<string> =>
  new Set(photos.flatMap((photo) => photo.images.map((image) => image.src)));

function compare(
  built: SiteManifest,
  photos: readonly SitePhoto[],
  options: SiteOptions,
): SiteChanges {
  const before = new Map(built.photos.map((photo) => [photo.frame, photo]));
  const now = new Map(photos.map((photo) => [photo.frame, photo]));
  const sharedBefore = built.photos
    .filter((photo) => now.has(photo.frame))
    .map((photo) => photo.frame);
  const sharedNow = photos
    .filter((photo) => before.has(photo.frame))
    .map((photo) => photo.frame);
  return {
    added: photos.filter((p) => !before.has(p.frame)).map((p) => p.frame),
    removed: built.photos.filter((p) => !now.has(p.frame)).map((p) => p.frame),
    changed: photos
      .filter((photo) => {
        const old = before.get(photo.frame);
        return old !== undefined && canonicalJson(old) !== canonicalJson(photo);
      })
      .map((photo) => photo.frame),
    reordered: sharedBefore.join() !== sharedNow.join(),
    optionsChanged: canonicalJson(built.options) !== canonicalJson(options),
    designChanged: built.design !== siteDesign,
  };
}

const nothingChanged = (changes: SiteChanges): boolean =>
  changes.added.length === 0 &&
  changes.removed.length === 0 &&
  changes.changed.length === 0 &&
  !changes.reordered &&
  !changes.optionsChanged &&
  !changes.designChanged;

/**
 * Compares the site as it was built (its `site.json`, absent if it hasn't
 * been) with what it would be built from now. Images carry a hash of what
 * they're made from in their path, so an image needs making only when its
 * path isn't in the built site, and is removed when it's no longer wanted.
 */
export function planSiteBuild(
  built: SiteManifest | undefined,
  photos: readonly SitePhoto[],
  options: SiteOptions,
): SiteBuildPlan {
  const wanted = imagePaths(photos);
  if (built === undefined) {
    return {
      status: { state: 'not-built' },
      imagesToMake: [...wanted],
      imagesToRemove: [],
    };
  }
  const had = imagePaths(built.photos);
  const changes = compare(built, photos, options);
  return {
    status: nothingChanged(changes)
      ? { state: 'up-to-date' }
      : { state: 'out-of-date', changes },
    imagesToMake: [...wanted].filter((path) => !had.has(path)),
    imagesToRemove: [...had].filter((path) => !wanted.has(path)),
  };
}

const plural = (count: number, word: string): string =>
  `${String(count)} ${count === 1 ? word : `${word}s`}`;

/** What the site's page says: "Not built yet", "Up to date" or why it's out of date. */
export function describeSiteStatus(status: SiteStatus): string {
  switch (status.state) {
    case 'not-built':
      return 'Not built yet';
    case 'up-to-date':
      return 'Up to date';
    case 'out-of-date': {
      const {
        added,
        removed,
        changed,
        reordered,
        optionsChanged,
        designChanged,
      } = status.changes;
      const parts = [
        added.length > 0 ? `${plural(added.length, 'frame')} added` : '',
        removed.length > 0 ? `${String(removed.length)} removed` : '',
        changed.length > 0 ? `${String(changed.length)} changed` : '',
        reordered ? 'order changed' : '',
        optionsChanged ? 'options changed' : '',
        designChanged ? 'design changed' : '',
      ].filter((part) => part !== '');
      return `Out of date: ${parts.join(', ')}`;
    }
  }
}
