import { beforeEach, describe, expect, test } from 'vitest';
import sharp from 'sharp';
import { aJpeg } from '../support/a-jpeg.ts';
import { readZip } from '../support/read-zip.ts';
import { apiFor, idOf } from '../support/api.ts';
import { useTempArchive } from '../support/temp-archive.ts';

const archive = useTempArchive();
const { request, post } = apiFor(archive);

let rollId = '';

beforeEach(async () => {
  await post('/api/settings', {
    author: 'Ben Pirt',
    copyright: 'All rights reserved',
  });
  rollId = String(
    idOf(
      await (
        await post('/api/rolls', { roll: '2026-014', shot: '2026' })
      ).json(),
    ),
  );
});

async function aFrame(
  number: string | null,
  scan?: Buffer,
): Promise<{ frameId: string; versionId: string | undefined }> {
  const frameId = String(
    idOf(
      await (
        await post(
          `/api/rolls/${rollId}/frames`,
          number === null ? {} : { number },
        )
      ).json(),
    ),
  );
  if (scan === undefined) {
    return { frameId, versionId: undefined };
  }
  const added = await request(
    `/api/rolls/${rollId}/frames/${frameId}/versions?file=12340014.jpg`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: new Uint8Array(scan),
    },
  );
  return { frameId, versionId: String(idOf(await added.json())) };
}

function prepare(frameId: string, change: object = {}) {
  return post('/api/exports/quick', {
    frames: [{ rollId, frameId }],
    output: 'jpeg',
    layout: 'flat',
    fileNames: '{roll}-{frame}',
    size: null,
    quality: 90,
    metadata: 'everything',
    ...change,
  });
}

async function downloadAddress(frameId: string, change: object = {}) {
  const response = await prepare(frameId, change);
  expect(response.status).toBe(201);
  const body: unknown = await response.json();
  return typeof body === 'object' && body !== null && 'url' in body
    ? String(body.url)
    : '';
}

