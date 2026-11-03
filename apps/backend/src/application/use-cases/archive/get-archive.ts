import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { NotFound } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type {
  ArchiveRepository,
  VersionedArchive,
} from '../../ports/archive-repository.ts';

/**
 * The archive's details, with the version token that lets a later save check
 * they haven't changed; not found until the archive is set up.
 */
export class GetArchive {
  readonly #archives: ArchiveRepository;

  constructor(archives: ArchiveRepository) {
    this.#archives = archives;
  }

  async execute(
    ctx: ArchiveContext,
  ): Promise<Result<VersionedArchive, NotFound>> {
    const found = await this.#archives.get(ctx);
    return found === undefined
      ? err({ kind: 'not-found', entity: 'archive', id: ctx.archiveId })
      : ok(found);
  }
}
