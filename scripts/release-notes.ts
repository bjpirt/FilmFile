import { existsSync, readFileSync } from 'node:fs';
import { releaseNotes } from './release/release-notes.ts';

// `node scripts/release-notes.ts <version>` prints the GitHub release's notes
// for that version, from CHANGELOG.md (FF-244), or fails, saying so, if it
// has no entry for it. Run by the Release workflow before anything is built.

const [version = ''] = process.argv.slice(2);
const notes = releaseNotes(
  existsSync('CHANGELOG.md') ? readFileSync('CHANGELOG.md', 'utf8') : undefined,
  version,
);
if (notes === undefined) {
  console.error(
    `CHANGELOG.md has no entry for ${version}. Prepare releases with pnpm release.`,
  );
  process.exit(1);
}
process.stdout.write(notes);
