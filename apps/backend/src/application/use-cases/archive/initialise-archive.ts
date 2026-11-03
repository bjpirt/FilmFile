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
import { archiveName } from './archive-name.ts';

/**
 * Sets the archive up on first run (D43): its name, and the author and
 * copyright its frames will inherit. Only once; afterwards it's updated.
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
      readonly name: string;
      readonly author?: string | undefined;
      readonly copyright?: string | undefined;
    },
  ): Promise<Result<Archive, ValidationFailed | AlreadyExists>> {
    const name = archiveName(input.name);
    if (!name.ok) {
      return name;
    }
    const archive: Archive = {
      id: this.#ids.newArchiveId(),
      name: name.value,
      author: textOrNull(input.author),
      copyright: textOrNull(input.copyright),
    };
    const created = await this.#archives.create(ctx, archive);
    return created.ok ? ok(archive) : created;
  }
}
