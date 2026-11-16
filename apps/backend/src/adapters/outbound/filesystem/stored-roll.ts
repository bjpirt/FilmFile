import type { VersionedRoll } from '../../../application/ports/roll-repository.ts';

/** A roll as read from its roll.json: the roll and its version, with the file and its exact text. */
export interface StoredRoll extends VersionedRoll {
  readonly file: string;
  readonly content: string;
}
