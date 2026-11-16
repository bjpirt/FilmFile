import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { settings as settingsSchema } from '@filmfile/contracts/settings';
import { FixedClock } from '../../src/adapters/outbound/memory/fixed-clock.ts';
import { R2PublishBucket } from '../../src/adapters/outbound/r2/r2-publish-bucket.ts';
import { apiFor } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const accountId = '0123456789abcdef0123456789abcdef';
const folders: string[] = [];

afterEach(async () => {
  await Promise.all(
    folders.splice(0).map((folder) => rm(folder, { recursive: true })),
  );
});

/** The service with the R2 bucket reading keys from a credentials file holding `text`, or none. */
async function serviceWithCredentials(text: string | undefined) {
  const folder = await mkdtemp(path.join(tmpdir(), 'filmfile-aws-'));
  folders.push(folder);
  const file = path.join(folder, 'credentials');
  if (text !== undefined) {
    await writeFile(file, text);
  }
  const api = apiFor(archive, {
    publishBucket: new R2PublishBucket({
      credentialsFile: file,
      clock: new FixedClock('2026-11-02T12:00:00.000Z'),
    }),
  });
  await api.post('/api/settings', { author: 'Ben Pirt' });
  return api;
}

async function patch(
  api: Awaited<ReturnType<typeof serviceWithCredentials>>,
  body: unknown,
) {
  const etag = (await api.request('/api/settings')).headers.get('ETag') ?? '';
  return api.request('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify(body),
  });
}

const read = async (api: Awaited<ReturnType<typeof serviceWithCredentials>>) =>
  settingsSchema.parse(await (await api.request('/api/settings')).json());

describe('the Cloudflare account ID in Settings', () => {
  test('is null until set, then saved in settings.json and given back', async () => {
    const api = await serviceWithCredentials(undefined);
    expect((await read(api)).cloudflareAccountId).toBeNull();

    const saved = await patch(api, { cloudflareAccountId: accountId });

    expect(saved.status).toBe(200);
    expect(settingsSchema.parse(await saved.json()).cloudflareAccountId).toBe(
      accountId,
    );
    expect((await read(api)).cloudflareAccountId).toBe(accountId);
    const file: unknown = JSON.parse(
      await readFile(path.join(archive.folder(), 'settings.json'), 'utf8'),
    );
    expect(file).toMatchObject({ cloudflareAccountId: accountId });
  });

  test('is taken away with null or a blank, and settings.json then says nothing of it', async () => {
    const api = await serviceWithCredentials(undefined);
    await patch(api, { cloudflareAccountId: accountId });

    await patch(api, { cloudflareAccountId: '  ' });
    expect((await read(api)).cloudflareAccountId).toBeNull();
    await patch(api, { cloudflareAccountId: accountId });
    await patch(api, { cloudflareAccountId: null });

    expect((await read(api)).cloudflareAccountId).toBeNull();
    const text = await readFile(
      path.join(archive.folder(), 'settings.json'),
      'utf8',
    );
    expect(text).not.toContain('cloudflareAccountId');
  });

  test('refuses an ID that is not 32 hexadecimal characters, saving nothing', async () => {
    const api = await serviceWithCredentials(undefined);

    const refused = await patch(api, { cloudflareAccountId: 'abc' });

    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({
      error: 'invalid request',
      issues: [
        {
          path: ['cloudflareAccountId'],
          message: 'must be 32 hexadecimal characters',
        },
      ],
    });
    expect((await read(api)).cloudflareAccountId).toBeNull();
  });
});

describe('whether the Cloudflare keys are found', () => {
  test.each([
    [
      'found with both keys in the [filmfile] profile',
      '[filmfile]\naws_access_key_id = FILMKEY\naws_secret_access_key = secret-value\n',
      true,
    ],
    ['not found with no credentials file', undefined, false],
    [
      'not found with no [filmfile] profile',
      '[default]\naws_access_key_id = A\naws_secret_access_key = B\n',
      false,
    ],
  ])('is %s', async (_name, text, found) => {
    const api = await serviceWithCredentials(text);

    const response = await api.request('/api/settings');
    const body = await response.text();

    expect(settingsSchema.parse(JSON.parse(body)).cloudflareKeysFound).toBe(
      found,
    );
    expect(body).not.toContain('FILMKEY');
    expect(body).not.toContain('secret-value');
  });

  test('is told with every answer that gives the settings', async () => {
    const api = await serviceWithCredentials(
      '[filmfile]\naws_access_key_id = A\naws_secret_access_key = B\n',
    );

    const saved = await patch(api, { cloudflareAccountId: accountId });

    expect(settingsSchema.parse(await saved.json()).cloudflareKeysFound).toBe(
      true,
    );
  });
});
