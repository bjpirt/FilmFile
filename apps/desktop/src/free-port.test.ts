import { createServer } from 'node:net';
import { expect, test } from 'vitest';
import { freePort } from './free-port.ts';

test('finds a port on 127.0.0.1 that can be listened on', async () => {
  const port = await freePort();

  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  await new Promise((resolve) => server.close(resolve));
  expect(port).toBeGreaterThan(0);
});
