import { createHash } from 'node:crypto';
import { glob, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  EventRepository,
  VersionedEvent,
} from '../../../application/ports/event-repository.ts';
import type { Event } from '../../../domain/events/event.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ConcurrencyConflict,
  NotFound,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { isSlug, type Slug } from '../../../domain/shared/slug.ts';
import { KeyedLock } from '../node/keyed-lock.ts';
import { hasErrorCode } from './error-codes.ts';
import { eventFileContent, parseEventFile } from './event-file.ts';
import { safePath } from './safe-path.ts';
import { createAtomically, writeAtomically } from './write-atomically.ts';

/** A version token: the SHA-256 of the file's bytes. */
function versionOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Events kept as JSON files in the archive, one per event:
 * `events/<slug>.json`. Every write is atomic, and saves to the same event
 * take turns.
 */
export class FilesystemEventRepository implements EventRepository {
  readonly #archivePath: string;
  readonly #lock = new KeyedLock();

  constructor(archivePath: string) {
    this.#archivePath = archivePath;
  }

  #file(slug: Slug): string {
    return safePath(this.#archivePath, 'events', `${slug}.json`);
  }

  async list(): Promise<readonly Event[]> {
    const events: Event[] = [];
    for await (const relative of glob('events/*.json', {
      cwd: this.#archivePath,
    })) {
      const slug = path.basename(relative, '.json');
      // Only files named as a slug are events.
      if (isSlug(slug)) {
        const found = await this.#read(slug);
        if (found !== undefined) {
          events.push(found.event);
        }
      }
    }
    return events.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        sensitivity: 'base',
        numeric: true,
      }),
    );
  }

  get(_ctx: ArchiveContext, slug: Slug): Promise<VersionedEvent | undefined> {
    return this.#read(slug);
  }

  async #read(slug: Slug): Promise<VersionedEvent | undefined> {
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
      event: { slug, ...parseEventFile(text) },
      version: versionOf(text),
    };
  }

  async create(
    _ctx: ArchiveContext,
    event: Event,
  ): Promise<Result<void, AlreadyExists>> {
    await mkdir(safePath(this.#archivePath, 'events'), { recursive: true });
    const created = await createAtomically(
      this.#file(event.slug),
      eventFileContent(event),
    );
    return created
      ? ok(undefined)
      : err({ kind: 'already-exists', entity: 'event', id: event.slug });
  }

  save(
    _ctx: ArchiveContext,
    event: Event,
    expectedVersion: string,
  ): Promise<Result<string, NotFound | ConcurrencyConflict>> {
    return this.#lock.run(event.slug, async () => {
      const current = await this.#read(event.slug);
      if (current === undefined) {
        return err({ kind: 'not-found', entity: 'event', id: event.slug });
      }
      if (current.version !== expectedVersion) {
        return err({
          kind: 'concurrency-conflict',
          entity: 'event',
          id: event.slug,
        });
      }
      const content = eventFileContent(event);
      await writeAtomically(this.#file(event.slug), content);
      return ok(versionOf(content));
    });
  }
}
