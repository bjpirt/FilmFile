/** A roll whose file can't be read, reported instead of failing the whole list. */
export interface UnreadableRoll {
  /** The roll's folder name, which should be its roll number. */
  readonly folder: string;
  /** What's wrong, for a person to read and fix. */
  readonly problem: string;
}
