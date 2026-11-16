import { assertNever } from '../shared/assert-never.ts';
import type { PublishFailed } from '../shared/domain-error.ts';

/** What to fix, in words, with no internals (FF-201). */
export function publishFailureMessage(failure: PublishFailed): string {
  switch (failure.reason) {
    case 'no-account':
      return 'Set your Cloudflare account ID in Settings.';
    case 'no-credentials':
      return "No [filmfile] profile in ~/.aws/credentials, so the site can't be published.";
    case 'keys-refused':
      return 'Cloudflare refused the keys in the [filmfile] profile.';
    case 'no-bucket':
      return `There's no bucket ${failure.bucket} in that Cloudflare account.`;
    case 'unreachable':
      return "Couldn't reach Cloudflare. Are you online?";
    case 'other':
      return "Couldn't publish the site.";
    default:
      return assertNever(failure.reason);
  }
}
