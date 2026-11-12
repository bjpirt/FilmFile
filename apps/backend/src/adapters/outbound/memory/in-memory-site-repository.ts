import { createHash } from 'node:crypto';
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
import type { Slug } from '../../../domain/shared/slug.ts';
import type { Site } from '../../../domain/sites/site.ts';
import { KeyedLock } from '../node/keyed-lock.ts';

/** A version token from what the site holds, so a save changes it only when the site changes. */
function versionOf(site: Site): string {
  return createHash('sha256').update(JSON.stringify(site)).digest('hex');
}

/** Sites kept in memory, for tests; `deleted` is what was taken away, and when. */
export class InMemorySiteRepository implements SiteRepository {
  readonly #sites = new Map<Slug, Site>();
  readonly #lock = new KeyedLock();
  readonly deleted: { readonly site: Site; readonly at: Date }[] = [];

  list(): Promise<readonly Site[]> {
    return Promise.resolve(
      [...this.#sites.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: 'base',
          numeric: true,
        }),
      ),
    );
  }

  get(_ctx: ArchiveContext, slug: Slug): Promise<VersionedSite | undefined> {
    const site = this.#sites.get(slug);
    return Promise.resolve(
      site === undefined ? undefined : { site, version: versionOf(site) },
    );
  }

  create(
    _ctx: ArchiveContext,
    site: Site,
  ): Promise<Result<string, AlreadyExists>> {
    if (this.#sites.has(site.slug)) {
      return Promise.resolve(
        err({ kind: 'already-exists', entity: 'site', id: site.slug }),
      );
    }
    this.#sites.set(site.slug, site);
    return Promise.resolve(ok(versionOf(site)));
  }

  save(
    _ctx: ArchiveContext,
    site: Site,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    return this.#lock.run<Result<string, NotFound | ConcurrencyConflict>>(
      site.slug,
      () => {
        const current = this.#sites.get(site.slug);
        if (current === undefined) {
          return Promise.resolve(
            err({ kind: 'not-found', entity: 'site', id: site.slug }),
          );
        }
        if (versionOf(current) !== expectedVersion) {
          return Promise.resolve(
            err({
              kind: 'concurrency-conflict',
              entity: 'site',
              id: site.slug,
            }),
          );
        }
        this.#sites.set(site.slug, site);
        return Promise.resolve(ok(versionOf(site)));
      },
    );
  }

  rename(
    _ctx: ArchiveContext,
    from: Slug,
    site: Site,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict | AlreadyExists>> {
    return this.#lock.run<
      Result<string, NotFound | ConcurrencyConflict | AlreadyExists>
    >(from, () => {
      const current = this.#sites.get(from);
      if (current === undefined) {
        return Promise.resolve(
          err({ kind: 'not-found', entity: 'site', id: from }),
        );
      }
      if (versionOf(current) !== expectedVersion) {
        return Promise.resolve(
          err({ kind: 'concurrency-conflict', entity: 'site', id: from }),
        );
      }
      if (this.#sites.has(site.slug)) {
        return Promise.resolve(
          err({ kind: 'already-exists', entity: 'site', id: site.slug }),
        );
      }
      this.#sites.delete(from);
      this.#sites.set(site.slug, site);
      return Promise.resolve(ok(versionOf(site)));
    });
  }

  remove(
    _ctx: ArchiveContext,
    slug: Slug,
    at: Date,
  ): Promise<Result<void, NotFound>> {
    const site = this.#sites.get(slug);
    if (site === undefined) {
      return Promise.resolve(
        err({ kind: 'not-found', entity: 'site', id: slug }),
      );
    }
    this.#sites.delete(slug);
    this.deleted.push({ site, at });
    return Promise.resolve(ok(undefined));
  }
}
