import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
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

function startService(): ChildProcess {
  // Port 0 lets the OS pick a free port; the service logs the one it got.
  return spawn(process.execPath, [main], {
    env: { ...process.env, FILMFILE_PORT: '0' },
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
  service = startService();

  const url = await waitForListeningUrl(service);
  const response = await fetch(`${url}/api/health`);

  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  expect(response.status).toBe(200);
});

test('stops cleanly when asked to', async () => {
  const child = startService();
  service = child;
  await waitForListeningUrl(child);

  const exited = new Promise<number | null>((resolve) => {
    child.once('exit', resolve);
  });
  child.kill('SIGTERM');

  expect(await exited).toBe(0);
});
