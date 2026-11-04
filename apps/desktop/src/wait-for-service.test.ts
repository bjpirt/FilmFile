import { createServer, type Server } from 'node:http';
import { afterEach, expect, test } from 'vitest';
import { freePort } from './free-port.ts';
import { waitForService } from './wait-for-service.ts';

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => {
    if (server === undefined) {
      resolve(undefined);
      return;
    }
    server.close(resolve);
  });
  server = undefined;
});

test('waits until the service says it’s healthy', async () => {
  const port = await freePort();
  let asked = 0;
  server = createServer((request, response) => {
    asked += 1;
    // Not ready the first time it's asked.
    response.statusCode =
      request.url === '/api/health' && asked > 1 ? 200 : 503;
    response.end();
  });
  await new Promise<void>((resolve) =>
    server?.listen(port, '127.0.0.1', resolve),
  );

  await waitForService(`http://127.0.0.1:${String(port)}`, { intervalMs: 10 });

  expect(asked).toBe(2);
});

test('gives up when the service doesn’t start in time', async () => {
  const port = await freePort();

  await expect(
    waitForService(`http://127.0.0.1:${String(port)}`, {
      timeoutMs: 100,
      intervalMs: 10,
    }),
  ).rejects.toThrow('The FilmFile service didn’t start');
});
