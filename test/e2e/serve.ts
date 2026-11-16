import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startFakeR2 } from '../../apps/backend/test/support/fake-r2-server.ts';
import { journeyBucket, journeyR2Keys } from './support/journey-r2.ts';

// Starts the backend, serving the built UI, on a new FilmFile folder and
// cache that are removed when it stops. The isolated test fixture starts this
// for each journey with `set-up` except for first-run setup.

const [port = '4311', mode] = process.argv.slice(2);
const folder = mkdtempSync(path.join(tmpdir(), 'filmfile-e2e-folder-'));
const cache = mkdtempSync(path.join(tmpdir(), 'filmfile-e2e-cache-'));
process.on('exit', () => {
  rmSync(folder, { recursive: true, force: true });
  rmSync(cache, { recursive: true, force: true });
});

if (mode === 'set-up') {
  // The Library the service would make, so a folder with a settings file passes its check.
  mkdirSync(path.join(folder, 'Library'));
  writeFileSync(
    path.join(folder, 'settings.json'),
    `${JSON.stringify({ schema: 1, id: '01JC8Y0000000000000000000A', meta: { author: 'Journeys' } }, null, 2)}\n`,
  );
}

// Publishing goes to a local fake of Cloudflare R2, never the real one (FF-234):
// its keys in a credentials file of the journey's own, and one bucket.
const r2 = await startFakeR2(journeyR2Keys, [journeyBucket]);
const credentials = path.join(cache, 'aws-credentials');
writeFileSync(
  credentials,
  `[filmfile]\naws_access_key_id = ${journeyR2Keys.accessKeyId}\naws_secret_access_key = ${journeyR2Keys.secretAccessKey}\n`,
);
process.env.AWS_SHARED_CREDENTIALS_FILE = credentials;
process.env.FILMFILE_R2_ENDPOINT = r2.endpoint('');

process.env.FILMFILE_FOLDER = folder;
process.env.FILMFILE_CACHE = cache;
process.env.FILMFILE_PORT = port;

await import('../../apps/backend/src/main.ts');
