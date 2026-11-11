import { existsSync } from 'node:fs';
import path from 'node:path';

// Prints the command that puts the FilmFile.app `pnpm package` built into
// /Applications, replacing the one there. Writing to /Applications needs sudo,
// and a build run under sudo leaves root-owned files in the repository, so the
// build runs as you and only the copy is left for you to run.

const built = path.resolve(
  import.meta.dirname,
  '..',
  'out',
  'FilmFile-darwin-arm64',
  'FilmFile.app',
);
const installed = '/Applications/FilmFile.app';

if (process.platform !== 'darwin') {
  console.error('Installing the app is only set up for macOS.');
  process.exit(1);
}
if (!existsSync(built)) {
  console.error(
    `There is no ${built}; run pnpm package first, or use pnpm install:app.`,
  );
  process.exit(1);
}

// ditto keeps what a copy with cp would lose: the signature and the app's attributes.
console.log(`Built ${built}

Quit FilmFile if it's running, then install it with:

  sudo sh -c 'rm -rf "${installed}" && ditto "${built}" "${installed}"'
`);
