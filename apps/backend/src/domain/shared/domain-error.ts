/**
 * Expected failures, returned in a `Result`. Each carries only what a client
 * may see (what was involved and why), never file paths or other internals.
 * The HTTP adapter maps them to status codes: not found → 404, validation
 * failed, mapping invalid and an unreadable or oversized image → 422,
 * conflict, already exists and a scan already in the roll → 409, and a file
 * that isn't a JPEG, PNG or WebP → 415, and a site already being built,
 * published or unpublished → 409. A publish that failed on the other side
 * (keys, bucket, network) → 502.
 */
export type DomainError =
  | NotFound
  | AlreadyExists
  | ConcurrencyConflict
  | ValidationFailed
  | MappingInvalid
  | ImageRejected
  | ScanAlreadyInRoll
  | Busy
  | PublishFailed;

export type EntityKind =
  | 'settings'
  | 'roll'
  | 'frame'
  | 'version'
  | 'equipment'
  | 'event'
  | 'export'
  | 'site';

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

/** An uploaded file that can't be accepted as an image. */
export type ImageRejected =
  | {
      readonly kind: 'image-rejected';
      /** Unsupported: not a JPEG, PNG or WebP (U34). */
      readonly reason: 'unsupported-type' | 'unreadable';
    }
  | {
      readonly kind: 'image-rejected';
      readonly reason: 'too-many-pixels';
      readonly maxPixels: number;
    };

/** The same scan, by content, is already a version of a frame in the roll. */
export interface ScanAlreadyInRoll {
  readonly kind: 'scan-already-in-roll';
  readonly frameId: string;
}

/** One problem with the input: where it is (e.g. `['frames', 3, 'rating']`) and what's wrong. */
export interface Issue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/** What a site is busy with, so asking for another thing at the same time is refused. */
export interface Busy {
  readonly kind: 'busy';
  readonly entity: EntityKind;
  readonly id: string;
  readonly doing: 'building' | 'publishing' | 'unpublishing';
}

/** Why putting a site on the web, or taking it down, didn't work (FF-201). */
export type PublishFailureReason =
  /** No Cloudflare account ID in Settings (D119). */
  | 'no-account'
  /** No `[filmfile]` profile in `~/.aws/credentials`. */
  | 'no-credentials'
  /** The bucket's service refused the keys. */
  | 'keys-refused'
  | 'no-bucket'
  /** The service couldn't be reached. */
  | 'unreachable'
  | 'other';

export interface PublishFailed {
  readonly kind: 'publish-failed';
  readonly reason: PublishFailureReason;
  /** The bucket being used, for the message. */
  readonly bucket: string;
}