/** A frame with all there is to say about it: its camera, lens, film, event, date, title, notes and rating. */
async function aDescribedFrame(): Promise<string> {
  const slugOf = async (response: Response) => {
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null && 'slug' in body
      ? String(body.slug)
      : '';
  };
  const camera = await slugOf(
    await post('/api/equipment/cameras', { make: 'Nikon', model: 'FE' }),
  );
  const film = await slugOf(
    await post('/api/equipment/films', {
      make: 'Kodak',
      name: 'Portra',
      iso: 400,
    }),
  );
  const lens = await slugOf(
    await post('/api/equipment/lenses', {
      make: 'Nikon',
      name: 'Nikkor',
      focalLength: 50,
      maxAperture: 1.8,
    }),
  );
  const event = await slugOf(
    await post('/api/events', { name: 'Iceland 2026' }),
  );
  const described = String(
    idOf(
      await (
        await post('/api/rolls', {
          roll: '2026-015',
          shot: '2026-09-14T15:30',
          camera,
          film,
          lens,
          event,
        })
      ).json(),
    ),
  );
  rollId = described;
  const { frameId } = await aFrame('12A', await aJpeg());
  const etag =
    (await request(`/api/rolls/${rollId}`)).headers.get('ETag') ?? '';
  await request(`/api/rolls/${rollId}/frames/${frameId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify({
      title: 'Black sand beach',
      notes: 'Low sun & wind',
      rating: 4,
    }),
  });
  return frameId;
}

async function metadataOf(address: string) {
  const made = await request(address);
  const { exif, xmp } = await sharp(
    new Uint8Array(await made.arrayBuffer()),
  ).metadata();
  return {
    exif: exif?.toString('utf8') ?? '',
    xmp: xmp?.toString('utf8') ?? '',
  };
}

describe('what an export says about itself', () => {
  test('with everything, gives the author, copyright, title, notes, date, camera, lens, film, event, rating and where it is from', async () => {
    const frameId = await aDescribedFrame();

    const { exif, xmp } = await metadataOf(await downloadAddress(frameId));

    for (const said of [
      'Ben Pirt',
      'All rights reserved',
      'Low sun',
      'Nikon',
      'FE',
      '2026:09:14 15:30:00',
      'Nikon Nikkor 50mm f/1.8',
    ]) {
      expect(exif).toContain(said);
    }
    expect(xmp).toContain('<dc:title>');
    for (const said of [
      'Black sand beach',
      'Low sun &amp; wind',
      '<xmp:Rating>4</xmp:Rating>',
      '2026-09-14T15:30',
      '2026-015 / 12A',
      'Kodak Portra 400',
      'Iceland 2026',
      '<rdf:Bag>',
    ]) {
      expect(xmp).toContain(said);
    }
  });

  test('with only author and copyright, says nothing else', async () => {
    const frameId = await aDescribedFrame();

    const { exif, xmp } = await metadataOf(
      await downloadAddress(frameId, { metadata: 'author-and-copyright' }),
    );

    expect(exif).toContain('Ben Pirt');
    expect(xmp).toContain('Ben Pirt');
    for (const left of [
      'Nikon',
      'Nikkor',
      'Portra',
      'Iceland',
      'Black sand',
      '2026',
      'Rating',
      '12A',
    ]) {
      expect(exif).not.toContain(left);
      expect(xmp).not.toContain(left);
    }
  });

  test('refuses something else to choose', async () => {
    const { frameId } = await aFrame('1', await aJpeg());

    expect((await prepare(frameId, { metadata: 'all' })).status).toBe(422);
    expect((await prepare(frameId, { metadata: undefined })).status).toBe(422);
  });
});

describe('exporting a frame once', () => {
  test('gives a JPEG named for the roll and frame, at the size and with the author and copyright', async () => {
    const { frameId } = await aFrame(
      '12A',
      await aJpeg({ width: 600, height: 400 }),
    );

    const response = await request(
      await downloadAddress(frameId, { size: 300 }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="2026-014-12A.jpg"; filename*=UTF-8''2026-014-12A.jpg`,
    );
    const jpeg = new Uint8Array(await response.arrayBuffer());
    const { width, height, exif } = await sharp(jpeg).metadata();
    expect([width, height]).toEqual([300, 200]);
    expect(exif?.toString('latin1')).toContain('Ben Pirt');
    expect(exif?.toString('latin1')).toContain('All rights reserved');
  });

  test('names a frame with no number for the roll', async () => {
    const { frameId } = await aFrame(null, await aJpeg());

    const response = await request(await downloadAddress(frameId));

    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="2026-014-frame.jpg"; filename*=UTF-8''2026-014-frame.jpg`,
    );
  });

  test('is made from the version shown, turned as it is shown', async () => {
    const { frameId, versionId } = await aFrame(
      '1',
      await aJpeg({ width: 600, height: 400 }),
    );
    const second = await request(
      `/api/rolls/${rollId}/frames/${frameId}/versions?file=edit.jpg`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: new Uint8Array(await aJpeg({ width: 300, height: 200 })),
      },
    );
    const shownId = String(idOf(await second.json()));
    const etag =
      (await request(`/api/rolls/${rollId}`)).headers.get('ETag') ?? '';
    const patch = (url: string, body: object, match: string) =>
      request(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': match },
        body: JSON.stringify(body),
      });
    const chosen = await patch(
      `/api/rolls/${rollId}/frames/${frameId}`,
      { defaultVersion: shownId },
      etag,
    );
    await patch(
      `/api/rolls/${rollId}/frames/${frameId}/versions/${shownId}`,
      { rotate: 90 },
      chosen.headers.get('ETag') ?? '',
    );

    const made = await request(await downloadAddress(frameId));

    const { width, height } = await sharp(
      new Uint8Array(await made.arrayBuffer()),
    ).metadata();
    expect([width, height]).toEqual([200, 300]);
    expect(versionId).toBeDefined();
  });

  test('the address works once', async () => {
    const { frameId } = await aFrame('1', await aJpeg());
    const address = await downloadAddress(frameId);

    expect((await request(address)).status).toBe(200);
    expect((await request(address)).status).toBe(404);
  });

  test('says there is no scan to export for a frame with no version', async () => {
    const { frameId } = await aFrame('1');

    const response = await prepare(frameId);

    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).toContain(
      'no scan to export',
    );
  });

  test('will not export a hidden frame', async () => {
    const { frameId } = await aFrame('1', await aJpeg());
    const etag =
      (await request(`/api/rolls/${rollId}`)).headers.get('ETag') ?? '';
    await request(`/api/rolls/${rollId}/frames/${frameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify({ hidden: true }),
    });

    const response = await prepare(frameId);

    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).toContain('hidden');
  });

  test('finds no frame that is not there', async () => {
    expect((await prepare('01JC8Z7K3M0000000000000009')).status).toBe(404);
  });

  test.each([
    ['no frames', { frames: [] }],
    ['a size too small', { size: 4 }],
    ['a quality over 100', { quality: 101 }],
    ['a quality that is not a whole number', { quality: 90.5 }],
    ['something else in it', { watermark: true }],
  ])('refuses %s', async (_what, change) => {
    const { frameId } = await aFrame('1', await aJpeg());

    expect((await prepare(frameId, change)).status).toBe(422);
  });

  test('refuses an address that is not a ticket', async () => {
    expect((await request('/api/exports/quick/not-a-ticket')).status).toBe(422);
    expect(
      (await request('/api/exports/quick/0f8fad5b-d9cb-469f-a165-70867728950e'))
        .status,
    ).toBe(404);
  });
});

