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
import { archiveName } from './archive-name.ts';

/**
 * Changes the archive's name, author or copyright. A detail left out stays
 * as it is; null or blank clears the author or copyright, but the name can't
 * be cleared. Saved only if the archive hasn't changed since the caller read
 * it at `expectedVersion`.
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
      readonly name?: string | undefined;
      readonly author?: string | null | undefined;
      readonly copyright?: string | null | undefined;
    },
  ): Promise<
    Result<VersionedArchive, NotFound | ConcurrencyConflict | ValidationFailed>
  > {
    const name =
      input.name === undefined ? ok(undefined) : archiveName(input.name);
    if (!name.ok) {
      return name;
    }
    const current = await this.#archives.get(ctx);
    if (current === undefined) {
      return err({ kind: 'not-found', entity: 'archive', id: ctx.archiveId });
    }
    const archive = {
      ...current.archive,
      ...(name.value === undefined ? {} : { name: name.value }),
      ...(input.author === undefined
        ? {}
        : { author: textOrNull(input.author) }),
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
