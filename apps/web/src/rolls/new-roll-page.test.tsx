// @vitest-environment happy-dom
import { createApiClient } from '@filmfile/contracts/client';
import {
  createCameraRequest,
  createFilmStockRequest,
  type Camera,
  type FilmStock,
} from '@filmfile/contracts/equipment';
import { createRollRequest, type Roll } from '@filmfile/contracts/rolls';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { NewRollPage } from './new-roll-page.tsx';

const rollId = '01JC8Z7K3M0000000000000001';

beforeEach(() => {
  window.history.replaceState(null, '', '/rolls/new');
});

afterEach(cleanup);

/** Answers like the backend: creates the roll, its frames and their scans. */
function fakeService({
  taken = [],
  cameras = [],
  films = [],
}: { taken?: string[]; cameras?: Camera[]; films?: FilmStock[] } = {}) {
  const created: unknown[] = [];
  const uploads: string[] = [];
  let cameraLists = 0;
  let nextId = 100;
  async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/equipment/cameras') {
      if (request.method === 'GET') {
        cameraLists += 1;
        return Response.json({ cameras });
      }
      const { name } = createCameraRequest.parse(await request.json());
      const camera = { slug: name.toLowerCase().replace(/\W+/g, '-'), name };
      if (cameras.some((c) => c.slug === camera.slug)) {
        return Response.json({ error: 'exists' }, { status: 409 });
      }
      cameras.push(camera);
      return Response.json(camera, { status: 201 });
    }
    if (url.pathname === '/api/equipment/films') {
      if (request.method === 'GET') {
        return Response.json({ films });
      }
      const body = createFilmStockRequest.parse(await request.json());
      const film: FilmStock = {
        slug: [body.make, body.name, body.iso ?? '']
          .join(' ')
          .trim()
          .toLowerCase()
          .replace(/\W+/g, '-'),
        make: body.make,
        name: body.name,
        iso: body.iso ?? null,
        type: body.type ?? null,
        format: body.format ?? null,
      };
      films.push(film);
      return Response.json(film, { status: 201 });
    }
    if (url.pathname === '/api/rolls') {
      const body = createRollRequest.parse(await request.json());
      created.push(body);
      if (taken.includes(body.roll)) {
        return Response.json({ error: 'taken' }, { status: 409 });
      }
      const roll: Roll = {
        id: rollId,
        roll: body.roll,
        name: body.name ?? null,
        description: body.description ?? null,
        shot: body.shot ?? null,
        camera: body.camera ?? null,
        film: body.film ?? null,
        frames: [],
      };
      return Response.json(roll, { status: 201 });
    }
    if (url.pathname.endsWith('/frames')) {
      nextId += 1;
      return Response.json(
        {
          id: `01JC8Z7K3M0000000000000${String(nextId)}`,
          number: null,
          versions: [],
        },
        { status: 201 },
      );
    }
    uploads.push(url.searchParams.get('file') ?? '');
    return Response.json(
      {
        id: '01JC8Z7K3M0000000000000999',
        file: 'x',
        sha256: String(uploads.length).padStart(64, '0'),
        bytes: 1,
        width: 1,
        height: 1,
        added: '2026-11-02T12:00:00.000Z',
      },
      { status: 201 },
    );
  }
  return {
    answer,
    created,
    uploads,
    cameras,
    films,
    cameraLists: () => cameraLists,
  };
}

function renderPage(service: { answer: (r: Request) => Promise<Response> }) {
  const api = createApiClient({
    baseUrl: 'http://localhost',
    fetch: service.answer,
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewRollPage api={api} />
    </QueryClientProvider>,
  );
}

/** A field by its label, ignoring the required marker, as a screen reader names it. */
function field(label: string): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>(label, {
    normalizer: (text) => text.replace('*', '').trim(),
  });
}

function fill(label: string, value: string) {
  fireEvent.change(field(label), { target: { value } });
}

/** The new film stock's name; the roll has a Name field too. */
function fillNewStockName(value: string) {
  const details = screen.getByRole('group', { name: 'New film stock' });
  fireEvent.change(
    within(details).getByLabelText('Name', {
      normalizer: (text) => text.replace('*', '').trim(),
    }),
    { target: { value } },
  );
}

/** Chooses an option in a dropdown by the text it shows. */
function choose(label: string, option: string) {
  const select = field(label);
  const chosen = within(select).getByRole<HTMLOptionElement>('option', {
    name: option,
  });
  fireEvent.change(select, { target: { value: chosen.value } });
}

