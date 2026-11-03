// @vitest-environment happy-dom
import { createApiClient } from '@filmfile/contracts/client';
import {
  updateFrameNumbersRequest,
  type Frame,
  type Roll,
} from '@filmfile/contracts/rolls';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
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
  const ifMatches: (string | null)[] = [];
  let nextId = 100;
  // The roll's version, sent as its ETag, which changes whenever the roll does.
  let version = 1;
  const etag = () => `"v${String(version)}"`;
  const changed = () => {
    version += 1;
  };
  const newId = () => `01JC8Z7K3M0000000000000${String((nextId += 1))}`;

  async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    if (request.method === 'GET' && url.pathname === `/api/rolls/${rollId}`) {
      const roll: Roll = { id: rollId, roll: '2026-014', frames };
      return Response.json(roll, { headers: { ETag: etag() } });
    }
    if (request.method === 'PATCH') {
      const ifMatch = request.headers.get('If-Match');
      ifMatches.push(ifMatch);
      if (ifMatch === null) {
        return Response.json({ error: 'no If-Match' }, { status: 428 });
      }
      if (ifMatch !== etag()) {
        return Response.json({ error: 'changed' }, { status: 409 });
      }
      const body: unknown = await request.json();
      if (url.pathname.endsWith('/frames')) {
        const { numbers } = updateFrameNumbersRequest.parse(body);
        for (const { frameId, number } of numbers) {
          const index = frames.findIndex((f) => f.id === frameId);
          const current = frames[index];
          if (current !== undefined) {
            frames[index] = { ...current, number };
          }
        }
        changed();
        const roll: Roll = { id: rollId, roll: '2026-014', frames };
        return Response.json(roll, { headers: { ETag: etag() } });
      }
      const number =
        typeof body === 'object' &&
        body !== null &&
        'number' in body &&
        typeof body.number === 'string'
          ? body.number
          : null;
      const index = frames.findIndex((f) => url.pathname.endsWith(f.id));
      const current = frames[index];
      if (current === undefined) {
        return Response.json({ error: 'not found' }, { status: 404 });
      }
      const updated: Frame = { ...current, number };
      frames[index] = updated;
      changed();
      return Response.json(updated, { headers: { ETag: etag() } });
    }
    if (request.method === 'POST' && url.pathname.endsWith('/frames')) {
      const body: unknown = await request.json();
      const number =
        typeof body === 'object' && body !== null && 'number' in body
          ? String(body.number)
          : null;
      const frame: Frame = { id: newId(), number, versions: [] };
      frames.push(frame);
      changed();
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
      changed();
      return Response.json(version, { status: 201 });
    }
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  return { answer, requests, ifMatches, frames, changed };
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
  // On a roll with frames, the drop zone opens from Add scans.
  if (screen.queryByLabelText('Choose lab scans') === null) {
    fireEvent.click(screen.getByRole('button', { name: 'Add scans' }));
  }
  fireEvent.change(screen.getByLabelText('Choose lab scans'), {
    target: { files },
  });
}

test('heads the page with the roll number and how many frames it has', async () => {
  renderPage(
    fakeRollService([
      aFrameWithScan('1', '12340001.jpg'),
      aFrameWithScan('2', '12340002.jpg'),
    ]),
  );

  expect(
    await screen.findByRole('heading', { name: 'Roll 2026-014' }),
  ).toBeDefined();
  expect(screen.getByText('2 frames')).toBeDefined();
});

describe('adding scans', () => {
  test('opens the drop zone from Add scans on a roll with frames', async () => {
    renderPage(fakeRollService([aFrameWithScan('1', '12340001.jpg')]));
    const addScans = await screen.findByRole('button', { name: 'Add scans' });
    expect(screen.queryByLabelText('Choose lab scans')).toBeNull();
    expect(addScans.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(addScans);

    expect(screen.getByLabelText('Choose lab scans')).toBeDefined();
    expect(addScans.getAttribute('aria-expanded')).toBe('true');
  });

  test('shows the drop zone straight away on a roll with no frames', async () => {
    renderPage(fakeRollService());

    expect(await screen.findByLabelText('Choose lab scans')).toBeDefined();
  });
});

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
  expect(screen.getByText('1').className).toBe('frame-number');
  const noNumber = screen.getByLabelText('No number');
  expect(noNumber.textContent).toBe('—');
  expect(noNumber.className).toBe('frame-number none');
});

