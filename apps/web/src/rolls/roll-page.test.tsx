// @vitest-environment happy-dom
import { createApiClient } from '@filmfile/contracts/client';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { RollPage } from './roll-page.tsx';

afterEach(cleanup);

const rollId = '01JC8Z7K3M0000000000000001';

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/** Answers the roll's endpoints the way the backend does, keeping frames in memory. */
function fakeRollService(frames: Frame[] = []) {
  const requests: string[] = [];
  let nextId = 100;
  const newId = () => `01JC8Z7K3M0000000000000${String((nextId += 1))}`;

  async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    if (request.method === 'GET' && url.pathname === `/api/rolls/${rollId}`) {
      const roll: Roll = { id: rollId, roll: '2026-014', frames };
      return Response.json(roll);
    }
    if (request.method === 'POST' && url.pathname.endsWith('/frames')) {
      const body: unknown = await request.json();
      const number =
        typeof body === 'object' && body !== null && 'number' in body
          ? String(body.number)
          : null;
      const frame: Frame = { id: newId(), number, versions: [] };
      frames.push(frame);
      return Response.json(frame, { status: 201 });
    }
    const frame = frames.find((f) => url.pathname.includes(f.id));
    if (request.method === 'POST' && frame !== undefined) {
      const hash = await sha256(await request.arrayBuffer());
      if (frames.some((f) => f.versions.some((v) => v.sha256 === hash))) {
        return Response.json({ error: 'already in the roll' }, { status: 409 });
      }
      const file = url.searchParams.get('file') ?? '';
      const version = {
        id: newId(),
        file: `frames/x/y/${file}`,
        sha256: hash,
        bytes: 3,
        width: 3,
        height: 2,
        added: '2026-11-02T12:00:00.000Z',
      };
      frame.versions.push(version);
      return Response.json(version, { status: 201 });
    }
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  return { answer, requests, frames };
}

function aScan(name: string, content = name): File {
  return new File([content], name, { type: 'image/jpeg' });
}

function aFrameWithScan(number: string | null, file: string): Frame {
  return {
    id: `01JC8Z7K3M00000000000000${file.slice(6, 8)}`,
    number,
    versions: [
      {
        id: `01JC8Z7K3M00000000000001${file.slice(6, 8)}`,
        file: `frames/x/y/${file}`,
        sha256: file,
        bytes: 3,
        width: 3,
        height: 2,
        added: '2026-11-02T12:00:00.000Z',
      },
    ],
  };
}

function renderPage(service: { answer: (r: Request) => Promise<Response> }) {
  const api = createApiClient({
    baseUrl: 'http://localhost',
    fetch: service.answer,
  });
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queries}>
      <RollPage api={api} rollId={rollId} />
    </QueryClientProvider>,
  );
}

function chooseScans(...files: File[]) {
  fireEvent.change(screen.getByLabelText('Choose lab scans'), {
    target: { files },
  });
}

test('shows a thumbnail of each frame, labelled with its frame number', async () => {
  renderPage(
    fakeRollService([
      aFrameWithScan('1', '12340001.jpg'),
      aFrameWithScan(null, '12340002.jpg'),
    ]),
  );

  const thumbnails = await screen.findAllByRole('img');

  expect(thumbnails.map((img) => img.getAttribute('alt'))).toEqual([
    '12340001.jpg',
    '12340002.jpg',
  ]);
  expect(thumbnails[0]?.getAttribute('src')).toBe(
    `/api/rolls/${rollId}/frames/01JC8Z7K3M0000000000000001/versions/01JC8Z7K3M0000000000000101/thumbnail?size=small`,
  );
  expect(screen.getByText('1')).toBeDefined();
  expect(screen.getByText('No number')).toBeDefined();
});

test('shows a placeholder for a frame with no scan', async () => {
  renderPage(
    fakeRollService([
      { id: rollId.replace('01', '02'), number: '5', versions: [] },
    ]),
  );

  expect(await screen.findByText('No scan')).toBeDefined();
});

test('uploads each scan as a new frame, one at a time, in file name order', async () => {
  const service = fakeRollService();
  renderPage(service);
  await screen.findByText('No frames yet.');

  chooseScans(aScan('12340002.jpg'), aScan('12340001.jpg'));

  expect(await screen.findByText('Uploaded 2 scans.')).toBeDefined();
  expect(service.requests.filter((r) => r.startsWith('POST'))).toEqual([
    `POST /api/rolls/${rollId}/frames`,
    `POST /api/rolls/${rollId}/frames/01JC8Z7K3M0000000000000101/versions?file=12340001.jpg`,
    `POST /api/rolls/${rollId}/frames`,
    `POST /api/rolls/${rollId}/frames/01JC8Z7K3M0000000000000103/versions?file=12340002.jpg`,
  ]);
  expect(
    (await screen.findAllByRole('img')).map((img) => img.getAttribute('alt')),
  ).toEqual(['12340001.jpg', '12340002.jpg']);
});

