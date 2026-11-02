import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

const main = path.resolve(import.meta.dirname, '../src/main.ts');
let service: ChildProcess | undefined;

afterEach(async () => {
  if (service?.exitCode === null) {
    service.kill();
    await once(service, 'exit');
  }
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

async function startService(): Promise<ChildProcess> {
  return spawn(process.execPath, [main], {
    env: {
      ...process.env,
      FILMFILE_ARCHIVE: tmpdir(),
      FILMFILE_PORT: String(await freePort()),
    },
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
