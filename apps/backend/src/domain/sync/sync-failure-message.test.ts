import { expect, test } from 'vitest';
import { syncFailureMessage } from './sync-failure-message.ts';

test.each([
  [
    'not-empty',
    "That bucket has something else in it, so FilmFile won't sync with it.",
  ],
  ['another-library', 'That bucket belongs to another FilmFile library.'],
  ['other', "Couldn't sync."],
  ['keys-refused', 'Cloudflare refused the keys in the [filmfile] profile.'],
  ['no-bucket', "There's no bucket backup-pirt in that Cloudflare account."],
  ['no-account', 'Set your Cloudflare account ID in Settings.'],
] as const)('says what to fix for %s', (reason, message) => {
  expect(syncFailureMessage(reason, 'backup-pirt')).toBe(message);
});
