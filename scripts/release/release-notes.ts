// Which disk image is for which Mac (FF-161), and, until the app is signed
// (FF-137), that macOS won't open it from a download without being told to.
// macOS 12 is the oldest Electron 45 supports.
function installing(version: string): string {
  return `### Installing

Download the disk image for your Mac (Apple menu › About This Mac shows its chip):

- Apple silicon (M1 or later): FilmFile-${version}-mac-arm64.dmg
- Intel: FilmFile-${version}-mac-x64.dmg

Needs macOS 12 Monterey or later.

Open the disk image and drag FilmFile to Applications. The app isn’t signed yet, so the first time macOS won’t open it: choose Done, then System Settings › Privacy & Security › Open Anyway.

Check the download with \`shasum -a 256 -c SHA256SUMS\`, in the folder holding it and SHA256SUMS.
`;
}

/**
 * A GitHub release's notes (FF-244): the version's entry in CHANGELOG.md
 * without its heading (the release's title says the version), then how to
 * install it. Undefined if the changelog has no entry for the version.
 */
export function releaseNotes(
  changelog: string | undefined,
  version: string,
): string | undefined {
  const lines = (changelog ?? '').split('\n');
  const start = lines.indexOf(`## ${version}`);
  if (start === -1) {
    return undefined;
  }
  const after = lines.slice(start + 1);
  const end = after.findIndex((line) => line.startsWith('## '));
  const entry = (end === -1 ? after : after.slice(0, end)).join('\n').trim();
  return `${entry}\n\n${installing(version)}`;
}
