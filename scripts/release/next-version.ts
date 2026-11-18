/** Which part of the version a release moves on. */
export type Bump = 'patch' | 'minor' | 'major';

/**
 * The version a release is (FF-243): `current` moved on by `bump`, or, before
 * any release has been made, `current` as it is, so the first release is the
 * version FilmFile started at (0.1.0).
 */
export function nextVersion(
  current: string,
  bump: Bump,
  { released }: { readonly released: boolean },
): string {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (parts === null) {
    throw new Error(`The version ${current} isn't major.minor.patch.`);
  }
  if (!released) {
    return current;
  }
  const [major, minor, patch] = parts.slice(1).map(Number);
  if (major === undefined || minor === undefined || patch === undefined) {
    throw new Error(`The version ${current} isn't major.minor.patch.`);
  }
  switch (bump) {
    case 'patch':
      return `${String(major)}.${String(minor)}.${String(patch + 1)}`;
    case 'minor':
      return `${String(major)}.${String(minor + 1)}.0`;
    case 'major':
      return `${String(major + 1)}.0.0`;
  }
}
