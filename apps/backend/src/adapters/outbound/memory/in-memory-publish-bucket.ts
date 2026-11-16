import type {
  BucketTarget,
  FileToPut,
  PublishBucket,
  RemoteFile,
} from '../../../application/ports/publish-bucket.ts';
import type { Clock } from '../../../application/ports/clock.ts';
import type {
  PublishFailed,
  PublishFailureReason,
} from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import { md5Hex } from '../node/md5-hex.ts';

/** A file kept in a bucket in memory, as it was sent. */
export interface InMemoryBucketFile extends FileToPut {
  readonly lastModified: string;
}

const keyOf = (target: BucketTarget): string =>
  `${target.accountId}/${target.bucket}`;

/**
 * Buckets in memory, for tests. A bucket exists once `createBucket` has made
 * it, as one in a Cloudflare account does; `files` shows what was put there
 * and `failWith` makes every call fail, as a bad key or no network would.
 */
export class InMemoryPublishBucket implements PublishBucket {
  readonly #buckets = new Map<string, Map<string, InMemoryBucketFile>>();
  readonly #clock: Clock;
  #failure: PublishFailureReason | undefined;
  /** Whether the keys are there, as the credentials file would say. */
  keysFound = true;

  constructor(clock: Clock) {
    this.#clock = clock;
  }

  hasKeys(): Promise<boolean> {
    return Promise.resolve(this.keysFound);
  }

  createBucket(target: BucketTarget): void {
    if (!this.#buckets.has(keyOf(target))) {
      this.#buckets.set(keyOf(target), new Map());
    }
  }

  /** The files in a bucket by key, as they were sent; empty if there's no such bucket. */
  files(target: BucketTarget): ReadonlyMap<string, InMemoryBucketFile> {
    return this.#buckets.get(keyOf(target)) ?? new Map();
  }

  /** Makes every call from now on fail for this reason, or work again with undefined. */
  failWith(reason: PublishFailureReason | undefined): void {
    this.#failure = reason;
  }

  #open(
    target: BucketTarget,
  ): Result<Map<string, InMemoryBucketFile>, PublishFailed> {
    const reason = this.#failure ?? undefined;
    const files = this.#buckets.get(keyOf(target));
    if (reason !== undefined || files === undefined) {
      return err({
        kind: 'publish-failed',
        reason: reason ?? 'no-bucket',
        bucket: target.bucket,
      });
    }
    return ok(files);
  }

  list(
    target: BucketTarget,
    signal: AbortSignal,
  ): Promise<Result<readonly RemoteFile[], PublishFailed>> {
    if (signal.aborted) {
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    }
    const opened = this.#open(target);
    if (!opened.ok) {
      return Promise.resolve(opened);
    }
    return Promise.resolve(
      ok(
        [...opened.value].map(([key, file]) => ({
          key,
          size: file.bytes.length,
          md5: md5Hex(file.bytes),
          lastModified: file.lastModified,
        })),
      ),
    );
  }

  put(
    target: BucketTarget,
    file: FileToPut,
    signal: AbortSignal,
  ): Promise<Result<undefined, PublishFailed>> {
    if (signal.aborted) {
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    }
    const opened = this.#open(target);
    if (!opened.ok) {
      return Promise.resolve(opened);
    }
    opened.value.set(file.key, {
      ...file,
      bytes: new Uint8Array(file.bytes),
      lastModified: this.#clock.now().toISOString(),
    });
    return Promise.resolve(ok(undefined));
  }

  deleteMany(
    target: BucketTarget,
    keys: readonly string[],
    signal: AbortSignal,
  ): Promise<Result<undefined, PublishFailed>> {
    if (signal.aborted) {
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    }
    const opened = this.#open(target);
    if (!opened.ok) {
      return Promise.resolve(opened);
    }
    for (const key of keys) {
      opened.value.delete(key);
    }
    return Promise.resolve(ok(undefined));
  }
}
