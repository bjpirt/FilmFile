import { nextVersion } from './next-version.ts';

/** What `pnpm release` says when it isn't told patch, minor or major. */
export function releaseUsage(
  current: string,
  { released }: { readonly released: boolean },
): string {
  if (!released) {
    return `Say which: pnpm release patch, minor or major. The first release is ${current}, whichever is chosen.`;
  }
  const to = (bump: 'patch' | 'minor' | 'major') =>
    nextVersion(current, bump, { released });
  return `Say which: pnpm release patch (${to('patch')}), minor (${to('minor')}) or major (${to('major')}).`;
}
