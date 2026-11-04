import { createServer } from 'node:net';

/**
 * A port on 127.0.0.1 nothing is listening on, found by asking the system
 * for one and letting it go again. Another program could take it in between,
 * but then the service fails to start and says so.
 */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address === null || typeof address === 'string') {
          reject(new Error('No port was given for 127.0.0.1.'));
          return;
        }
        resolve(address.port);
      });
    });
  });
}
