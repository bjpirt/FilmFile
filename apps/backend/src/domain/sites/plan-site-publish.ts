/** A file of the built site, by its path in the site. */
export interface BuiltFile {
  readonly path: string;
  readonly size: number;
  readonly md5: string;
}

/** A file in the bucket, by its key (which is the same path). */
export interface BucketFile {
  readonly key: string;
  readonly size: number;
  /** Lower-case hexadecimal; what a single-part upload's ETag is. */
  readonly md5: string;
}

/** What publishing has to do to make the bucket the site. */
export interface SitePublishPlan {
  /** Missing or different files: images first, then the rest, each by path. */
  readonly uploads: readonly BuiltFile[];
  /** Files the site no longer has, by key. */
  readonly removals: readonly string[];
}

const manifestName = 'site.json';

function byPath(a: BuiltFile, b: BuiltFile): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

/**
 * Compares the built site with what's in the bucket by path, size and MD5:
 * what to upload and what to remove, so that publishing again with nothing
 * changed does nothing. The manifest, `site.json`, is FilmFile's own and is
 * never uploaded. Images are listed before pages, CSS and script, so a
 * publish that stops part-way leaves the published pages working as they were.
 */
export function planSitePublish(input: {
  readonly built: readonly BuiltFile[];
  readonly bucket: readonly BucketFile[];
}): SitePublishPlan {
  const inBucket = new Map(input.bucket.map((file) => [file.key, file]));
  const site = input.built.filter((file) => file.path !== manifestName);
  const wanted = new Set(site.map((file) => file.path));
  const different = site.filter((file) => {
    const there = inBucket.get(file.path);
    return there?.size !== file.size || there.md5 !== file.md5;
  });
  const images = different.filter((file) => file.path.startsWith('images/'));
  const rest = different.filter((file) => !file.path.startsWith('images/'));
  return {
    uploads: [...images.sort(byPath), ...rest.sort(byPath)],
    removals: input.bucket
      .map((file) => file.key)
      .filter((key) => !wanted.has(key))
      .sort(),
  };
}
