// @vitest-environment happy-dom
import type { FilmStock } from '@filmfile/contracts/equipment';
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
import {
  aRoll,
  fakeArchive,
  type FakeArchive,
} from '../testing/fake-archive.ts';
import { NewRollPage } from './new-roll-page.tsx';

const rollId = '01JC8Z7K3M0000000000000001';

beforeEach(() => {
  window.history.replaceState(null, '', '/rolls/new');
});

afterEach(cleanup);

function renderPage(archive: FakeArchive) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewRollPage api={archive.api} />
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

test('asks for the roll number, name, notes and date shot', () => {
  renderPage(fakeArchive());

  expect(screen.getByRole('heading', { name: 'New roll' })).toBeDefined();
  for (const label of [
    'Roll number',
    'Name',
    'Notes',
    'Year',
    'Month',
    'Day',
    'Time',
  ]) {
    expect(field(label)).toBeDefined();
  }
});

test('creates the roll with its details, then opens it', async () => {
  const service = fakeArchive();
  renderPage(service);

  fill('Roll number', '2026-014');
  fill('Name', 'Iceland, first day');
  fill('Notes', 'Jökulsárlón at dawn.');
  fill('Month', '09');
  fill('Day', '14');
  fill('Time', '06:30');
  create();

  await waitToOpen(rollId);
  expect(service.created).toEqual([
    {
      roll: '2026-014',
      name: 'Iceland, first day',
      notes: 'Jökulsárlón at dawn.',
      shot: '2026-09-14T06:30',
    },
  ]);
});

describe('the camera', () => {
  const nikonFe = { slug: 'nikon-fe', make: 'Nikon', model: 'FE' };

  test('is picked from the archive’s cameras', async () => {
    const service = fakeArchive({ cameras: [nikonFe] });
    renderPage(service);
    await screen.findByRole('option', { name: 'Nikon FE' });

    fill('Roll number', '2026-014');
    choose('Camera', 'Nikon FE');
    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', camera: 'nikon-fe' },
    ]);
  });

  test('can be a new one, added to the archive with its make and model', async () => {
    const service = fakeArchive();
    renderPage(service);

    fill('Roll number', '2026-014');
    choose('Camera', 'Add new…');
    fill('Make', 'Pentax');
    fill('Model', 'K1000');
    create();

    await waitToOpen(rollId);
    expect(service.cameras).toEqual([
      { slug: 'pentax-k1000', make: 'Pentax', model: 'K1000' },
    ]);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', camera: 'pentax-k1000' },
    ]);
  });

  test('asks for a new one’s make and model', async () => {
    const service = fakeArchive();
    renderPage(service);

    fill('Roll number', '2026-014');
    choose('Camera', 'Add new…');
    fill('Make', 'Pentax');
    create();

    expect((await screen.findByRole('alert')).textContent).toBe(
      "Enter the new camera's model, like FE.",
    );
    expect(service.created).toEqual([]);
  });

  test('is the one the archive has when a new one is the same, added since the page loaded', async () => {
    const service = fakeArchive();
    renderPage(service);
    await waitFor(() => {
      expect(service.gets('/api/equipment/cameras')).toBe(1);
    });
    service.cameras.push(nikonFe);

    fill('Roll number', '2026-014');
    choose('Camera', 'Add new…');
    fill('Make', 'nikon');
    fill('Model', 'FE');
    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', camera: 'nikon-fe' },
    ]);
  });

  test('can’t be a new one named so like another that they’d share a file', async () => {
    const service = fakeArchive({ cameras: [nikonFe] });
    renderPage(service);

    fill('Roll number', '2026-014');
    choose('Camera', 'Add new…');
    fill('Make', 'Nikon');
    fill('Model', '-FE');
    create();

    expect((await screen.findByRole('alert')).textContent).toBe(
      "There's already a camera with a name like Nikon -FE. Choose it from the list.",
    );
    expect(service.created).toEqual([]);
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
    renderPage(fakeArchive({ films: [portra] }));

    await screen.findByRole('option', { name: 'Kodak Portra 400' });
    expect(
      within(field('Film stock'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['—', 'Kodak Portra 400', 'Add new…']);
  });

  test('is picked from the archive’s film stocks', async () => {
    const service = fakeArchive({ films: [portra] });
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
    const service = fakeArchive();
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
    const service = fakeArchive();
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
    const service = fakeArchive();
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

describe('the event', () => {
  test('is picked from the archive’s events', async () => {
    const service = fakeArchive({
      events: [{ slug: 'iceland-2026', name: 'Iceland 2026', date: null }],
    });
    renderPage(service);
    await screen.findByRole('option', { name: 'Iceland 2026' });

    fill('Roll number', '2026-014');
    choose('Event', 'Iceland 2026');
    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', event: 'iceland-2026' },
    ]);
  });

  test('can be a new one, added to the archive by name', async () => {
    const service = fakeArchive();
    renderPage(service);

    fill('Roll number', '2026-014');
    choose('Event', 'Add new…');
    const newEvent = screen.getByRole('group', { name: 'New event' });
    fireEvent.change(
      within(newEvent).getByLabelText('Name', { exact: false }),
      {
        target: { value: 'Westfjords' },
      },
    );
    create();

    await waitToOpen(rollId);
    expect(service.events).toEqual([
      { slug: 'westfjords', name: 'Westfjords', date: null },
    ]);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', event: 'westfjords' },
    ]);
  });

  test('asks for a new one’s name', async () => {
    const service = fakeArchive();
    renderPage(service);

    fill('Roll number', '2026-014');
    choose('Event', 'Add new…');
    create();

    expect((await screen.findByRole('alert')).textContent).toBe(
      "Enter the new event's name, like Iceland 2026.",
    );
    expect(service.created).toEqual([]);
  });
});

