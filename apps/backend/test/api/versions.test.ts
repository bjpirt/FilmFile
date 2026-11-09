import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { aJpeg } from '../support/a-jpeg.ts';
import { aRaw } from '../support/a-raw.ts';
import { anImage } from '../support/an-image.ts';
import { apiFor, idOf } from '../support/api.ts';
import { folderOfRoll } from '../support/roll-folder.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

let rollId = '';
let frameId = '';

beforeEach(async () => {
  rollId = String(
    idOf(
      await (
        await post('/api/rolls', { roll: '2026-014', shot: '2026' })
      ).json(),
    ),
  );
  frameId = String(
    idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
  );
});

function upload(
  image: Buffer,
  query = 'file=12340014.jpg',
  frame = frameId,
): Promise<Response> {
  return request(`/api/rolls/${rollId}/frames/${frame}/versions?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: new Uint8Array(image),
  });
}

describe('POST /api/rolls/{id}/frames/{frameId}/versions', () => {
  test('does not create a folder for an empty frame', async () => {
    const folder = await folderOfRoll(archive.path(), '2026-014');

    await expect(readdir(path.join(folder, 'frames'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  test.each([
    ['png', 'image/png', 'edit.png'],
    ['webp', 'image/webp', 'edit.webp'],
  ] as const)(
    'adds a %s, and gives it back with its own type',
    async (format, type, file) => {
      const image = await anImage(format, { width: 30, height: 20 });

      const response = await request(
        `/api/rolls/${rollId}/frames/${frameId}/versions?file=${file}`,
        {
          method: 'POST',
          headers: { 'Content-Type': type },
          body: new Uint8Array(image),
        },
      );
      expect(response.status).toBe(201);
      const version: unknown = await response.json();
      expect(version).toMatchObject({ width: 30, height: 20 });

      const original = await request(
        `/api/rolls/${rollId}/frames/${frameId}/versions/${String(idOf(version))}/file`,
      );
      expect(original.headers.get('Content-Type')).toBe(type);
      expect(Buffer.from(await original.arrayBuffer()).equals(image)).toBe(
        true,
      );
    },
  );

  test('refuses an image that is none of JPEG, PNG and WebP, whatever it claims', async () => {
    const gif = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0,
    ]);

    const response = await request(
      `/api/rolls/${rollId}/frames/${frameId}/versions?file=edit.png`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: gif,
      },
    );

    expect(response.status).toBe(415);
  });

  test('stores the scan unchanged in a folder for the version, inside a folder for the frame', async () => {
    const image = await aJpeg();

    const versionId = String(idOf(await (await upload(image)).json()));

    const stored = await readFile(
      path.join(
        await folderOfRoll(archive.path(), '2026-014'),
        'frames',
        `unnumbered-${frameId.slice(-8)}`,
        `scan-${versionId.slice(-8)}`,
        '12340014.jpg',
      ),
    );
    expect(stored.equals(image)).toBe(true);
  });

  test('returns the version metadata without its filesystem path', async () => {
    const image = await aJpeg({ width: 30, height: 20 });

    const response = await upload(image);
    const version: unknown = await response.json();

    expect(response.status).toBe(201);
    expect(version).not.toHaveProperty('file');
    expect(version).toMatchObject({
      fileName: '12340014.jpg',
      sha256: createHash('sha256').update(image).digest('hex'),
      bytes: image.length,
      width: 30,
      height: 20,
    });
    expect(idOf(version)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test('adds the version to its frame', async () => {
    const version: unknown = await (await upload(await aJpeg())).json();

    const roll: unknown = await (await request(`/api/rolls/${rollId}`)).json();

    expect(roll).not.toHaveProperty('frames.0.versions.0.file');
    expect(roll).toMatchObject({
      frames: [{ id: frameId, versions: [version] }],
    });
  });

  test('refuses a scan that is already in the roll', async () => {
    const image = await aJpeg();
    await upload(image);
    const otherFrame = String(
      idOf(await (await post(`/api/rolls/${rollId}/frames`, {})).json()),
    );

    const response = await upload(image, 'file=12340015.jpg', otherFrame);

    expect(response.status).toBe(409);
  });

  test('keeps both of two different scans with the same name', async () => {
    const first = await aJpeg({ shade: 50 });
    const second = await aJpeg({ shade: 200 });

    const versions: unknown[] = [
      await (await upload(first)).json(),
      await (await upload(second)).json(),
    ];

    const roll: unknown = await (await request(`/api/rolls/${rollId}`)).json();
    expect(roll).toMatchObject({ frames: [{ versions }] });
    const folder = await folderOfRoll(archive.path(), '2026-014');
    const files = await Promise.all(
      versions.map((version) =>
        readFile(
          path.join(
            folder,
            'frames',
            `unnumbered-${frameId.slice(-8)}`,
            `scan-${String(idOf(version)).slice(-8)}`,
            '12340014.jpg',
          ),
        ),
      ),
    );
    expect(files.map((file) => file.equals(first))).toEqual([true, false]);
    expect(files.map((file) => file.equals(second))).toEqual([false, true]);
  });

  test('returns 404 for a frame that is not in the roll', async () => {
    const response = await upload(
      await aJpeg(),
      undefined,
      '01JC8Z7K3M0000000000000000',
    );

    expect(response.status).toBe(404);
  });

  test.each([
    ['an unsafe file name', 'file=../12340014.jpg'],
    ['a file name with a folder', 'file=scans/12340014.jpg'],
    ['a file name that isn’t an image’s', 'file=12340014.gif'],
    ['no file name', ''],
  ])('rejects %s', async (_case, query) => {
    const response = await upload(await aJpeg(), query);

    expect(response.status).toBe(422);
  });
});

describe('DELETE /api/rolls/{id}/frames/{frameId}/versions/{versionId}', () => {
  async function twoVersions() {
    const first = String(
      idOf(await (await upload(await aJpeg({ shade: 40 }))).json()),
    );
    const second = String(
      idOf(
        await (
          await upload(await aJpeg({ shade: 200 }), 'file=edit.jpg')
        ).json(),
      ),
    );
    const etag = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');
    return { first, second, etag: etag ?? '' };
  }

  function remove(versionId: string, ifMatch?: string) {
    return request(
      `/api/rolls/${rollId}/frames/${frameId}/versions/${versionId}`,
      {
        method: 'DELETE',
        headers: ifMatch === undefined ? {} : { 'If-Match': ifMatch },
      },
    );
  }

  test('moves the version’s files into deleted/, leaving the frame and its other version', async () => {
    const { first, second, etag } = await twoVersions();

    const response = await remove(second, etag);

    expect(response.status).toBe(204);
    const roll = await request(`/api/rolls/${rollId}`);
    expect(response.headers.get('ETag')).toBe(roll.headers.get('ETag'));
    expect(await roll.json()).toMatchObject({
      frames: [{ id: frameId, versions: [{ id: first }] }],
    });
    const [held] = await readdir(path.join(archive.path(), 'deleted'));
    expect(held).toMatch(new RegExp(`-version-${second}$`));
    expect(
      (await readdir(path.join(archive.path(), 'deleted', held ?? ''))).sort(),
    ).toEqual([`scan-${second.slice(-8)}`, 'version.json']);
  });

  test.each(['raw-scan', 'final'] as const)(
    'keeps the scan mark when the last %s is deleted',
    async (kind) => {
      const current = await request(`/api/rolls/${rollId}`);
      const marked = await request(`/api/rolls/${rollId}/frames/${frameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': current.headers.get('ETag') ?? '',
        },
        body: JSON.stringify({ toScan: true }),
      });
      expect(marked.status).toBe(200);

      await upload(await aJpeg({ shade: 20 }), 'file=scan.jpg&kind=scan');
      const actioned = await upload(
        await aJpeg({ shade: 210 }),
        `file=${kind}.jpg&kind=${kind}`,
      );
      const version: unknown = await actioned.json();
      const latest = await request(`/api/rolls/${rollId}`);
      const removed = await request(
        `/api/rolls/${rollId}/frames/${frameId}/versions/${String(idOf(version))}`,
        {
          method: 'DELETE',
          headers: { 'If-Match': latest.headers.get('ETag') ?? '' },
        },
      );

      expect(removed.status).toBe(204);
      const roll: unknown = await (
        await request(`/api/rolls/${rollId}`)
      ).json();
      expect(roll).toMatchObject({
        frames: [{ toScan: true, versions: [{ kind: 'scan' }] }],
      });
    },
  );

  test.each([
    ['no If-Match', undefined, 428],
    ['a stale If-Match', '"stale"', 409],
  ])('refuses %s', async (_case, ifMatch, status) => {
    const { second } = await twoVersions();

    expect((await remove(second, ifMatch)).status).toBe(status);
  });

  test('refuses to delete a frame’s only version', async () => {
    const only = String(idOf(await (await upload(await aJpeg())).json()));
    const etag = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');

    expect((await remove(only, etag ?? '')).status).toBe(422);
  });
});