test('numbers new frames in upload order, from 1 in an empty roll', async () => {
  const service = fakeRollService();
  renderPage(service);
  await screen.findByText('No frames yet.');

  chooseScans(aScan('12340002.jpg'), aScan('12340001.jpg'));
  await screen.findByText('Uploaded 2 scans.');

  expect(service.frames.map((f) => f.number)).toEqual(['1', '2']);
});

test('numbers new frames on from the highest number in the roll', async () => {
  const service = fakeRollService([
    aFrameWithScan('12A', '12340012.jpg'),
    aFrameWithScan('36', '12340036.jpg'),
    aFrameWithScan(null, '12340037.jpg'),
  ]);
  renderPage(service);
  await screen.findAllByRole('img');

  chooseScans(aScan('12340040.jpg'), aScan('12340041.jpg'));
  await screen.findByText('Uploaded 2 scans.');

  expect(service.frames.map((f) => f.number)).toEqual([
    '12A',
    '36',
    null,
    '37',
    '38',
  ]);
});

test('does not use up a number for a scan already in the roll', async () => {
  const service = fakeRollService();
  renderPage(service);
  await screen.findByText('No frames yet.');
  chooseScans(aScan('12340001.jpg', 'same'));
  await screen.findByText('Uploaded 1 scan.');

  chooseScans(aScan('12340001.jpg', 'same'), aScan('12340002.jpg'));
  await screen.findByText('Uploaded 1 scan. 1 was already in the roll.');

  expect(service.frames.map((f) => f.number)).toEqual(['1', '2']);
});

test('accepts scans dropped onto the page', async () => {
  const service = fakeRollService();
  renderPage(service);
  await screen.findByText('No frames yet.');

  fireEvent.drop(screen.getByText(/Drop lab scans/), {
    dataTransfer: { files: [aScan('12340001.jpg')] },
  });

  expect(await screen.findByText('Uploaded 1 scan.')).toBeDefined();
});

test('uploads the scans in a folder dropped onto the page', async () => {
  const service = fakeRollService();
  renderPage(service);
  await screen.findByText('No frames yet.');
  const scans = [aScan('12340001.jpg'), aScan('12340002.jpg')];
  const folder = {
    name: 'lab-download',
    createReader: () => {
      const batches = [
        scans.map((scan) => ({
          name: scan.name,
          file: (success: (file: File) => void) => {
            success(scan);
          },
        })),
        [],
      ];
      return {
        readEntries: (success: (entries: unknown[]) => void) => {
          success(batches.shift() ?? []);
        },
      };
    },
  };

  fireEvent.drop(screen.getByText(/Drop lab scans/), {
    dataTransfer: {
      files: [],
      items: [{ kind: 'file', webkitGetAsEntry: () => folder }],
    },
  });

  expect(await screen.findByText('Uploaded 2 scans.')).toBeDefined();
});

test('says when a drop holds no scans', async () => {
  renderPage(fakeRollService());
  await screen.findByText('No frames yet.');

  fireEvent.drop(screen.getByText(/Drop lab scans/), {
    dataTransfer: { files: [] },
  });

  expect(await screen.findByText(/No JPEG scans found/)).toBeDefined();
});

test('skips a scan that is already in the roll, without creating a frame', async () => {
  const service = fakeRollService();
  renderPage(service);
  await screen.findByText('No frames yet.');
  chooseScans(aScan('12340001.jpg', 'same'));
  await screen.findByText('Uploaded 1 scan.');

  chooseScans(aScan('12340001.jpg', 'same'), aScan('12340002.jpg'));

  expect(
    await screen.findByText('Uploaded 1 scan. 1 was already in the roll.'),
  ).toBeDefined();
  expect(service.frames).toHaveLength(2);
});

test('does not upload a file whose name the service would refuse', async () => {
  const service = fakeRollService();
  renderPage(service);
  await screen.findByText('No frames yet.');

  chooseScans(aScan('scan 1.jpg'));

  expect(
    await screen.findByText(
      'Uploaded 0 scans. Not uploaded: scan 1.jpg (must be a JPEG file name like 12340014.jpg).',
    ),
  ).toBeDefined();
  expect(service.frames).toHaveLength(0);
});

test('says when the roll does not exist', async () => {
  renderPage({
    answer: () =>
      Promise.resolve(Response.json({ error: 'no roll' }, { status: 404 })),
  });

  expect(await screen.findByText('There is no such roll.')).toBeDefined();
});
