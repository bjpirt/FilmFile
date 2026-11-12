import type {
  SiteBuild,
  SiteFolders,
  SiteFolderState,
} from '../../../application/ports/site-folders.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { Slug } from '../../../domain/shared/slug.ts';
import {
  siteManifestJson,
  type SiteManifest,
} from '../../../domain/sites/site-manifest.ts';

/** A built site in memory: its files by path (text or image bytes) and its manifest, if it has one. */
export interface InMemorySite {
  readonly files: ReadonlyMap<string, string | Uint8Array>;
  readonly manifest: SiteManifest | undefined;
}

/** Whether every name in a path is safe to put under the site's folder, as the disk's check says. */
function isSafe(path: string): boolean {
  return path
    .split('/')
    .every(
      (name) =>
        name !== '' && name !== '.' && name !== '..' && !name.includes('\\'),
    );
}

/**
 * Built sites in memory. `sites` is what's there, by slug, so a test can read
 * the files or put something in the way (a site with no manifest).
 */
export class InMemorySiteFolders implements SiteFolders {
  readonly sites = new Map<string, InMemorySite>();

  inspect(_ctx: ArchiveContext, slug: Slug): Promise<SiteFolderState> {
    const site = this.sites.get(slug);
    if (site === undefined) {
      return Promise.resolve({ kind: 'empty' });
    }
    return Promise.resolve(
      site.manifest === undefined
        ? { kind: 'in-the-way' }
        : { kind: 'built', manifest: site.manifest },
    );
  }

  read(
    _ctx: ArchiveContext,
    slug: Slug,
    relativePath: string,
  ): Promise<Uint8Array | undefined> {
    if (!isSafe(relativePath)) {
      return Promise.reject(
        new Error(`unsafe path: ${JSON.stringify(relativePath)}`),
      );
    }
    const file = this.sites.get(slug)?.files.get(relativePath);
    return Promise.resolve(
      typeof file === 'string' ? new TextEncoder().encode(file) : file,
    );
  }

  begin(_ctx: ArchiveContext, slug: Slug): Promise<SiteBuild> {
    const before = this.sites.get(slug);
    const files = new Map<string, string | Uint8Array>();
    const build: SiteBuild = {
      keep: (path) => {
        const image = before?.files.get(path);
        if (image === undefined) {
          return Promise.resolve(false);
        }
        files.set(path, image);
        return Promise.resolve(true);
      },
      writeImage: (path, bytes) => {
        if (!isSafe(path)) {
          return Promise.reject(
            new Error(`unsafe path: ${JSON.stringify(path)}`),
          );
        }
        files.set(path, bytes);
        return Promise.resolve();
      },
      writeFile: (path, text) => {
        if (!isSafe(path)) {
          return Promise.reject(
            new Error(`unsafe path: ${JSON.stringify(path)}`),
          );
        }
        files.set(path, text);
        return Promise.resolve();
      },
      commit: (manifest) => {
        files.set('site.json', siteManifestJson(manifest));
        this.sites.set(slug, { files, manifest });
        return Promise.resolve();
      },
      discard: () => Promise.resolve(),
    };
    return Promise.resolve(build);
  }
}
