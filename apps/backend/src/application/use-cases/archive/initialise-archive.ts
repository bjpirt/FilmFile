import type { Archive } from '../../../domain/archive/archive.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type {
  AlreadyExists,
  ValidationFailed,
} from '../../../domain/shared/domain-error.ts';
import { ok, type Result } from '../../../domain/shared/result.ts';
import type { ArchiveRepository } from '../../ports/archive-repository.ts';
import type { IdGenerator } from '../../ports/id-generator.ts';
import { textOrNull } from '../rolls/text-or-null.ts';
import { archiveAuthor } from './archive-author.ts';

/**
 * Sets the archive up on first run (D43): the author and copyright its
 * frames will inherit. Only once; afterwards it's updated.
 */
export class InitialiseArchive {
  readonly #archives: ArchiveRepository;
  readonly #ids: IdGenerator;

  constructor(archives: ArchiveRepository, ids: IdGenerator) {
    this.#archives = archives;
    this.#ids = ids;
  }

  async execute(
    ctx: ArchiveContext,
    input: {
      readonly author: string;
      readonly copyright?: string | undefined;
    },
  ): Promise<Result<Archive, ValidationFailed | AlreadyExists>> {
    const author = archiveAuthor(input.author);
    if (!author.ok) {
      return author;
    }
    const archive: Archive = {
      id: this.#ids.newArchiveId(),
      author: author.value,
      copyright: textOrNull(input.copyright),
    };
    const created = await this.#archives.create(ctx, archive);
    return created.ok ? ok(archive) : created;
  }
}
