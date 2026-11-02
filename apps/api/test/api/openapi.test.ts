import { describe, expect, test } from 'vitest';
import { apiFor } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const { request } = apiFor(useTempArchive());

describe('GET /api/openapi.json', () => {
  // A change to the API shows up as a diff in this file; update it with `vitest -u` when intended.
  test('matches the committed spec', async () => {
    const response = await request('/api/openapi.json');

    expect(response.status).toBe(200);
    await expect(
      `${JSON.stringify(await response.json(), null, 2)}\n`,
    ).toMatchFileSnapshot('./__snapshots__/openapi.json');
  });
});

describe('GET /api/docs', () => {
  test('serves a docs page that loads its scripts and styles from the service', async () => {
    const response = await request('/api/docs');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(/^text\/html/);
    expect(html).toContain('src="/api/docs/swagger-ui-bundle.js"');
    expect(html).toContain('href="/api/docs/swagger-ui.css"');
    expect(html).not.toMatch(/https?:\/\//);
  });

  test.each([
    ['swagger-ui-bundle.js', /^text\/javascript/],
    ['swagger-ui.css', /^text\/css/],
    ['docs.js', /^text\/javascript/],
  ])('serves %s', async (file, contentType) => {
    const response = await request(`/api/docs/${file}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toMatch(contentType);
  });
});
