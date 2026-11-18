import type { PublishFailed } from '../../domain/shared/domain-error.ts';
import type { Result } from '../../domain/shared/result.ts';

/** Which bucket: the target of a site's publishing, without its address. */
export interface BucketTarget {
  readonly accountId: string;
  readonly bucket: string;
}

/** A file in the bucket. */
export interface RemoteFile {
  readonly key: string;
  readonly size: number;
  /** Lower-case hexadecimal MD5 of its bytes, as a single-part upload's ETag has it. */
  readonly md5: string;
  /** When it was last written, an ISO 8601 time. */
  readonly lastModified: string;
}

/** A file to put in the bucket, under the path it has in the site. */
export interface FileToPut {
  readonly key: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly cacheControl: string;
}

/** A file to put in the bucket streamed from disk, so a large one isn't held in memory (FF-225). */
export interface StreamToPut {
  readonly key: string;
  /** Its size in bytes, which the bucket needs before it's sent. */
  readonly size: number;
  readonly contentType: string;
  readonly body: ReadableStream<Uint8Array>;
}

/** A conditional put found the bucket's file not as expected: someone else wrote it first (D117). */
export interface PreconditionFailed {
  readonly kind: 'precondition-failed';
}

/** A copy found nothing at the key to copy from. */
export interface SourceMissing {
  readonly kind: 'source-missing';
}

/** A file read from the bucket, with its ETag for a conditional put. */
export interface FileGot {
  readonly bytes: Uint8Array;
  readonly etag: string;
}

/**
 * A bucket a built site is published into (D111), or the library is backed
 * up to (D117): Cloudflare R2 now, and S3
 * later (FF-200). The keys that sign its requests are the computer's own, not
 * part of the target, so the adapter finds them. Every call can be stopped
 * with `signal`; a call that was stopped rejects, as `fetch` does.
 * Expected failures (no keys, keys refused, no such bucket, can't be reached)
 * come back in the result, never with internals.
 */
export interface PublishBucket {
  /**
   * Whether the keys the requests are signed with are there to use: only
   * that, not whether the service accepts them. Never gives the keys.
   */
  hasKeys(): Promise<boolean>;

  /** Every file in the bucket. */
  list(
    target: BucketTarget,
    signal: AbortSignal,
  ): Promise<Result<readonly RemoteFile[], PublishFailed>>;

  /** Puts a file in the bucket, replacing one with the same key. */
  put(
    target: BucketTarget,
    file: FileToPut,
    signal: AbortSignal,
  ): Promise<Result<undefined, PublishFailed>>;

  /** A file in the bucket, or undefined if there's none at that key. */
  get(
    target: BucketTarget,
    key: string,
    signal: AbortSignal,
  ): Promise<Result<FileGot | undefined, PublishFailed>>;

  /**
   * Puts a file only if the bucket's is as expected: none there yet
   * (`ifNoneMatch`), or the one read with this ETag (`ifMatch`). Gives the
   * new ETag. This is how a library claims a bucket and how a sync's record
   * can't overwrite one written since (D117).
   */
  putIf(
    target: BucketTarget,
    file: FileToPut,
    condition: { readonly ifNoneMatch: true } | { readonly ifMatch: string },
    signal: AbortSignal,
  ): Promise<
    Result<{ readonly etag: string }, PublishFailed | PreconditionFailed>
  >;

  /**
   * Puts a file streamed from disk, replacing one with the same key, and
   * gives the SHA-256 of the bytes actually sent: what the bucket now holds,
   * even if the file changed while it was read.
   */
  putStream(
    target: BucketTarget,
    file: StreamToPut,
    signal: AbortSignal,
  ): Promise<Result<{ readonly sha256: string }, PublishFailed>>;

  /**
   * Copies a file inside the bucket to another key, replacing one there,
   * without sending its bytes again: how a sync backs up a renamed file
   * (D117). `source-missing` when the bucket has nothing at `from`.
   */
  copy(
    target: BucketTarget,
    keys: { readonly from: string; readonly to: string },
    signal: AbortSignal,
  ): Promise<Result<undefined, PublishFailed | SourceMissing>>;

  /** Removes files by key; one that isn't there is not a failure. */
  deleteMany(
    target: BucketTarget,
    keys: readonly string[],
    signal: AbortSignal,
  ): Promise<Result<undefined, PublishFailed>>;
}
