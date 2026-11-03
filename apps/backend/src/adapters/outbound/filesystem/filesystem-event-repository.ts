import { glob, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { EventRepository } from '../../../application/ports/event-repository.ts';
import type { Event } from '../../../domain/events/event.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { AlreadyExists } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { isSlug, type Slug } from '../../../domain/shared/slug.ts';
import { hasErrorCode } from './error-codes.ts';
import { eventFileContent, parseEventFile } from './event-file.ts';
import { safePath } from './safe-path.ts';
import { createAtomically } from './write-atomically.ts';

/** Events kept as JSON files in the archive, one per event: `events/<slug>.json`. */
export class FilesystemEventRepository implements EventRepository {
  readonly #archivePath: string;

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
        const event = await this.#read(slug);
        if (event !== undefined) {
          events.push(event);
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

  get(_ctx: ArchiveContext, slug: Slug): Promise<Event | undefined> {
    return this.#read(slug);
  }

  async #read(slug: Slug): Promise<Event | undefined> {
    let text: string;
    try {
      text = await readFile(this.#file(slug), 'utf8');
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) {
        return undefined;
      }
      throw error;
    }
    return { slug, ...parseEventFile(text) };
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
}
