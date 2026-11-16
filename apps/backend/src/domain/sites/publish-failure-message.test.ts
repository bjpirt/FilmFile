import { expect, test } from 'vitest';
import { publishFailureMessage } from './publish-failure-message.ts';

test.each([
  ['no-account', 'Set your Cloudflare account ID in Settings.'],
  [
    'no-credentials',
    "No [filmfile] profile in ~/.aws/credentials, so the site can't be published.",
  ],
  ['keys-refused', 'Cloudflare refused the keys in the [filmfile] profile.'],
  ['no-bucket', "There's no bucket photos-pirt in that Cloudflare account."],
  ['unreachable', "Couldn't reach Cloudflare. Are you online?"],
  ['other', "Couldn't publish the site."],
] as const)('says what to fix for %s', (reason, message) => {
  expect(
    publishFailureMessage({
      kind: 'publish-failed',
      reason,
      bucket: 'photos-pirt',
    }),
  ).toBe(message);
});