test('shows frames in frame order, or in scan order when chosen', async () => {
  renderPage(
    fakeRollService([
      aFrameWithScan('3', '12340001.jpg'),
      aFrameWithScan('1', '12340002.jpg'),
      aFrameWithScan('2', '12340003.jpg'),
    ]),
  );
  const order = async () =>
    (await screen.findAllByRole('img')).map((img) => img.getAttribute('alt'));

  expect(await order()).toEqual([
    '12340002.jpg',
    '12340003.jpg',
    '12340001.jpg',
  ]);
  expect(screen.getByLabelText<HTMLInputElement>('Frame order').checked).toBe(
    true,
  );

  fireEvent.click(screen.getByLabelText('Scan order'));

  expect(await order()).toEqual([
    '12340001.jpg',
    '12340002.jpg',
    '12340003.jpg',
  ]);
});

describe('editing a frame number', () => {
  function numberButton(name: string) {
    return screen.findByRole('button', { name });
  }

  function typeNumber(value: string, key = 'Enter') {
    const input = screen.getByLabelText('Frame number');
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key });
  }

  test('saves a new number on Enter, sending the roll’s ETag', async () => {
    const service = fakeRollService([aFrameWithScan('1', '12340001.jpg')]);
    renderPage(service);

    fireEvent.click(await numberButton('Change frame number 1'));
    typeNumber('12A');

    expect(await numberButton('Change frame number 12A')).toBeDefined();
    expect(service.frames[0]?.number).toBe('12A');
    expect(service.ifMatches).toEqual(['"v1"']);
  });

  test('clears the number when it is emptied', async () => {
    const service = fakeRollService([aFrameWithScan('1', '12340001.jpg')]);
    renderPage(service);

    fireEvent.click(await numberButton('Change frame number 1'));
    typeNumber('');

    expect(await numberButton('Set a frame number')).toBeDefined();
    expect(service.frames[0]?.number).toBeNull();
  });

  test('changes nothing on Esc', async () => {
    const service = fakeRollService([aFrameWithScan('1', '12340001.jpg')]);
    renderPage(service);

    fireEvent.click(await numberButton('Change frame number 1'));
    typeNumber('7', 'Escape');

    expect(await numberButton('Change frame number 1')).toBeDefined();
    expect(service.ifMatches).toEqual([]);
  });

  test('takes at most 9 characters', async () => {
    renderPage(fakeRollService([aFrameWithScan('1', '12340001.jpg')]));

    fireEvent.click(await numberButton('Change frame number 1'));

    expect(
      screen.getByLabelText('Frame number').getAttribute('maxlength'),
    ).toBe('9');
  });

  test('refuses to overwrite a roll changed since the page loaded, and offers a reload', async () => {
    const service = fakeRollService([aFrameWithScan('1', '12340001.jpg')]);
    renderPage(service);
    fireEvent.click(await numberButton('Change frame number 1'));
    // Someone else changes the roll, e.g. in another tab.
    service.changed();

    typeNumber('2');

    expect(
      await screen.findByText('This roll changed since you opened it.'),
    ).toBeDefined();
    expect(service.frames[0]?.number).toBe('1');
    expect(screen.getByLabelText<HTMLInputElement>('Frame number').value).toBe(
      '2',
    );
  });

  test('saves again after a reload, against the roll as it is now', async () => {
    const service = fakeRollService([aFrameWithScan('1', '12340001.jpg')]);
    renderPage(service);
    fireEvent.click(await numberButton('Change frame number 1'));
    service.changed();
    typeNumber('2');
    await screen.findByText('This roll changed since you opened it.');

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => {
      expect(
        screen.queryByText('This roll changed since you opened it.'),
      ).toBeNull();
    });
    typeNumber('2');

    expect(await numberButton('Change frame number 2')).toBeDefined();
    expect(service.ifMatches).toEqual(['"v1"', '"v2"']);
  });

  test('says so and stays open when a save fails', async () => {
    renderPage({
      answer: (request) =>
        Promise.resolve(
          request.method === 'PATCH'
            ? new Response('', { status: 500 })
            : Response.json(
                {
                  id: rollId,
                  roll: '2026-014',
                  frames: [aFrameWithScan('1', '12340001.jpg')],
                },
                { headers: { ETag: '"v1"' } },
              ),
        ),
    });

    fireEvent.click(await numberButton('Change frame number 1'));
    typeNumber('2');

    expect(await screen.findByText("Couldn't save the number.")).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>('Frame number').value).toBe(
      '2',
    );
  });
});

