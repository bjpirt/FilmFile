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
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  aRoll,
  fakeArchive,
  setUpSettings,
  type FakeArchive,
} from '../testing/fake-archive.ts';
import { NewRollPage } from './new-roll-page.tsx';

const rollId = '01JC8Z7K3M0000000000000001';

beforeEach(() => {
  window.history.replaceState(null, '', '/rolls/new');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Today as the page sees it, with timers left alone. */
function today(date: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(date));
}

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

test('creates a roll with a freeform number', async () => {
  const service = fakeArchive();
  renderPage(service);

  fill('Roll number', '  BP/roll 1  ');
  fill('Year', '2025');
  create();

  await waitFor(() => {
    expect(service.created).toEqual([
      expect.objectContaining({ roll: 'BP/roll 1' }),
    ]);
  });
  await waitToOpen(rollId);
  expect(service.created).toEqual([
    expect.objectContaining({ roll: 'BP/roll 1' }),
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

  describe('a new one’s date', () => {
    function addingEvent(service: FakeArchive) {
      renderPage(service);
      fill('Roll number', '2026-014');
      choose('Event', 'Add new…');
      const form = screen.getByRole('group', { name: 'New event' });
      fireEvent.change(within(form).getByLabelText('Name', { exact: false }), {
        target: { value: 'Westfjords' },
      });
      return within(screen.getByRole('group', { name: 'Event date' }));
    }

    test('can be given with the name, a year or as precisely as a day, and is saved with the event', async () => {
      const service = fakeArchive();
      const date = addingEvent(service);

      fireEvent.change(date.getByLabelText('Year', { exact: false }), {
        target: { value: '2025' },
      });
      fireEvent.change(date.getByLabelText('Month'), {
        target: { value: '09' },
      });
      fireEvent.change(date.getByLabelText('Day'), { target: { value: '14' } });
      create();

      await waitToOpen(rollId);
      expect(service.events).toEqual([
        { slug: 'westfjords', name: 'Westfjords', date: '2025-09-14' },
      ]);
    });

    test('can be left out, which is the default', async () => {
      const service = fakeArchive();
      const date = addingEvent(service);

      expect(date.getByLabelText('Year', { exact: false })).toHaveProperty(
        'value',
        '',
      );
      create();

      await waitToOpen(rollId);
      expect(service.events).toEqual([
        { slug: 'westfjords', name: 'Westfjords', date: null },
      ]);
    });

    test('is a year of four digits when given', async () => {
      const service = fakeArchive();
      const date = addingEvent(service);
      fireEvent.change(date.getByLabelText('Year', { exact: false }), {
        target: { value: '25' },
      });

      create();

      expect(
        await screen.findByText(
          'Enter the event’s year as four digits, like 2026.',
        ),
      ).toBeDefined();
      expect(service.events).toEqual([]);
      expect(service.created).toEqual([]);
    });

    test('is refused if the day isn’t on the calendar, creating no roll', async () => {
      const service = fakeArchive();
      const date = addingEvent(service);
      fireEvent.change(date.getByLabelText('Year', { exact: false }), {
        target: { value: '2025' },
      });
      fireEvent.change(date.getByLabelText('Month'), {
        target: { value: '02' },
      });
      fireEvent.change(date.getByLabelText('Day'), { target: { value: '30' } });

      create();

      expect(
        await screen.findByText(
          "The event's date doesn't exist. Check the day and month.",
        ),
      ).toBeDefined();
      expect(service.events).toEqual([]);
      expect(service.created).toEqual([]);
    });
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
  expect(field('Roll number').maxLength).toBe(100);
  expect(field('Year').required).toBe(true);
  expect(field('Name').required).toBe(false);
});

test('asks for a roll number when it is emptied', async () => {
  const service = fakeArchive();
  renderPage(service);
  await waitFor(() => {
    expect(field('Roll number').value).not.toBe('');
  });

  fill('Roll number', '');
  create();

  expect(screen.getByText('Enter a roll number.')).toBeDefined();
  expect(service.created).toEqual([]);
});

describe('the roll number', () => {
  beforeEach(() => {
    today('2026-07-01T12:00:00Z');
  });

  test('opens as this year’s next free number, with the year to match', async () => {
    renderPage(
      fakeArchive({
        rolls: [aRoll('2026-014'), aRoll('2026-003'), aRoll('2025-031')],
      }),
    );

    await waitFor(() => {
      expect(field('Roll number').value).toBe('2026-015');
    });
    expect(field('Year').value).toBe('2026');
  });

  test('starts a year with no rolls at 001', async () => {
    renderPage(fakeArchive({ rolls: [aRoll('2025-031')] }));

    await waitFor(() => {
      expect(field('Roll number').value).toBe('2026-001');
    });
  });

  test('counts a number an unreadable roll’s folder is named for', async () => {
    renderPage(
      fakeArchive({
        rolls: [aRoll('2026-014')],
        unreadable: [{ folder: '2026-020-ABCD1234', problem: 'not JSON' }],
      }),
    );

    await waitFor(() => {
      expect(field('Roll number').value).toBe('2026-021');
    });
  });

  test('creates the roll with the number it opened with', async () => {
    const service = fakeArchive({ rolls: [aRoll('2026-014')] });
    renderPage(service);
    await waitFor(() => {
      expect(field('Roll number').value).toBe('2026-015');
    });

    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([{ roll: '2026-015', shot: '2026' }]);
  });

  test('follows the year when it is changed by hand, as long as the number is not typed over', async () => {
    renderPage(fakeArchive({ rolls: [aRoll('2026-014'), aRoll('2025-031')] }));
    await waitFor(() => {
      expect(field('Roll number').value).toBe('2026-015');
    });

    fill('Year', '2025');
    await waitFor(() => {
      expect(field('Roll number').value).toBe('2025-032');
    });

    // Half a year changes nothing.
    fill('Year', '202');
    expect(field('Roll number').value).toBe('2025-032');
  });

  test('keeps a number typed by hand, whatever the year becomes', async () => {
    renderPage(fakeArchive({ rolls: [aRoll('2025-031')] }));
    await waitFor(() => {
      expect(field('Roll number').value).toBe('2026-001');
    });

    fill('Roll number', '2026-099');
    fill('Year', '2025');

    expect(field('Roll number').value).toBe('2026-099');
  });

  test('doesn’t replace a number typed before the suggestion arrives', async () => {
    const service = fakeArchive({ rolls: [aRoll('2026-014')] });
    renderPage(service);

    fill('Roll number', '2026-500');
    await waitFor(() => {
      expect(service.requests).toContain('GET /api/rolls');
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(field('Roll number').value).toBe('2026-500');
  });

  test('keeps the year following a typed number until the year is changed', async () => {
    renderPage(fakeArchive());
    await waitFor(() => {
      expect(field('Roll number').value).toBe('2026-001');
    });

    fill('Roll number', '2024-007');

    expect(field('Year').value).toBe('2024');
  });
});

describe('the roll number with a custom pattern (D88)', () => {
  beforeEach(() => {
    today('2026-07-01T12:00:00Z');
  });

  function withPattern(
    rollNumberPattern: string,
    contents: Parameters<typeof fakeArchive>[0] = {},
  ) {
    return fakeArchive({
      ...contents,
      settings: { ...setUpSettings, rollNumberPattern },
    });
  }

  /** Waits for the page to have read the pattern, which it asks for as it opens. */
  async function patternRead(service: FakeArchive) {
    await waitFor(() => {
      expect(service.requests).toContain('GET /api/settings');
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  test('opens as the next free number of the pattern', async () => {
    renderPage(
      withPattern('BP-{year}-{n:2}', {
        rolls: [aRoll('BP-2026-07'), aRoll('BP-2025-30')],
      }),
    );

    await waitFor(() => {
      expect(field('Roll number').value).toBe('BP-2026-08');
    });
  });

  test('follows the month, counting each month on its own, until the number is typed over', async () => {
    renderPage(
      withPattern('{year}{month}-{n:2}', {
        rolls: [aRoll('202609-04', { shot: '2026-09' })],
      }),
    );
    // Without a month there is nothing to suggest yet.
    await waitFor(() => {
      expect(field('Roll number').value).toBe('');
    });

    fill('Month', '09');
    await waitFor(() => {
      expect(field('Roll number').value).toBe('202609-05');
    });
    fill('Month', '10');
    await waitFor(() => {
      expect(field('Roll number').value).toBe('202610-01');
    });

    fill('Roll number', 'mine');
    fill('Month', '11');
    expect(field('Roll number').value).toBe('mine');
  });

  test('asks for the month the pattern uses, creating nothing without it', async () => {
    const service = withPattern('{year}{month}-{n:2}');
    renderPage(service);
    await patternRead(service);
    fill('Roll number', 'mine');

    create();

    expect(
      await screen.findByText(
        'Add a shot month: your roll number pattern uses it.',
      ),
    ).toBeDefined();
    expect(service.created).toEqual([]);
  });

  test('numbers by the chosen event, and asks for one', async () => {
    const service = withPattern('{event}-{n:2}', {
      events: [{ slug: 'iceland-2026', name: 'Iceland 2026', date: null }],
      rolls: [aRoll('iceland-2026-03')],
    });
    renderPage(service);
    await screen.findByRole('option', { name: 'Iceland 2026' });

    create();
    expect(
      await screen.findByText(
        'Add an event: your roll number pattern uses it.',
      ),
    ).toBeDefined();

    choose('Event', 'Iceland 2026');
    await waitFor(() => {
      expect(field('Roll number').value).toBe('iceland-2026-04');
    });
    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([
      { roll: 'iceland-2026-04', shot: '2026', event: 'iceland-2026' },
    ]);
  });

  test('numbers a new event once it is created, from its slug', async () => {
    const service = withPattern('{event}-{n:2}');
    renderPage(service);
    await patternRead(service);

    choose('Event', 'Add new…');
    const newEvent = screen.getByRole('group', { name: 'New event' });
    fireEvent.change(
      within(newEvent).getByLabelText('Name', { exact: false }),
      { target: { value: 'Westfjords' } },
    );
    create();

    await waitToOpen(rollId);
    expect(service.created).toEqual([
      { roll: 'westfjords-01', shot: '2026', event: 'westfjords' },
    ]);
  });
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
