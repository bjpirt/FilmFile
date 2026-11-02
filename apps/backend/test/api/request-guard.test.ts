import { describe, expect, test } from 'vitest';
import { composeLocal } from '../../src/composition/compose-local.ts';

// Any web page the user visits can send requests to localhost. These checks
// make sure only the FilmFile UI, and tools on this machine, get answers.

const port = 4310;

function request(
  headers: Record<string, string>,
  method = 'GET',
  host = `127.0.0.1:${String(port)}`,
): Promise<Response> {
  const app = composeLocal({
    archivePath: '/unused',
    cachePath: '/unused',
    port,
    uiOrigin: 'http://localhost:5173',
  });
  return Promise.resolve(
    app.request(`http://${host}/api/health`, { method, headers }),
  );
}

describe('the Host header', () => {
  test.each(['127.0.0.1:4310', 'localhost:4310', '[::1]:4310'])(
    'is accepted when it is %s',
    async (host) => {
      expect((await request({}, 'GET', host)).status).toBe(200);
    },
  );

  test.each([
    ['another site, as in DNS rebinding', 'attacker.example:4310'],
    ['another port', 'localhost:8080'],
    ['no port', 'localhost'],
    ['a LAN address', '192.168.1.20:4310'],
  ])('is refused when it is %s', async (_case, host) => {
    const response = await request({}, 'GET', host);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'request refused' });
  });
});

describe('the Origin header', () => {
  test.each([
    'http://127.0.0.1:4310',
    'http://localhost:4310',
    'http://[::1]:4310',
    'http://localhost:5173',
  ])('is accepted from the UI at %s', async (origin) => {
    expect((await request({ Origin: origin }, 'POST')).status).not.toBe(403);
  });

  test.each([
    ['another site', 'https://attacker.example'],
    ['another local port', 'http://localhost:8080'],
    ['https on the right port', 'https://localhost:4310'],
    ['a sandboxed page', 'null'],
  ])('is refused from %s', async (_case, origin) => {
    const response = await request({ Origin: origin });

    expect(response.status).toBe(403);
  });

  test('may be missing from a request that only reads', async () => {
    expect((await request({})).status).toBe(200);
  });

  test.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'must be present on a %s',
    async (method) => {
      expect((await request({}, method)).status).toBe(403);
    },
  );
});