function create() {
  fireEvent.click(screen.getByRole('button', { name: 'Create roll' }));
}

async function waitToOpen(id: string) {
  await new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (window.location.pathname === `/rolls/${id}`) {
        resolve();
      } else if (Date.now() - started > 1000) {
        reject(new Error(`still at ${window.location.pathname}`));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

test('asks for the roll number, name, description and date shot', () => {
  renderPage(fakeService());

  expect(screen.getByRole('heading', { name: 'New roll' })).toBeDefined();
  for (const label of [
    'Roll number',
    'Name',
    'Description',
    'Year',
    'Month',
    'Day',
    'Time',
  ]) {
    expect(field(label)).toBeDefined();
  }
});

test('creates the roll with its details, then opens it', async () => {
  const service = fakeService();
  renderPage(service);

  fill('Roll number', '2026-014');
  fill('Name', 'Iceland, first day');
  fill('Description', 'Jökulsárlón at dawn.');
  fill('Month', '09');
  fill('Day', '14');
  fill('Time', '06:30');
  create();

  await waitToOpen(rollId);
  expect(service.created).toEqual([
    {
      roll: '2026-014',
      name: 'Iceland, first day',
      description: 'Jökulsárlón at dawn.',
      shot: '2026-09-14T06:30',
    },
  ]);
});

describe('the camera', () => {
  test('is picked from the archive’s cameras by name', async () => {
    const service = fakeService({
      cameras: [{ slug: 'nikon-fe', name: 'Nikon FE' }],
    });
    renderPage(service);

    fill('Roll number', '2026-014');
    fill('Camera', 'Nikon FE');
    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', camera: 'nikon-fe' },
    ]);
  });

  test('is the one added elsewhere since the page loaded, if it has the name typed', async () => {
    const service = fakeService();
    renderPage(service);
    await waitFor(() => {
      expect(service.cameraLists()).toBe(1);
    });
    service.cameras.push({ slug: 'nikon-fe', name: 'Nikon FE' });

    fill('Roll number', '2026-014');
    fill('Camera', 'Nikon FE');
    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', camera: 'nikon-fe' },
    ]);
  });

  test('can’t be a new one named so like another that they’d share a file', async () => {
    const service = fakeService({
      cameras: [{ slug: 'nikon-fe', name: 'Nikon FE' }],
    });
    renderPage(service);

    fill('Roll number', '2026-014');
    fill('Camera', 'Nikon-FE');
    create();

    expect((await screen.findByRole('alert')).textContent).toBe(
      "There's already a camera with a name like Nikon-FE. Choose it from the list.",
    );
    expect(service.created).toEqual([]);
  });

  test('is added to the archive when it’s new', async () => {
    const service = fakeService();
    renderPage(service);

    fill('Roll number', '2026-014');
    fill('Camera', 'Pentax K1000');
    create();

    await waitToOpen(rollId);
    expect(service.cameras).toEqual([
      { slug: 'pentax-k1000', name: 'Pentax K1000' },
    ]);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', camera: 'pentax-k1000' },
    ]);
  });
});

describe('the film stock', () => {
  const portra: FilmStock = {
    slug: 'kodak-portra-400',
    make: 'Kodak',
    name: 'Portra',
    iso: 400,
    type: 'colour-negative',
    format: '35mm',
  };

  test('offers the archive’s film stocks, then Add new…', async () => {
    renderPage(fakeService({ films: [portra] }));

    await screen.findByRole('option', { name: 'Kodak Portra 400' });
    expect(
      within(field('Film stock'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['—', 'Kodak Portra 400', 'Add new…']);
  });

  test('is picked from the archive’s film stocks', async () => {
    const service = fakeService({ films: [portra] });
    renderPage(service);
    await screen.findByRole('option', { name: 'Kodak Portra 400' });

    fill('Roll number', '2026-014');
    choose('Film stock', 'Kodak Portra 400');
    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', film: 'kodak-portra-400' },
    ]);
  });

  test('can be a new one, added to the archive with the details given', async () => {
    const service = fakeService();
    renderPage(service);

    fill('Roll number', '2026-014');
    choose('Film stock', 'Add new…');
    fill('Make', 'Ilford');
    fillNewStockName('HP5 Plus');
    fill('ISO', '400');
    choose('Type', 'Black and white');
    choose('Format', '120');
    create();

    await waitToOpen(rollId);
    expect(service.films).toEqual([
      {
        slug: 'ilford-hp5-plus-400',
        make: 'Ilford',
        name: 'HP5 Plus',
        iso: 400,
        type: 'black-and-white',
        format: '120',
      },
    ]);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', film: 'ilford-hp5-plus-400' },
    ]);
  });

  test('asks for a new one’s make and name', async () => {
    const service = fakeService();
    renderPage(service);

    fill('Roll number', '2026-014');
    choose('Film stock', 'Add new…');
    create();

    expect((await screen.findByRole('alert')).textContent).toBe(
      "Enter the new film stock's make, like Kodak.",
    );
    expect(service.created).toEqual([]);
  });

  test('asks for a whole-number ISO for a new one', async () => {
    const service = fakeService();
    renderPage(service);

    fill('Roll number', '2026-014');
    choose('Film stock', 'Add new…');
    fill('Make', 'Kodak');
    fillNewStockName('Portra');
    fill('ISO', '400 ASA');
    create();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Enter the ISO as a whole number, like 400.',
    );
    expect(service.created).toEqual([]);
  });
});