describe('exporting several frames as a zip', () => {
  function prepareZip(
    frames: { rollId: string; frameId: string }[],
    change: object = {},
  ) {
    return post('/api/exports/quick', {
      frames,
      output: 'zip',
      layout: 'flat',
      fileNames: '{roll}-{frame}',
      size: 300,
      quality: 80,
      metadata: 'author-and-copyright',
      ...change,
    });
  }

  async function zipOf(
    frames: { rollId: string; frameId: string }[],
    change: object = {},
  ) {
    const prepared = await prepareZip(frames, change);
    expect(prepared.status).toBe(201);
    const body: unknown = await prepared.json();
    const url =
      typeof body === 'object' && body !== null && 'url' in body
        ? String(body.url)
        : '';
    const response = await request(url);
    return {
      response,
      files: readZip(new Uint8Array(await response.arrayBuffer())),
    };
  }

  // Each scan differs, since a roll refuses the same scan twice.
  let shades = 0;
  const shade = () => (shades += 20);

  /** A frame of the roll, with this number and title. */
  async function framed(number: string, title?: string, scan = true) {
    const { frameId } = await aFrame(
      number,
      scan
        ? await aJpeg({ width: 600, height: 400, shade: shade() })
        : undefined,
    );
    if (title !== undefined) {
      const etag =
        (await request(`/api/rolls/${rollId}`)).headers.get('ETag') ?? '';
      await request(`/api/rolls/${rollId}/frames/${frameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'If-Match': etag },
        body: JSON.stringify({ title }),
      });
    }
    return { rollId, frameId };
  }

  test('is a zip named for the roll and its event, with a JPEG of each frame as the recipe makes it', async () => {
    await post('/api/events', { name: 'Westfjords' });
    rollId = String(
      idOf(
        await (
          await post('/api/rolls', {
            roll: '2026-016',
            shot: '2026-09',
            event: 'westfjords',
          })
        ).json(),
      ),
    );
    const frames = [await framed('1'), await framed('2')];

    const { response, files } = await zipOf(frames);

    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="2026-016 Westfjords.zip"; filename*=UTF-8''2026-016%20Westfjords.zip`,
    );
    expect(files.map((file) => file.name)).toEqual([
      '2026-016-1.jpg',
      '2026-016-2.jpg',
    ]);
    const { width, height } = await sharp(
      new Uint8Array(files[0]?.data ?? []),
    ).metadata();
    expect([width, height]).toEqual([300, 200]);
  });

  test('lays files out and names them as chosen, numbering names that would be the same', async () => {
    const frames = [
      await framed('1', 'Black sand'),
      await framed('2', 'Black sand'),
      await framed('3', 'Glacier'),
    ];

    const { files } = await zipOf(frames, {
      layout: 'year-roll',
      fileNames: '{title}',
    });

    expect(files.map((file) => file.name)).toEqual([
      '2026/2026-014/Black sand.jpg',
      '2026/2026-014/Black sand-2.jpg',
      '2026/2026-014/Glacier.jpg',
    ]);
  });

  test('names a zip of several rolls for FilmFile', async () => {
    const first = await framed('1');
    rollId = String(
      idOf(
        await (
          await post('/api/rolls', { roll: '2026-020', shot: '2026' })
        ).json(),
      ),
    );
    const second = await framed('1');

    const { response, files } = await zipOf([first, second], {
      layout: 'roll-folder',
    });

    expect(response.headers.get('Content-Disposition')).toContain(
      'FilmFile export.zip',
    );
    expect(files.map((file) => file.name)).toEqual([
      '2026-014/2026-014-1.jpg',
      '2026-020/2026-020-1.jpg',
    ]);
  });

  test('is named as asked, however many rolls its frames are from, each made from its own roll', async () => {
    const first = await framed('1');
    rollId = String(
      idOf(
        await (
          await post('/api/rolls', { roll: '2026-020', shot: '2026' })
        ).json(),
      ),
    );
    const second = await framed('1');

    const { response, files } = await zipOf([first, second], {
      name: 'Iceland 2026',
      layout: 'roll-folder',
    });

    expect(response.headers.get('Content-Disposition')).toContain(
      'filename="Iceland 2026.zip"',
    );
    expect(files.map((file) => file.name)).toEqual([
      '2026-014/2026-014-1.jpg',
      '2026-020/2026-020-1.jpg',
    ]);
    expect(files[0]?.data.equals(files[1]?.data ?? Buffer.alloc(0))).toBe(
      false,
    );
  });

  test('leaves out a frame that has no scan or is hidden, listing it in skipped.txt', async () => {
    const good = await framed('1');
    const noScan = await framed('2', undefined, false);
    const hidden = await framed('3');
    const etag =
      (await request(`/api/rolls/${rollId}`)).headers.get('ETag') ?? '';
    await request(`/api/rolls/${rollId}/frames/${hidden.frameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': etag },
      body: JSON.stringify({ hidden: true }),
    });

    const { files } = await zipOf([good, noScan, hidden]);

    expect(files.map((file) => file.name)).toEqual([
      '2026-014-1.jpg',
      'skipped.txt',
    ]);
    expect(files[1]?.data.toString()).toBe(
      'These frames were left out:\n- frame 2 of roll 2026-014: it has no scan\n- frame 3 of roll 2026-014: it is hidden\n',
    );
  });

  test('has no skipped.txt when every frame is made', async () => {
    const { files } = await zipOf([await framed('1')]);

    expect(files.map((file) => file.name)).toEqual(['2026-014-1.jpg']);
  });

  test('refuses a pattern with something that is not a placeholder', async () => {
    const response = await prepareZip([await framed('1')], {
      fileNames: '{roll}-{rol}',
    });

    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).toContain('{rol}');
  });

  test('refuses a JPEG of several frames, and a frame that is not there', async () => {
    const frame = await framed('1');

    expect((await prepareZip([frame, frame], { output: 'jpeg' })).status).toBe(
      422,
    );
    expect(
      (await prepareZip([{ rollId, frameId: '01JC8Z7K3M0000000000000009' }]))
        .status,
    ).toBe(404);
  });
});
