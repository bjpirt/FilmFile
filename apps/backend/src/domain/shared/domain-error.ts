/**
 * Expected failures, returned in a `Result`. Each carries only what a client
 * may see (what was involved and why), never file paths or other internals.
 * The HTTP adapter maps them to status codes: not found → 404,
 * validation failed and mapping invalid → 422, conflict and already exists → 409.
 */
export type DomainError =
  | NotFound
  | AlreadyExists
  | ConcurrencyConflict
  | ValidationFailed
  | MappingInvalid;

export type EntityKind = 'archive' | 'roll' | 'frame' | 'version' | 'equipment';

export interface NotFound {
  readonly kind: 'not-found';
  readonly entity: EntityKind;
  readonly id: string;
}

export interface AlreadyExists {
  readonly kind: 'already-exists';
  readonly entity: EntityKind;
  readonly id: string;
}

/** The record changed since the caller read it, so their save was refused. */
export interface ConcurrencyConflict {
  readonly kind: 'concurrency-conflict';
  readonly entity: EntityKind;
  readonly id: string;
}

export interface ValidationFailed {
  readonly kind: 'validation-failed';
  readonly issues: readonly Issue[];
}

/** A mapping from scans to frame numbers that can't be applied, e.g. a non-numeric anchor. */
export interface MappingInvalid {
  readonly kind: 'mapping-invalid';
  readonly issues: readonly Issue[];
}

/** One problem with the input: where it is (e.g. `['frames', 3, 'rating']`) and what's wrong. */
export interface Issue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}
