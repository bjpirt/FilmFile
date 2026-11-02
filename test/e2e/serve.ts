import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Starts the backend, serving the built UI, on an empty archive and cache
// that are removed when it stops. Playwright runs this as its web server.

const archive = mkdtempSync(path.join(tmpdir(), 'filmfile-e2e-archive-'));
const cache = mkdtempSync(path.join(tmpdir(), 'filmfile-e2e-cache-'));
process.on('exit', () => {
  rmSync(archive, { recursive: true, force: true });
  rmSync(cache, { recursive: true, force: true });
});

process.env.FILMFILE_ARCHIVE = archive;
process.env.FILMFILE_CACHE = cache;
process.env.FILMFILE_PORT = '4311';

await import('../../apps/backend/src/main.ts');