describe('the date shot', () => {
  test('takes its year from the roll number, until the year is changed', () => {
    renderPage(fakeService());

    fill('Roll number', '2026-014');
    expect(field('Year').value).toBe('2026');

    fill('Year', '2025');
    fill('Roll number', '2024-001');
    expect(field('Year').value).toBe('2025');
  });

  test('offers the day once there is a month, and the time once there is a day', () => {
    renderPage(fakeService());
    const disabled = (label: string) => field(label).disabled;

    expect([disabled('Day'), disabled('Time')]).toEqual([true, true]);
    fill('Month', '09');
    expect([disabled('Day'), disabled('Time')]).toEqual([false, true]);
    fill('Day', '14');
    expect([disabled('Day'), disabled('Time')]).toEqual([false, false]);
  });

  test('can be just a year', async () => {
    const service = fakeService();
    renderPage(service);

    fill('Roll number', '2026-014');
    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([{ roll: '2026-014', shot: '2026' }]);
  });

  test('is needed: at least a year', () => {
    const service = fakeService();
    renderPage(service);

    fill('Roll number', '2026-014');
    fill('Year', '');
    create();

    expect(
      screen.getByText('Enter the year as four digits, like 2026.'),
    ).toBeDefined();
    expect(service.created).toEqual([]);
  });

  test('asks for a four-digit year', () => {
    const service = fakeService();
    renderPage(service);

    fill('Roll number', '2026-014');
    fill('Year', '26');
    create();

    expect(
      screen.getByText('Enter the year as four digits, like 2026.'),
    ).toBeDefined();
    expect(service.created).toEqual([]);
  });
});

test('adds the scans chosen, after creating the roll', async () => {
  const service = fakeService();
  renderPage(service);
  fill('Roll number', '2026-014');

  fireEvent.change(screen.getByLabelText('Choose scans'), {
    target: {
      files: [
        new File(['b'], '12340002.jpg', { type: 'image/jpeg' }),
        new File(['a'], '12340001.jpg', { type: 'image/jpeg' }),
      ],
    },
  });
  expect(screen.getByText('2 scans ready to add')).toBeDefined();
  create();

  await waitToOpen(rollId);
  expect(service.uploads).toEqual(['12340001.jpg', '12340002.jpg']);
});

test('marks the roll number and year as required', () => {
  renderPage(fakeService());

  expect(field('Roll number').required).toBe(true);
  expect(field('Year').required).toBe(true);
  expect(field('Name').required).toBe(false);
});

test('asks for a roll number', () => {
  const service = fakeService();
  renderPage(service);

  create();

  expect(screen.getByText('Enter a roll number like 2026-014.')).toBeDefined();
  expect(service.created).toEqual([]);
});

test('says when the roll number is taken, and stays on the page', async () => {
  renderPage(fakeService({ taken: ['2026-014'] }));

  fill('Roll number', '2026-014');
  create();

  expect(
    await screen.findByText('Roll 2026-014 already exists.'),
  ).toBeDefined();
  expect(window.location.pathname).toBe('/rolls/new');
});

test('goes back to the rolls on Cancel', () => {
  renderPage(fakeService());

  expect(
    screen.getByRole('link', { name: 'Cancel' }).getAttribute('href'),
  ).toBe('/');
});
