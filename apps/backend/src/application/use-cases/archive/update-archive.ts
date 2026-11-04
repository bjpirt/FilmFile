import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  ConcurrencyConflict,
  NotFound,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type {
  ArchiveRepository,
  VersionedArchive,
} from '../../ports/archive-repository.ts';
import { textOrNull } from '../rolls/text-or-null.ts';
import { archiveAuthor } from './archive-author.ts';

/**
 * Changes the archive's author or copyright. A detail left out stays as it
 * is; null or blank clears the copyright, but the author can't be cleared
 * (D44). Saved only if the archive hasn't changed since the caller read it
 * at `expectedVersion`.
 */
export class UpdateArchive {
  readonly #archives: ArchiveRepository;

  constructor(archives: ArchiveRepository) {
    this.#archives = archives;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly expectedVersion: string;
      readonly author?: string | undefined;
      readonly copyright?: string | null | undefined;
    },
  ): Promise<
    Result<VersionedArchive, NotFound | ConcurrencyConflict | ValidationFailed>
  > {
    const author =
      input.author === undefined ? ok(undefined) : archiveAuthor(input.author);
    if (!author.ok) {
      return author;
    }
    const current = await this.#archives.get(ctx);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'archive', id: ctx.archiveId });
    }
    const archive = {
      ...current.archive,
      ...(author.value === undefined ? {} : { author: author.value }),
      ...(input.copyright === undefined
        ? {}
        : { copyright: textOrNull(input.copyright) }),
    };
    const saved = await this.#archives.save(
      ctx,
      archive,
      input.expectedVersion,
    );
    return saved.ok ? ok({ archive, version: saved.value }) : saved;
  }
}
