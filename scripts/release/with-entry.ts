const title = '# Changelog\n\n';

/** CHANGELOG.md with a release's entry at the top, under its title; made if there isn't one. */
export function withEntry(
  changelog: string | undefined,
  entry: string,
): string {
  const earlier = (changelog ?? '').replace(/^# Changelog\n+/, '');
  return earlier === '' ? `${title}${entry}` : `${title}${entry}\n${earlier}`;
}
