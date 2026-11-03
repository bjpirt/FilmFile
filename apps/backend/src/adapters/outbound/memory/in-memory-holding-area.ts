import type {
  Held,
  HeldFrame,
  HeldRoll,
  HoldingArea,
} from '../../../application/ports/holding-area.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';

/** Deleted things kept in memory, for tests. */
export class InMemoryHoldingArea implements HoldingArea {
  readonly #held: Held[] = [];

  holdFrame(
    _ctx: ArchiveContext,
    held: Omit<HeldFrame, 'kind'>,
  ): Promise<void> {
    this.#held.push({ kind: 'frame', ...held });
    return Promise.resolve();
  }

  holdRoll(_ctx: ArchiveContext, held: Omit<HeldRoll, 'kind'>): Promise<void> {
    this.#held.push({ kind: 'roll', ...held });
    return Promise.resolve();
  }

  list(): Promise<readonly Held[]> {
    return Promise.resolve(
      [...this.#held].sort((a, b) => a.at.getTime() - b.at.getTime()),
    );
  }
}
