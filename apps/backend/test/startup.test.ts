import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

const main = path.resolve(import.meta.dirname, '../src/main.ts');
let service: ChildProcess | undefined;
let folder = '';

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'filmfile-startup-'));
});

afterEach(async () => {
  if (service?.exitCode === null) {
    service.kill();
    await once(service, 'exit');
  }
  rmSync(folder, { recursive: true, force: true });
});

// The service checks requests against its port, so it needs a real one, not 0.
async function freePort(): Promise<number> {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  server.close();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a TCP address');
  }
  return address.port;
}

async function startService(
  filmFileFolder = folder,
  cache = path.join(folder, '.cache'),
): Promise<ChildProcess> {
  return spawn(process.execPath, [main], {
    env: {
      ...process.env,
      FILMFILE_FOLDER: filmFileFolder,
      FILMFILE_CACHE: cache,
      FILMFILE_PORT: String(await freePort()),
    },
  });
}

function exitCode(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => {
    child.once('exit', resolve);
  });
}

function waitForListeningUrl(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    child.stdout?.on('data', (chunk: Buffer) => {
      const match = /listening on (http:\/\/\S+)/.exec(chunk.toString());
      if (match?.[1] !== undefined) {
        resolve(match[1]);
      }
    });
    child.on('exit', (code) => {
      reject(new Error(`Service exited early with code ${String(code)}`));
    });
  });
}

test('starts from source and answers on localhost', async () => {
  service = await startService();

  const url = await waitForListeningUrl(service);
  const response = await fetch(`${url}/api/health`);

  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  expect(response.status).toBe(200);
});

test('stops cleanly when asked to', async () => {
  const child = await startService();
  service = child;
  await waitForListeningUrl(child);

  const exited = new Promise<number | null>((resolve) => {
    child.once('exit', resolve);
  });
  child.kill('SIGTERM');

  expect(await exited).toBe(0);
});

test('makes a Library in an empty FilmFile folder', async () => {
  service = await startService();
  await waitForListeningUrl(service);

  expect(readdirSync(folder).filter((name) => !name.startsWith('.'))).toEqual([
    'Library',
  ]);
});

test('refuses a folder of other files, saying so, and leaves it alone', async () => {
  writeFileSync(path.join(folder, 'holiday.jpg'), '');
  const child = await startService(folder, path.join(tmpdir(), 'cache'));
  service = child;
  let said = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    said += chunk.toString();
  });

  const code = await exitCode(child);

  expect(code).toBe(1);
  expect(said).toContain('isn’t a FilmFile folder');
  expect(readdirSync(folder)).toEqual(['holiday.jpg']);
});

test('stops without FILMFILE_FOLDER, saying to set it', async () => {
  const env: NodeJS.ProcessEnv = { ...process.env, FILMFILE_PORT: '4399' };
  delete env.FILMFILE_FOLDER;
  const child = spawn(process.execPath, [main], { env });
  service = child;
  let said = '';
  child.stderr.on('data', (chunk: Buffer) => {
    said += chunk.toString();
  });

  const code = await exitCode(child);

  expect(code).toBe(1);
  expect(said).toContain('Set FILMFILE_FOLDER to your FilmFile folder.');
});
