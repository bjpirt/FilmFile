import { createHash } from 'node:crypto';
import { glob, link, mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type {
  SiteRepository,
  VersionedSite,
} from '../../../application/ports/site-repository.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { isSlug, type Slug } from '../../../domain/shared/slug.ts';
import type { Site } from '../../../domain/sites/site.ts';
import { KeyedLock } from '../node/keyed-lock.ts';
import { hasErrorCode } from './error-codes.ts';
import { safePath } from './safe-path.ts';
import { parseSiteFile, siteFileContent } from './site-file.ts';
import { createAtomically, writeAtomically } from './write-atomically.ts';

/** A version token: the SHA-256 of the file's bytes. */
function versionOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** A time as a folder name can hold it: `2026-11-02T120000Z`. */
function stamp(at: Date): string {
  return at
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replaceAll(':', '');
}

/**
 * Sites kept as JSON files in the archive, one per site:
 * `sites/<slug>.json`. Every write is atomic, saves to the same site take
 * turns, and a removed site's file moves to `deleted/` (D12).
 */
export class FilesystemSiteRepository implements SiteRepository {
  readonly #archivePath: string;
  readonly #lock = new KeyedLock();

  constructor(archivePath: string) {
    this.#archivePath = archivePath;
  }

  #file(slug: Slug): string {
    return safePath(this.#archivePath, 'sites', `${slug}.json`);
  }

  async list(): Promise<readonly Site[]> {
    const sites: Site[] = [];
    for await (const relative of glob('sites/*.json', {
      cwd: this.#archivePath,
    })) {
      const slug = path.basename(relative, '.json');
      // Only files named as a slug are sites.
      if (isSlug(slug)) {
        const found = await this.#read(slug);
        if (found !== undefined) {
          sites.push(found.site);
        }
      }
    }
    return sites.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        sensitivity: 'base',
        numeric: true,
      }),
    );
  }

  get(_ctx: ArchiveContext, slug: Slug): Promise<VersionedSite | undefined> {
    return this.#read(slug);
  }

  async #read(slug: Slug): Promise<VersionedSite | undefined> {
    let text: string;
    try {
      text = await readFile(this.#file(slug), 'utf8');
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return undefined;
      }
      throw error;
    }
    return {
      site: { slug, ...parseSiteFile(text) },
      version: versionOf(text),
    };
  }

  async create(
    _ctx: ArchiveContext,
    site: Site,
  ): Promise<Result<string, AlreadyExists>> {
    await mkdir(safePath(this.#archivePath, 'sites'), { recursive: true });
    const content = siteFileContent(site);
    const created = await createAtomically(this.#file(site.slug), content);
    return created
      ? ok(versionOf(content))
      : err({ kind: 'already-exists', entity: 'site', id: site.slug });
  }

  save(
    _ctx: ArchiveContext,
    site: Site,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    return this.#lock.run(site.slug, async () => {
      const current = await this.#read(site.slug);
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'site', id: site.slug });
      }
      if (current.version !== expectedVersion) {
        return err({
          kind: 'concurrency-conflict',
          entity: 'site',
          id: site.slug,
        });
      }
      const content = siteFileContent(site);
      await writeAtomically(this.#file(site.slug), content);
      return ok(versionOf(content));
    });
  }

  rename(
    _ctx: ArchiveContext,
    from: Slug,
    site: Site,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict | AlreadyExists>> {
    return this.#lock.run(from, async () => {
      const current = await this.#read(from);
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'site', id: from });
      }
      if (current.version !== expectedVersion) {
        return err({ kind: 'concurrency-conflict', entity: 'site', id: from });
      }
      try {
        // A link fails if the new name is taken, where a rename would replace
        // that site; the old file stays until the new one is complete.
        await link(this.#file(from), this.#file(site.slug));
      } catch (error) {
        if (hasErrorCode(error, 'EEXIST')) {
          return err({
            kind: 'already-exists',
            entity: 'site',
            id: site.slug,
          });
        }
        throw error;
      }
      const content = siteFileContent(site);
      await writeAtomically(this.#file(site.slug), content);
      await rm(this.#file(from));
      return ok(versionOf(content));
    });
  }

  remove(
    _ctx: ArchiveContext,
    slug: Slug,
    at: Date,
  ): Promise<Result<void, NotFound>> {
    return this.#lock.run(slug, async () => {
      const folder = safePath(
        this.#archivePath,
        'deleted',
        `${stamp(at)}-site-${slug}`,
      );
      await mkdir(safePath(this.#archivePath, 'deleted'), { recursive: true });
      try {
        // Fails if the file is gone, and never replaces what's already held.
        await mkdir(folder);
        await rename(this.#file(slug), safePath(folder, `${slug}.json`));
      } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) {
          await rm(folder, { recursive: true, force: true });
          return err({ kind: 'not-found', entity: 'site', id: slug });
        }
        throw error;
      }
      return ok(undefined);
    });
  }
}
