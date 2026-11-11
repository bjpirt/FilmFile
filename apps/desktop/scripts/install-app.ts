import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';

// Puts the FilmFile.app `pnpm package` built into /Applications, replacing
// the one there. It stops rather than replace an app that's running, which it
// would pull the files from under; quit FilmFile and run it again.

const built = path.resolve(
  import.meta.dirname,
  '..',
  'out',
  'FilmFile-darwin-arm64',
  'FilmFile.app',
);
const installed = '/Applications/FilmFile.app';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (process.platform !== 'darwin') {
  fail('Installing the app is only set up for macOS.');
}
if (!existsSync(built)) {
  fail(
    `There is no ${built}; run pnpm package first, or use pnpm install:app.`,
  );
}
// pgrep finds nothing with a status of 1.
const running = spawnSync('pgrep', ['-f', `${installed}/Contents/MacOS/`]);
if (running.status === 0) {
  fail('FilmFile is running. Quit it, then run this again.');
}

console.log(`Installing FilmFile.app in /Applications…`);
await rm(installed, { recursive: true, force: true });
// ditto keeps what a copy with cp would lose: the signature and the app's attributes.
execFileSync('ditto', [built, installed]);
console.log(`Installed ${installed}`);
