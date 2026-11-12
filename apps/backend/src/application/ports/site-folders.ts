import type { SiteManifest } from '../../domain/sites/site-manifest.ts';
import type { ArchiveContext } from '../../domain/shared/archive-context.ts';
import type { Slug } from '../../domain/shared/slug.ts';

/** What `Sites/<slug>/` holds. */
export type SiteFolderState =
  /** Nothing: the site has never been built. */
  | { readonly kind: 'empty' }
  /** A site built here, as its `site.json` says. */
  | { readonly kind: 'built'; readonly manifest: SiteManifest }
  /** Something with no `site.json` (or one that isn't a site's): left alone. */
  | { readonly kind: 'in-the-way' };

/** A site being built beside the built one, until it's swapped in. */
export interface SiteBuild {
  /**
   * Brings an image the built site already has into this build, untouched;
   * false if the built site doesn't have it.
   */
  keep(path: string): Promise<boolean>;
  writeImage(path: string, bytes: Uint8Array): Promise<void>;
  writeFile(path: string, text: string): Promise<void>;
  /**
   * Writes `site.json` from the manifest and swaps the build in for the
   * built site, all at once.
   */
  commit(manifest: SiteManifest): Promise<void>;
  /** Throws the build away, leaving the built site as it was. */
  discard(): Promise<void>;
}

/**
 * Where built sites are kept, one folder each in the archive's `Sites/`
 * (D92). A build is made in a folder beside the site's and swapped in when
 * it's done, so a failed or cancelled build leaves the site as it was and
 * nothing that reads the folder sees half a site.
 */
export interface SiteFolders {
  inspect(ctx: ArchiveContext, slug: Slug): Promise<SiteFolderState>;
  /**
   * A file of the built site, for showing it, or undefined if there isn't
   * one. Refuses a path that would leave the site's folder.
   */
  read(
    ctx: ArchiveContext,
    slug: Slug,
    relativePath: string,
  ): Promise<Uint8Array | undefined>;

  /** Starts a build; never touches the built site until `commit`. */
  begin(ctx: ArchiveContext, slug: Slug): Promise<SiteBuild>;
}
