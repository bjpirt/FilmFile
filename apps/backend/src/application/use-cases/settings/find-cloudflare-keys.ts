import type { PublishBucket } from '../../ports/publish-bucket.ts';

/**
 * Whether this computer has the keys that publish to Cloudflare, in the
 * `[filmfile]` profile of its credentials file (D119): only whether they're
 * there, never what they are, and not whether Cloudflare accepts them.
 */
export class FindCloudflareKeys {
  readonly #bucket: PublishBucket;

  constructor(bucket: PublishBucket) {
    this.#bucket = bucket;
  }

  execute(): Promise<boolean> {
    return this.#bucket.hasKeys();
  }
}
