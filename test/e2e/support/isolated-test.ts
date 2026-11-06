import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { expect, test as base } from '@playwright/test';

interface IsolatedTestOptions {
  archiveSetup: 'empty' | 'set-up';
}

async function availablePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Could not allocate a port for an isolated journey.');
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  return address.port;
}

async function startService(
  archiveSetup: IsolatedTestOptions['archiveSetup'],
): Promise<{ readonly child: ChildProcess; readonly baseURL: string }> {
  const port = await availablePort();
  const child = spawn(
    process.execPath,
    [
      'test/e2e/serve.ts',
      String(port),
      ...(archiveSetup === 'set-up' ? ['set-up'] : []),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`FilmFile service did not start: ${output}`));
    }, 20_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      const match =
        /FilmFile service listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(
          output,
        );
      if (match?.[1] !== undefined) {
        clearTimeout(timeout);
        resolve({ child, baseURL: match[1] });
      }
    });
    child.stderr.on('data', (chunk: string) => {
      output += chunk;
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      if (code !== null || signal !== null) {
        clearTimeout(timeout);
        reject(
          new Error(
            `FilmFile service exited before starting (${String(code ?? signal)}): ${output}`,
          ),
        );
      }
    });
  });
}

async function stopService(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill('SIGTERM');
  await once(child, 'exit');
}

export const test = base.extend<IsolatedTestOptions>({
  archiveSetup: ['set-up', { option: true }],
  baseURL: async ({ archiveSetup }, use) => {
    const service = await startService(archiveSetup);
    try {
      await use(service.baseURL);
    } finally {
      await stopService(service.child);
    }
  },
});

export { expect };
