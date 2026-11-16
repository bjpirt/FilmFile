import { assertNever } from '../shared/assert-never.ts';
import type { PublishFailureReason } from '../shared/domain-error.ts';
import { publishFailureMessage } from '../sites/publish-failure-message.ts';

/** Why a sync didn't happen or didn't finish: publishing's reasons (keys, bucket, network), and the bucket's own. */
export type SyncFailureReason =
  | PublishFailureReason
  /** The bucket has things in it, and no library's claim. */
  | 'not-empty'
  /** The bucket backs up another library. */
  | 'another-library';

/** What to fix, in words, with no internals: publishing's words, and "Couldn't sync." for anything else. */
export function syncFailureMessage(
  reason: SyncFailureReason,
  bucket: string,
): string {
  switch (reason) {
    case 'not-empty':
      return "That bucket has something else in it, so FilmFile won't sync with it.";
    case 'another-library':
      return 'That bucket belongs to another FilmFile library.';
    case 'other':
      return "Couldn't sync.";
    case 'no-account':
    case 'no-credentials':
    case 'keys-refused':
    case 'no-bucket':
    case 'unreachable':
      return publishFailureMessage({ kind: 'publish-failed', reason, bucket });
    default:
      return assertNever(reason);
  }
}
