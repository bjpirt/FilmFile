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

/**
 * A bucket a built site is published into (D111): Cloudflare R2 now, and S3
 * later (FF-200). The keys that sign its requests are the computer's own, not
 * part of the target, so the adapter finds them. Every call can be stopped
 * with `signal`; a call that was stopped rejects, as `fetch` does.
 * Expected failures (no keys, keys refused, no such bucket, can't be reached)
 * come back in the result, never with internals.
 */
export interface PublishBucket {
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

  /** Removes files by key; one that isn't there is not a failure. */
  deleteMany(
    target: BucketTarget,
    keys: readonly string[],
    signal: AbortSignal,
  ): Promise<Result<undefined, PublishFailed>>;
}
