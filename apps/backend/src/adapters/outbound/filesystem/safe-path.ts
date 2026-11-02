import path from 'node:path';

/**
 * A path under `root`, built from single names. Every filesystem path built
 * from input or stored data goes through here, so nothing can reach outside
 * the archive or cache: names can't be empty, `.` or `..`, or hold
 * separators or null bytes. Throws, since by here input has been validated:
 * an unsafe name is a bug or a tampered file.
 */
export function safePath(root: string, ...names: readonly string[]): string {
  if (!path.isAbsolute(root)) {
    throw new Error(`unsafe path: root ${root} is not absolute`);
  }
  for (const name of names) {
    if (name === '' || name === '.' || name === '..' || /[/\\\0]/.test(name)) {
      throw new Error(`unsafe path: ${JSON.stringify(name)} under ${root}`);
    }
  }
  const joined = path.join(root, ...names);
  // A second check that holds whatever the names were.
  const relative = path.relative(root, joined);
  const outside = relative === '..' || relative.startsWith(`..${path.sep}`);
  if (outside || path.isAbsolute(relative)) {
    throw new Error(`unsafe path: ${joined} is outside ${root}`);
  }
  return joined;
}
