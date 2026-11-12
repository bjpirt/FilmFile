import { randomUUID } from 'node:crypto';
import {
  copyFile,
  link,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
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
import { hasErrorCode } from './error-codes.ts';
import { safePath } from './safe-path.ts';
import { parseSiteManifestFile } from './site-manifest-file.ts';
import { writeAtomically } from './write-atomically.ts';

async function exists(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return false;
    }
    throw error;
  }
}

/** Whether a folder is missing or empty: nothing of anyone's to protect. */
async function isEmptyOrMissing(folder: string): Promise<boolean> {
  try {
    return (await readdir(folder)).length === 0;
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return true;
    }
    throw error;
  }
}

/**
 * Built sites on disk, one folder each in the FilmFile folder's `Sites/`
 * (D92). A build is written into a hidden folder beside the site's and
 * renamed into place at the end, so the site is whole before and after; a
 * folder with files in it but no `site.json` is never touched. Every path is
 * built from single names under the folder, so nothing reaches outside it.
 */
export class FilesystemSiteFolders implements SiteFolders {
  readonly #sites: string;

  constructor(folderPath: string) {
    this.#sites = safePath(folderPath, 'Sites');
  }

  async inspect(_ctx: ArchiveContext, slug: Slug): Promise<SiteFolderState> {
    const folder = safePath(this.#sites, slug);
    if (await isEmptyOrMissing(folder)) {
      return { kind: 'empty' };
    }
    try {
      const text = await readFile(safePath(folder, 'site.json'), 'utf8');
      return { kind: 'built', manifest: parseSiteManifestFile(text) };
    } catch {
      // No site.json, or one that isn't a site's: not ours to replace.
      return { kind: 'in-the-way' };
    }
  }

  async read(
    _ctx: ArchiveContext,
    slug: Slug,
    relativePath: string,
  ): Promise<Uint8Array | undefined> {
    const file = safePath(this.#sites, slug, ...relativePath.split('/'));
    try {
      return new Uint8Array(await readFile(file));
    } catch (error) {
      // Not there, or a folder: nothing to show.
      if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'EISDIR')) {
        return undefined;
      }
      throw error;
    }
  }

  async begin(_ctx: ArchiveContext, slug: Slug): Promise<SiteBuild> {
    const site = safePath(this.#sites, slug);
    const staging = safePath(this.#sites, `.${slug}.building-${randomUUID()}`);
    await mkdir(staging, { recursive: true });
    const inStaging = (relativePath: string): string =>
      safePath(staging, ...relativePath.split('/'));
    const write = async (
      relativePath: string,
      content: string | Uint8Array,
    ) => {
      const target = inStaging(relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
    };
    return {
      keep: async (relativePath) => {
        const source = safePath(site, ...relativePath.split('/'));
        if (!(await exists(source))) {
          return false;
        }
        const target = inStaging(relativePath);
        await mkdir(path.dirname(target), { recursive: true });
        // A link where the disk allows it, so keeping costs nothing; images
        // are never changed in place, so sharing one is safe.
        await link(source, target).catch(() => copyFile(source, target));
        return true;
      },
      writeImage: (relativePath, bytes) => write(relativePath, bytes),
      writeFile: (relativePath, text) => write(relativePath, text),
      commit: async (manifest: SiteManifest) => {
        await writeAtomically(
          safePath(staging, 'site.json'),
          siteManifestJson(manifest),
        );
        const replaced = safePath(
          this.#sites,
          `.${slug}.replaced-${randomUUID()}`,
        );
        const hadSite = await exists(site);
        if (hadSite) {
          await rename(site, replaced);
        }
        await rename(staging, site);
        if (hadSite) {
          await rm(replaced, { recursive: true, force: true });
        }
      },
      discard: () => rm(staging, { recursive: true, force: true }),
    };
  }
}