describe('the lens', () => {
  test('can be a new one, added to the archive with its focal length and aperture', async () => {
    const service = fakeArchive();
    renderPage(service);

    fill('Roll number', '2026-014');
    choose('Lens', 'Add new…');
    const newLens = screen.getByRole('group', { name: 'New lens' });
    fireEvent.change(within(newLens).getByLabelText('Make', { exact: false }), {
      target: { value: 'Nikon' },
    });
    fireEvent.change(within(newLens).getByLabelText('Name', { exact: false }), {
      target: { value: 'Nikkor AI-S' },
    });
    fill('Focal length', '50');
    fill('Max aperture', '1.8');
    create();

    await waitToOpen(rollId);
    expect(service.lenses).toEqual([
      {
        slug: 'nikon-nikkor-ai-s-50mm-f-1-8',
        make: 'Nikon',
        name: 'Nikkor AI-S',
        focalLength: 50,
        maxAperture: 1.8,
      },
    ]);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', lens: 'nikon-nikkor-ai-s-50mm-f-1-8' },
    ]);
  });

  test('is picked from the archive’s lenses', async () => {
    const service = fakeArchive({
      lenses: [
        {
          slug: 'zeiss-planar-80mm-f-2-8',
          make: 'Zeiss',
          name: 'Planar',
          focalLength: 80,
          maxAperture: 2.8,
        },
      ],
    });
    renderPage(service);
    await screen.findByRole('option', { name: 'Zeiss Planar 80mm f/2.8' });

    fill('Roll number', '2026-014');
    choose('Lens', 'Zeiss Planar 80mm f/2.8');
    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([
      { roll: '2026-014', shot: '2026', lens: 'zeiss-planar-80mm-f-2-8' },
    ]);
  });

  test('asks for an aperture that is an f-number', async () => {
    const service = fakeArchive();
    renderPage(service);

    fill('Roll number', '2026-014');
    choose('Lens', 'Add new…');
    const newLens = screen.getByRole('group', { name: 'New lens' });
    fireEvent.change(within(newLens).getByLabelText('Make', { exact: false }), {
      target: { value: 'Nikon' },
    });
    fireEvent.change(within(newLens).getByLabelText('Name', { exact: false }), {
      target: { value: 'Nikkor' },
    });
    fill('Max aperture', 'f/1.8');
    create();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Enter the widest aperture as an f-number, like 1.8.',
    );
    expect(service.created).toEqual([]);
  });
});

describe('the date shot', () => {
  test('takes its year from the roll number, until the year is changed', () => {
    renderPage(fakeArchive());

    fill('Roll number', '2026-014');
    expect(field('Year').value).toBe('2026');

    fill('Year', '2025');
    fill('Roll number', '2024-001');
    expect(field('Year').value).toBe('2025');
  });

  test('offers the day once there is a month, and the time once there is a day', () => {
    renderPage(fakeArchive());
    const disabled = (label: string) => field(label).disabled;

    expect([disabled('Day'), disabled('Time')]).toEqual([true, true]);
    fill('Month', '09');
    expect([disabled('Day'), disabled('Time')]).toEqual([false, true]);
    fill('Day', '14');
    expect([disabled('Day'), disabled('Time')]).toEqual([false, false]);
  });

  test('can be just a year', async () => {
    const service = fakeArchive();
    renderPage(service);

    fill('Roll number', '2026-014');
    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([{ roll: '2026-014', shot: '2026' }]);
  });

  test('is needed: at least a year', () => {
    const service = fakeArchive();
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
    const service = fakeArchive();
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
  const service = fakeArchive();
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
  renderPage(fakeArchive());

  expect(field('Roll number').required).toBe(true);
  expect(field('Year').required).toBe(true);
  expect(field('Name').required).toBe(false);
});

test('asks for a roll number', () => {
  const service = fakeArchive();
  renderPage(service);

  create();

  expect(screen.getByText('Enter a roll number like 2026-014.')).toBeDefined();
  expect(service.created).toEqual([]);
});

test('says when the roll number is taken, and stays on the page', async () => {
  renderPage(fakeArchive({ rolls: [aRoll('2026-014')] }));

  fill('Roll number', '2026-014');
  create();

  expect(
    await screen.findByText('Roll 2026-014 already exists.'),
  ).toBeDefined();
  expect(window.location.pathname).toBe('/rolls/new');
});

test('goes back to the rolls on Cancel', () => {
  renderPage(fakeArchive());

  expect(
    screen.getByRole('link', { name: 'Cancel' }).getAttribute('href'),
  ).toBe('/');
});