describe('the version shown everywhere (FF-103)', () => {
  async function twoVersions() {
    const first = String(
      idOf(await (await upload(await aJpeg({ shade: 40 }))).json()),
    );
    const second = String(
      idOf(
        await (
          await upload(await aJpeg({ shade: 200 }), 'file=edit.jpg')
        ).json(),
      ),
    );
    return { first, second };
  }

  async function choose(defaultVersion: string | null) {
    const etag = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');
    return await request(`/api/rolls/${rollId}/frames/${frameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag ?? '' },
      body: JSON.stringify({ defaultVersion }),
    });
  }

  test('is chosen with If-Match, and cleared to the first with null', async () => {
    const { second } = await twoVersions();

    const chosen = await choose(second);
    expect(chosen.status).toBe(200);
    expect(await chosen.json()).toMatchObject({ defaultVersion: second });

    const cleared = await choose(null);
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ defaultVersion: null });
  });

  test('refuses a version the frame does not have, changing nothing', async () => {
    await twoVersions();

    const response = await choose('01JC8Z7K3M0000000000000000');

    expect(response.status).toBe(422);
    expect(await (await request(`/api/rolls/${rollId}`)).json()).toMatchObject({
      frames: [{ defaultVersion: null }],
    });
  });

  test('goes back to the first when the version chosen is deleted', async () => {
    const { second } = await twoVersions();
    await choose(second);
    const etag = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');

    await request(`/api/rolls/${rollId}/frames/${frameId}/versions/${second}`, {
      method: 'DELETE',
      headers: { 'If-Match': etag ?? '' },
    });

    expect(await (await request(`/api/rolls/${rollId}`)).json()).toMatchObject({
      frames: [{ defaultVersion: null }],
    });
  });
});

describe('version kinds', () => {
  test('adds a version as the kind given, a scan unless said', async () => {
    const scan: unknown = await (
      await upload(await aJpeg({ shade: 10 }))
    ).json();
    const raw: unknown = await (
      await upload(await aJpeg({ shade: 90 }), 'file=raw.jpg&kind=raw-scan')
    ).json();

    expect(scan).toMatchObject({ kind: 'scan' });
    expect(raw).toMatchObject({ kind: 'raw-scan' });
  });

  test.each(['raw-scan', 'final'] as const)(
    'keeps the scan mark when a %s is uploaded',
    async (kind) => {
      const current = await request(`/api/rolls/${rollId}`);
      const marked = await request(`/api/rolls/${rollId}/frames/${frameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': current.headers.get('ETag') ?? '',
        },
        body: JSON.stringify({ toScan: true }),
      });
      expect(marked.status).toBe(200);

      const added = await upload(
        await aJpeg({ shade: kind === 'final' ? 190 : 90 }),
        `file=${kind}.jpg&kind=${kind}`,
      );
      expect(added.status).toBe(201);
      const roll: unknown = await (
        await request(`/api/rolls/${rollId}`)
      ).json();
      expect(roll).toMatchObject({ frames: [{ toScan: true }] });
    },
  );

  test.each(['raw-scan', 'final'] as const)(
    'allows marking a frame that already has a %s',
    async (kind) => {
      await upload(await aJpeg(), `file=${kind}.jpg&kind=${kind}`);
      const current = await request(`/api/rolls/${rollId}`);
      const marked = await request(`/api/rolls/${rollId}/frames/${frameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': current.headers.get('ETag') ?? '',
        },
        body: JSON.stringify({ toScan: true }),
      });

      expect(marked.status).toBe(200);
      expect(await marked.json()).toMatchObject({
        toScan: true,
        versions: [{ kind }],
      });
    },
  );

  test.each(['raw-scan', 'final'] as const)(
    'keeps the scan mark after adding a %s',
    async (kind) => {
      const current = await request(`/api/rolls/${rollId}`);
      const marked = await request(`/api/rolls/${rollId}/frames/${frameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': current.headers.get('ETag') ?? '',
        },
        body: JSON.stringify({ toScan: true }),
      });
      expect(marked.status).toBe(200);

      const added = await upload(
        await aJpeg({ shade: kind === 'final' ? 170 : 80 }),
        `file=${kind}.jpg&kind=${kind}`,
      );
      expect(added.status).toBe(201);
      const roll: unknown = await (
        await request(`/api/rolls/${rollId}`)
      ).json();
      expect(roll).toMatchObject({ frames: [{ toScan: true }] });
    },
  );

  test.each(['raw-scan', 'final'] as const)(
    'keeps the mark if the last %s is deleted',
    async (kind) => {
      const marked = await request(`/api/rolls/${rollId}/frames/${frameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match':
            (await request(`/api/rolls/${rollId}`)).headers.get('ETag') ?? '',
        },
        body: JSON.stringify({ toScan: true }),
      });
      expect(marked.status).toBe(200);
      await upload(await aJpeg({ shade: 30 }), 'file=scan.jpg&kind=scan');
      const actioned = await upload(
        await aJpeg({ shade: 220 }),
        `file=${kind}.jpg&kind=${kind}`,
      );
      const actionedVersion: unknown = await actioned.json();
      const current = await request(`/api/rolls/${rollId}`);
      const removed = await request(
        `/api/rolls/${rollId}/frames/${frameId}/versions/${String(idOf(actionedVersion))}`,
        {
          method: 'DELETE',
          headers: { 'If-Match': current.headers.get('ETag') ?? '' },
        },
      );

      expect(removed.status).toBe(204);
      const roll: unknown = await (
        await request(`/api/rolls/${rollId}`)
      ).json();
      expect(roll).toMatchObject({
        frames: [{ toScan: true, versions: [{ kind: 'scan' }] }],
      });
    },
  );

  test('changes a version’s kind with If-Match', async () => {
    const added: unknown = await (await upload(await aJpeg())).json();
    const etag = (await request(`/api/rolls/${rollId}`)).headers.get('ETag');

    const response = await request(
      `/api/rolls/${rollId}/frames/${frameId}/versions/${String(idOf(added))}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': etag ?? '',
        },
        body: JSON.stringify({ kind: 'final' }),
      },
    );

    expect(response.status).toBe(200);
    const updated: unknown = await response.json();
    expect(updated).toMatchObject({ kind: 'final', rotate: 0 });
    expect(updated).not.toHaveProperty('file');
  });

  test('moves the stored file when its frame number and kind change', async () => {
    const image = await aJpeg();
    const added: unknown = await (await upload(image)).json();
    const versionId = String(idOf(added));
    const folder = await folderOfRoll(archive.path(), '2026-014');
    const oldFile = path.join(
      folder,
      'frames',
      `unnumbered-${frameId.slice(-8)}`,
      `scan-${versionId.slice(-8)}`,
      '12340014.jpg',
    );

    const current = await request(`/api/rolls/${rollId}`);
    const numbered = await request(`/api/rolls/${rollId}/frames/${frameId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': current.headers.get('ETag') ?? '',
      },
      body: JSON.stringify({ number: '12/13' }),
    });
    expect(numbered.status).toBe(200);

    const kindChanged = await request(
      `/api/rolls/${rollId}/frames/${frameId}/versions/${versionId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': numbered.headers.get('ETag') ?? '',
        },
        body: JSON.stringify({ kind: 'final' }),
      },
    );
    expect(kindChanged.status).toBe(200);
    expect(
      await readFile(
        path.join(
          folder,
          'frames',
          `12_13-${frameId.slice(-8)}`,
          `final-${versionId.slice(-8)}`,
          '12340014.jpg',
        ),
      ),
    ).toEqual(image);
    await expect(readFile(oldFile)).rejects.toThrow();

    const rollFile = await readFile(path.join(folder, 'roll.json'), 'utf8');
    const stored: unknown = JSON.parse(rollFile);
    expect(stored).toMatchObject({
      frames: [
        {
          versions: [
            {
              file: `frames/12_13-${frameId.slice(-8)}/final-${versionId.slice(-8)}/12340014.jpg`,
            },
          ],
        },
      ],
    });
  });

  test('refuses a kind it doesn’t know', async () => {
    expect(
      (await upload(await aJpeg(), 'file=x.jpg&kind=negative')).status,
    ).toBe(422);
  });
});