describe('renumbering', () => {
  /** The numbers under the thumbnails, in the order shown. */
  function captions(): (string | null)[] {
    return Array.from(
      document.querySelectorAll('.contact-sheet .frame-number'),
      (caption) => caption.textContent,
    );
  }

  function changed(): (string | null)[] {
    return Array.from(
      document.querySelectorAll('.contact-sheet .frame-number.changed'),
      (caption) => caption.textContent,
    );
  }

  /** Fills in "[from] scan is frame [number], counting [direction]". */
  function renumberSo(from: string, number: string, direction: string) {
    fireEvent.change(screen.getByLabelText('Which scan'), {
      target: { value: from },
    });
    fireEvent.change(
      screen.getByLabelText(`Frame number of the ${from} scan`),
      { target: { value: number } },
    );
    fireEvent.change(screen.getByLabelText('Counting'), {
      target: { value: direction },
    });
  }

  async function aTailToHeadRoll() {
    // Uploaded in file name order, so numbered 1, 2, 3, though the film runs 3, 2, 1.
    const service = fakeRollService([
      aFrameWithScan('1', '12340001.jpg'),
      aFrameWithScan('2', '12340002.jpg'),
      aFrameWithScan('3', '12340003.jpg'),
    ]);
    renderPage(service);
    fireEvent.click(await screen.findByRole('button', { name: 'Renumber…' }));
    return service;
  }

  test('previews the numbers in scan order, highlighting the ones that change', async () => {
    const service = await aTailToHeadRoll();

    renumberSo('first', '3', 'down');

    expect(captions()).toEqual(['3', '2', '1']);
    expect(changed()).toEqual(['3', '1']);
    expect(service.ifMatches).toEqual([]);
  });

  test('shows the old number struck through beside each one that changes, and how many change', async () => {
    await aTailToHeadRoll();

    renumberSo('first', '3', 'down');

    const struckThrough = Array.from(
      document.querySelectorAll('.contact-sheet del'),
      (previous) => previous.textContent,
    );
    expect(struckThrough).toEqual(['previously 1', 'previously 3']);
    expect(screen.getByText('2 numbers will change')).toBeDefined();

    renumberSo('first', '1', 'up');

    expect(screen.getByText('No numbers will change')).toBeDefined();
  });

  test('numbers back from the last scan when that is the one chosen', async () => {
    await aTailToHeadRoll();

    renumberSo('last', '1', 'down');

    expect(captions()).toEqual(['3', '2', '1']);
  });

  test('starts from the first scan’s number, counting up', async () => {
    await aTailToHeadRoll();

    expect(screen.getByLabelText<HTMLSelectElement>('Which scan').value).toBe(
      'first',
    );
    expect(
      screen.getByLabelText<HTMLInputElement>('Frame number of the first scan')
        .value,
    ).toBe('1');
    expect(screen.getByLabelText<HTMLSelectElement>('Counting').value).toBe(
      'up',
    );
    expect(changed()).toEqual([]);
  });

  test('can count below zero', async () => {
    await aTailToHeadRoll();

    renumberSo('first', '1', 'down');

    expect(captions()).toEqual(['1', '0', '-1']);
  });

  test('asks for a whole number, showing the current numbers meanwhile', async () => {
    await aTailToHeadRoll();

    renumberSo('first', '12A', 'up');

    expect(
      screen.getByText('Enter a whole number, like 1 or 36.'),
    ).toBeDefined();
    expect(captions()).toEqual(['1', '2', '3']);
  });

  test('saves the numbers in one update, sending the roll’s ETag', async () => {
    const service = await aTailToHeadRoll();
    renumberSo('last', '1', 'down');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('button', { name: 'Change frame number 3' }),
    ).toBeDefined();
    expect(screen.queryByLabelText('Which scan')).toBeNull();
    expect(service.frames.map((f) => f.number)).toEqual(['3', '2', '1']);
    expect(service.ifMatches).toEqual(['"v1"']);
  });

  test('can’t save until the number is a whole number', async () => {
    await aTailToHeadRoll();

    renumberSo('first', '12A', 'up');

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled,
    ).toBe(true);
  });

  test('refuses to overwrite a roll changed since the page loaded, keeping the settings', async () => {
    const service = await aTailToHeadRoll();
    renumberSo('last', '1', 'down');
    service.changed();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('This roll changed since you opened it.'),
    ).toBeDefined();
    expect(service.frames.map((f) => f.number)).toEqual(['1', '2', '3']);
    expect(screen.getByLabelText<HTMLSelectElement>('Which scan').value).toBe(
      'last',
    );
  });

  test('says so when the numbers could not be saved', async () => {
    renderPage({
      answer: (request) =>
        Promise.resolve(
          request.method === 'PATCH'
            ? new Response('', { status: 500 })
            : Response.json(
                {
                  id: rollId,
                  roll: '2026-014',
                  frames: [aFrameWithScan('1', '12340001.jpg')],
                },
                { headers: { ETag: '"v1"' } },
              ),
        ),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Renumber…' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText("Couldn't save the numbers.")).toBeDefined();
    expect(screen.getByLabelText('Which scan')).toBeDefined();
  });

  test('goes back to the roll as it was on Cancel, saving nothing', async () => {
    const service = await aTailToHeadRoll();
    renumberSo('first', '9', 'up');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Which scan')).toBeNull();
    expect(
      await screen.findByRole('button', { name: 'Change frame number 1' }),
    ).toBeDefined();
    expect(service.ifMatches).toEqual([]);
  });
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
