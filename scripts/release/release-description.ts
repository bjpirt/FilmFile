/** A release pull request's description: its changelog entry, then what merging it does. */
export function releaseDescription(version: string, entry: string): string {
  return `${entry}\n---\n\nMerging this publishes FilmFile ${version}. Edit CHANGELOG.md in this pull request to change the notes.\n`;
}