describe('raw scans', () => {
  test('adds an ARW as a raw scan, with its sensor size, a thumbnail from its preview, and the original back unchanged', async () => {
    const raw = await aRaw({ sensor: { width: 6000, height: 4000 } });

    const response = await request(
      `/api/rolls/${rollId}/frames/${frameId}/versions?file=DSC04412.ARW&kind=raw-scan`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'image/x-sony-arw' },
        body: raw,
      },
    );
    expect(response.status).toBe(201);
    const version: unknown = await response.json();
    expect(version).toMatchObject({
      kind: 'raw-scan',
      width: 6000,
      height: 4000,
    });
    const url = `/api/rolls/${rollId}/frames/${frameId}/versions/${String(idOf(version))}`;

    const thumbnail = await request(`${url}/thumbnail?size=small`);
    expect(thumbnail.status).toBe(200);
    expect(thumbnail.headers.get('Content-Type')).toBe('image/webp');
    const original = await request(`${url}/file`);
    expect(
      Buffer.from(await original.arrayBuffer()).equals(Buffer.from(raw)),
    ).toBe(true);
  });

  test('adds a TIFF sent with no particular type', async () => {
    const tiff = await anImage('tiff', { width: 30, height: 20 });

    const response = await request(
      `/api/rolls/${rollId}/frames/${frameId}/versions?file=neg-12.tif&kind=raw-scan`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(tiff),
      },
    );

    expect(response.status).toBe(201);
  });
});
