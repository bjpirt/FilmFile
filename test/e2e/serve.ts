import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Starts the backend, serving the built UI, on a new FilmFile folder and
// cache that are removed when it stops. Playwright runs this as its web servers:
// `serve.ts <port> set-up` with the archive already set up, for the journeys
// that start from there, and `serve.ts <port>` with an empty one, for
// first-run setup.

const [port = '4311', mode] = process.argv.slice(2);
const folder = mkdtempSync(path.join(tmpdir(), 'filmfile-e2e-folder-'));
const cache = mkdtempSync(path.join(tmpdir(), 'filmfile-e2e-cache-'));
process.on('exit', () => {
  rmSync(folder, { recursive: true, force: true });
  rmSync(cache, { recursive: true, force: true });
});

if (mode === 'set-up') {
  const library = path.join(folder, 'Library');
  mkdirSync(library);
  writeFileSync(
    path.join(library, 'archive.json'),
    `${JSON.stringify({ schema: 1, id: '01JC8Y0000000000000000000A', meta: { author: 'Journeys' } }, null, 2)}\n`,
  );
}

process.env.FILMFILE_FOLDER = folder;
process.env.FILMFILE_CACHE = cache;
process.env.FILMFILE_PORT = port;

await import('../../apps/backend/src/main.ts');
