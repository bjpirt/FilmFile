// @vitest-environment happy-dom
import type { FilmStock, Lens } from '@filmfile/contracts/equipment';
import type { Event } from '@filmfile/contracts/events';
import type { Roll } from '@filmfile/contracts/rolls';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import {
  aRoll,
  fakeArchive,
  type FakeArchive,
} from '../testing/fake-archive.ts';
import { RollsPage } from './rolls-page.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

/** A roll with the given number of frames, none of them scanned. */
function aRollOf(roll: string, frames: number): Roll {
  return aRoll(roll, {
    frames: Array.from({ length: frames }, (_, i) => ({
      id: `01JC8Z7K3M00000000000001${String(i).padStart(2, '0')}`,
      number: null,
      versions: [],
    })),
  });
}

function renderPage(
  archive: FakeArchive,
  { browseOpen = true }: { browseOpen?: boolean } = {},
) {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queries}>
      <RollsPage api={archive.api} browseOpen={browseOpen} />
    </QueryClientProvider>,
  );
}

function showList() {
  fireEvent.click(screen.getByRole('button', { name: 'List' }));
}

/** A roll whose frames each have a scan, so its card shows thumbnails. */
function aRollWithScans(roll: string, scans: number): Roll {
  return {
    ...aRoll(roll),
    frames: Array.from({ length: scans }, (_, i) => {
      const n = String(i).padStart(2, '0');
      return {
        id: `01JC8Z7K3M00000000000001${n}`,
        number: String(i + 1),
        versions: [
          {
            id: `01JC8Z7K3M00000000000002${n}`,
            file: `frames/x/y/123400${n}.jpg`,
            sha256: n.padStart(64, '0'),
            bytes: 3,
            width: 3,
            height: 2,
            added: '2026-11-02T12:00:00.000Z',
          },
        ],
      };
    }),
  };
}

test('shows each roll as a card with its first three scans', async () => {
  renderPage(fakeArchive({ rolls: [aRollWithScans('2026-014', 5)] }));

  const card = (await screen.findByText('2026-014')).closest('li');
  const peek = Array.from(card?.querySelectorAll('img') ?? [], (img) =>
    img.getAttribute('src'),
  );

  expect(peek).toEqual(
    ['00', '01', '02'].map(
      (n) =>
        `/api/rolls/01JC8Z7K3M0000000002026014/frames/01JC8Z7K3M00000000000001${n}/versions/01JC8Z7K3M00000000000002${n}/thumbnail?size=small`,
    ),
  );
  expect(screen.getByText('5 frames')).toBeDefined();
});

describe('grouping, browsing and the address', () => {
  const someRolls = () =>
    fakeArchive({
      rolls: [
        aRollOf('2025-003', 1),
        aRollOf('2026-001', 2),
        aRollOf('2026-014', 3),
      ],
    });

  /** The rolls shown, by roll number, in order. */
  function rollsShown(): string[] {
    return screen
      .getAllByRole('link')
      .map((link) => link.textContent)
      .filter((text) => /^\d{4}-\d{3}$/.test(text));
  }

  test('groups rolls by year, newest first, with a count for each', async () => {
    renderPage(someRolls());
    await screen.findByText('2026-014');

    fireEvent.change(screen.getByLabelText('Group by'), {
      target: { value: 'year' },
    });

    const groupHeadings = screen
      .getAllByRole('heading', { level: 2 })
      .filter((heading) => heading.closest('aside') === null);
    expect(groupHeadings.map((h) => h.textContent)).toEqual([
      '2026 2 rolls',
      '2025 1 roll',
    ]);
    expect(window.location.search).toBe('?view=grid&group=year');
  });

  test('lists the years in the browse panel, and filters by the one chosen', async () => {
    renderPage(someRolls());
    const browse = await screen.findByRole('complementary', {
      name: 'Browse rolls',
    });

    fireEvent.click(within(browse).getByRole('button', { name: /^2025/ }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Rolls from 2025' }),
    ).toBeDefined();
    expect(rollsShown()).toEqual(['2025-003']);
    expect(window.location.search).toBe('?view=grid&year=2025');
    expect(
      within(browse)
        .getByRole('button', { name: /^2025/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  test('shows every roll again from All rolls', async () => {
    window.history.replaceState(null, '', '/?year=2025');
    renderPage(someRolls());
    await screen.findByText('2025-003');

    fireEvent.click(screen.getByRole('button', { name: /^All rolls/ }));

    expect(rollsShown()).toEqual(['2025-003', '2026-001', '2026-014']);
    expect(window.location.search).toBe('?view=grid');
  });

  test('opens with the view, grouping and filter in the address', async () => {
    window.history.replaceState(null, '', '/?view=list&group=year&year=2026');

    renderPage(someRolls());

    expect(await screen.findByRole('table')).toBeDefined();
    expect(rollsShown()).toEqual(['2026-001', '2026-014']);
    expect(screen.getByLabelText<HTMLSelectElement>('Group by').value).toBe(
      'year',
    );
  });

  test('counts the rolls in each year in the browse panel', async () => {
    renderPage(someRolls());
    const browse = await screen.findByRole('complementary', {
      name: 'Browse rolls',
    });

    expect(
      within(browse)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['All rolls3', '20262', '20251']);
  });

  test('leaves out the browse panel when it is closed', async () => {
    renderPage(someRolls(), { browseOpen: false });
    await screen.findByText('2026-014');

    expect(screen.queryByRole('complementary')).toBeNull();
  });
});

describe('finding rolls by camera', () => {
  const cameras = [
    { slug: 'nikon-fe', make: 'Nikon', model: 'FE' },
    { slug: 'leica-m6', make: 'Leica', model: 'M6' },
    { slug: 'pentax-k1000', make: 'Pentax', model: 'K1000' },
  ];
  const someRolls = () =>
    fakeArchive({
      rolls: [
        { ...aRoll('2025-003'), camera: 'nikon-fe' },
        aRoll('2026-001'),
        { ...aRoll('2026-014'), camera: 'leica-m6' },
        { ...aRoll('2026-015'), camera: 'nikon-fe' },
      ],
      cameras,
    });

  function rollsShown(): string[] {
    return screen
      .getAllByRole('link')
      .map((link) => link.textContent)
      .filter((text) => /^\d{4}-\d{3}$/.test(text));
  }

  test('groups rolls by camera, by name, with rolls that have none last', async () => {
    renderPage(someRolls());
    await screen.findByRole('region', { name: 'Cameras' });

    fireEvent.change(screen.getByLabelText('Group by'), {
      target: { value: 'camera' },
    });

    const groupHeadings = screen
      .getAllByRole('heading', { level: 2 })
      .filter((heading) => heading.closest('aside') === null);
    expect(groupHeadings.map((h) => h.textContent)).toEqual([
      'Leica M6 1 roll',
      'Nikon FE 2 rolls',
      'No camera 1 roll',
    ]);
    expect(rollsShown()).toEqual([
      '2026-014',
      '2025-003',
      '2026-015',
      '2026-001',
    ]);
    expect(window.location.search).toBe('?view=grid&group=camera');
  });

  test('lists the cameras rolls were shot on in the browse panel, with counts', async () => {
    renderPage(someRolls());
    const browse = await screen.findByRole('complementary', {
      name: 'Browse rolls',
    });
    const section = await within(browse).findByRole('region', {
      name: 'Cameras',
    });

    expect(
      within(section)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Leica M61', 'Nikon FE2']);
  });

  test('filters by the camera chosen in the browse panel', async () => {
    window.history.replaceState(null, '', '/?year=2026');
    renderPage(someRolls());
    const browse = await screen.findByRole('complementary', {
      name: 'Browse rolls',
    });

    fireEvent.click(
      await within(browse).findByRole('button', { name: /^Nikon FE/ }),
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Rolls shot on Nikon FE' }),
    ).toBeDefined();
    expect(rollsShown()).toEqual(['2025-003', '2026-015']);
    expect(window.location.search).toBe('?view=grid&camera=nikon-fe');
    expect(
      within(browse)
        .getByRole('button', { name: /^Nikon FE/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      within(browse)
        .getByRole('button', { name: /^All rolls/ })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });
});

describe('finding rolls by film stock', () => {
  const films: FilmStock[] = [
    {
      slug: 'kodak-portra-400',
      make: 'Kodak',
      name: 'Portra',
      iso: 400,
      type: 'colour-negative',
      format: '35mm',
    },
    {
      slug: 'ilford-hp5-plus-400',
      make: 'Ilford',
      name: 'HP5 Plus',
      iso: 400,
      type: 'black-and-white',
      format: '35mm',
    },
  ];
  const someRolls = () =>
    fakeArchive({
      rolls: [
        { ...aRoll('2025-003'), film: 'kodak-portra-400' },
        aRoll('2026-001'),
        { ...aRoll('2026-014'), film: 'ilford-hp5-plus-400' },
        { ...aRoll('2026-015'), film: 'kodak-portra-400' },
      ],
      films,
    });

  function rollsShown(): string[] {
    return screen
      .getAllByRole('link')
      .map((link) => link.textContent)
      .filter((text) => /^\d{4}-\d{3}$/.test(text));
  }

  test('groups rolls by film stock, by name, with rolls that have none last', async () => {
    renderPage(someRolls());
    await screen.findByRole('region', { name: 'Film stocks' });

    fireEvent.change(screen.getByLabelText('Group by'), {
      target: { value: 'film' },
    });

    const groupHeadings = screen
      .getAllByRole('heading', { level: 2 })
      .filter((heading) => heading.closest('aside') === null);
    expect(groupHeadings.map((h) => h.textContent)).toEqual([
      'Ilford HP5 Plus 400 1 roll',
      'Kodak Portra 400 2 rolls',
      'No film stock 1 roll',
    ]);
    expect(rollsShown()).toEqual([
      '2026-014',
      '2025-003',
      '2026-015',
      '2026-001',
    ]);
    expect(window.location.search).toBe('?view=grid&group=film');
  });

  test('lists the film stocks rolls are in the browse panel, with counts', async () => {
    renderPage(someRolls());
    const section = await screen.findByRole('region', { name: 'Film stocks' });

    expect(
      within(section)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Ilford HP5 Plus 4001', 'Kodak Portra 4002']);
  });

  test('filters by the film stock chosen in the browse panel', async () => {
    window.history.replaceState(null, '', '/?camera=nikon-fe');
    renderPage(someRolls());
    const section = await screen.findByRole('region', { name: 'Film stocks' });

    fireEvent.click(
      within(section).getByRole('button', { name: /^Kodak Portra 400/ }),
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Rolls of Kodak Portra 400',
      }),
    ).toBeDefined();
    expect(rollsShown()).toEqual(['2025-003', '2026-015']);
    expect(window.location.search).toBe('?view=grid&film=kodak-portra-400');
    expect(
      within(section)
        .getByRole('button', { name: /^Kodak Portra 400/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  test('names everything the rolls are filtered by in the heading', async () => {
    window.history.replaceState(
      null,
      '',
      '/?year=2026&camera=nikon-fe&film=kodak-portra-400&lens=zeiss-planar-80mm-f-2-8',
    );
    renderPage(
      fakeArchive({
        rolls: [
          {
            ...aRoll('2026-015'),
            camera: 'nikon-fe',
            film: 'kodak-portra-400',
            lens: 'zeiss-planar-80mm-f-2-8',
          },
        ],
        cameras: [{ slug: 'nikon-fe', make: 'Nikon', model: 'FE' }],
        films,
        lenses: [
          {
            slug: 'zeiss-planar-80mm-f-2-8',
            make: 'Zeiss',
            name: 'Planar',
            focalLength: 80,
            maxAperture: 2.8,
          },
        ],
      }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Rolls of Kodak Portra 400 shot on Nikon FE with Zeiss Planar 80mm f/2.8 in 2026',
      }),
    ).toBeDefined();
  });
});

describe('finding rolls by lens', () => {
  const lenses: Lens[] = [
    {
      slug: 'zeiss-planar-80mm-f-2-8',
      make: 'Zeiss',
      name: 'Planar',
      focalLength: 80,
      maxAperture: 2.8,
    },
    {
      slug: 'nikon-nikkor-ai-s-50mm-f-1-8',
      make: 'Nikon',
      name: 'Nikkor AI-S',
      focalLength: 50,
      maxAperture: 1.8,
    },
  ];
  const someRolls = () =>
    fakeArchive({
      rolls: [
        { ...aRoll('2025-003'), lens: 'zeiss-planar-80mm-f-2-8' },
        aRoll('2026-001'),
        { ...aRoll('2026-014'), lens: 'nikon-nikkor-ai-s-50mm-f-1-8' },
        { ...aRoll('2026-015'), lens: 'zeiss-planar-80mm-f-2-8' },
      ],
      lenses,
    });

  function rollsShown(): string[] {
    return screen
      .getAllByRole('link')
      .map((link) => link.textContent)
      .filter((text) => /^\d{4}-\d{3}$/.test(text));
  }

  test('groups rolls by lens, by name, with rolls that have none last', async () => {
    renderPage(someRolls());
    await screen.findByRole('region', { name: 'Lenses' });

    fireEvent.change(screen.getByLabelText('Group by'), {
      target: { value: 'lens' },
    });

    const groupHeadings = screen
      .getAllByRole('heading', { level: 2 })
      .filter((heading) => heading.closest('aside') === null);
    expect(groupHeadings.map((h) => h.textContent)).toEqual([
      'Nikon Nikkor AI-S 50mm f/1.8 1 roll',
      'Zeiss Planar 80mm f/2.8 2 rolls',
      'No lens 1 roll',
    ]);
    expect(window.location.search).toBe('?view=grid&group=lens');
  });

  test('lists the lenses rolls were shot with in the browse panel, with counts, and filters by one', async () => {
    renderPage(someRolls());
    const section = await screen.findByRole('region', { name: 'Lenses' });

    expect(
      within(section)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Nikon Nikkor AI-S 50mm f/1.81', 'Zeiss Planar 80mm f/2.82']);

    fireEvent.click(
      within(section).getByRole('button', { name: /^Zeiss Planar/ }),
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Rolls shot with Zeiss Planar 80mm f/2.8',
      }),
    ).toBeDefined();
    expect(rollsShown()).toEqual(['2025-003', '2026-015']);
    expect(window.location.search).toBe(
      '?view=grid&lens=zeiss-planar-80mm-f-2-8',
    );
  });
});

describe('finding rolls by event', () => {
  // As the service lists them: newest first.
  const events: Event[] = [
    { slug: 'iceland-2026', name: 'Iceland 2026', date: '2026-09' },
    { slug: 'westfjords', name: 'Westfjords', date: '2025-06' },
  ];
  const someRolls = () =>
    fakeArchive({
      rolls: [
        { ...aRoll('2025-003'), event: 'westfjords' },
        aRoll('2026-001'),
        { ...aRoll('2026-014'), event: 'iceland-2026' },
        { ...aRoll('2026-015'), event: 'iceland-2026' },
      ],
      events,
    });

  function rollsShown(): string[] {
    return screen
      .getAllByRole('link')
      .map((link) => link.textContent)
      .filter((text) => /^\d{4}-\d{3}$/.test(text));
  }

  test('shows each roll’s event on its card and in the list', async () => {
    renderPage(
      fakeArchive({
        rolls: [{ ...aRoll('2025-003'), event: 'westfjords', shot: '2025-06' }],
        events,
      }),
    );

    expect(await screen.findByText('Westfjords · Jun 2025')).toBeDefined();

    showList();

    expect(
      screen.getAllByRole('cell').map((cell) => cell.textContent),
    ).toContain('Westfjords');
  });

  test('groups rolls by event, newest first, with rolls that have none last', async () => {
    renderPage(someRolls());
    await screen.findByRole('region', { name: 'Events' });

    fireEvent.change(screen.getByLabelText('Group by'), {
      target: { value: 'event' },
    });

    const groupHeadings = screen
      .getAllByRole('heading', { level: 2 })
      .filter((heading) => heading.closest('aside') === null);
    expect(groupHeadings.map((h) => h.textContent)).toEqual([
      'Iceland 2026 2 rolls',
      'Westfjords 1 roll',
      'No event 1 roll',
    ]);
    expect(window.location.search).toBe('?view=grid&group=event');
  });

  test('lists the events rolls were shot at in the browse panel, with counts, and filters by one', async () => {
    renderPage(someRolls());
    const section = await screen.findByRole('region', { name: 'Events' });

    expect(
      within(section)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Iceland 20262', 'Westfjords1']);

    fireEvent.click(
      within(section).getByRole('button', { name: /^Iceland 2026/ }),
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Rolls at Iceland 2026' }),
    ).toBeDefined();
    expect(rollsShown()).toEqual(['2026-014', '2026-015']);
    expect(window.location.search).toBe('?view=grid&event=iceland-2026');
  });
});

describe('the list view', () => {
  test('shows the rolls as a table: roll, a strip of scans and frames', async () => {
    renderPage(
      fakeArchive({
        rolls: [aRollWithScans('2026-014', 5), aRoll('2026-015')],
      }),
    );
    await screen.findByText('2026-014');

    showList();

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      '2026-014—5',
      '2026-015——',
    ]);
    expect(rows[0]?.querySelectorAll('img')).toHaveLength(4);
    expect(
      screen.getAllByRole('columnheader').map((cell) => cell.textContent),
    ).toEqual([
      'Roll',
      'Strip',
      'Name',
      'Event',
      'Camera',
      'Film stock',
      'Shot',
      'Frames',
    ]);
  });

  test('shows each roll’s camera and film stock, by name, on its card and in the list', async () => {
    renderPage(
      fakeArchive({
        rolls: [
          {
            ...aRoll('2026-014'),
            camera: 'nikon-fe',
            film: 'kodak-portra-400',
            shot: '2026-09',
          },
        ],
        cameras: [{ slug: 'nikon-fe', make: 'Nikon', model: 'FE' }],
        films: [
          {
            slug: 'kodak-portra-400',
            make: 'Kodak',
            name: 'Portra',
            iso: 400,
            type: 'colour-negative',
            format: '35mm',
          },
        ],
      }),
    );

    expect(
      await screen.findByText('Nikon FE · Kodak Portra 400 · Sep 2026'),
    ).toBeDefined();

    showList();

    const cells = screen.getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells).toContain('Nikon FE');
    expect(cells).toContain('Kodak Portra 400');
  });

  test('marks which view is showing', async () => {
    renderPage(fakeArchive({ rolls: [aRoll('2026-014')] }));
    await screen.findByText('2026-014');

    expect(
      screen.getByRole('button', { name: 'Grid' }).getAttribute('aria-pressed'),
    ).toBe('true');

    showList();

    expect(
      screen.getByRole('button', { name: 'List' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Grid' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  test('is remembered for next time', async () => {
    renderPage(fakeArchive({ rolls: [aRoll('2026-014')] }));
    await screen.findByText('2026-014');
    showList();
    cleanup();

    renderPage(fakeArchive({ rolls: [aRoll('2026-014')] }));

    expect(await screen.findByRole('table')).toBeDefined();
  });
});

test('shows each roll’s name and when it was shot', async () => {
  renderPage(
    fakeArchive({
      rolls: [
        {
          ...aRollOf('2026-014', 2),
          name: 'Iceland, first day',
          shot: '2026-09',
        },
      ],
    }),
  );

  expect(await screen.findByText('Iceland, first day')).toBeDefined();
  expect(screen.getByText('Sep 2026')).toBeDefined();
});

test('sorts by date shot when chosen, undated rolls last, kept in the address', async () => {
  renderPage(
    fakeArchive({
      rolls: [
        { ...aRoll('2026-001'), shot: '2026-10' },
        { ...aRoll('2026-002') },
        { ...aRoll('2026-003'), shot: '2026-03-14' },
      ],
    }),
  );
  await screen.findByText('2026-001');

  fireEvent.change(screen.getByLabelText('Sort by'), {
    target: { value: 'shot' },
  });

  expect(
    screen
      .getAllByRole('link')
      .map((link) => link.textContent)
      .filter((text) => /^\d{4}-\d{3}$/.test(text)),
  ).toEqual(['2026-003', '2026-001', '2026-002']);
  expect(window.location.search).toBe('?view=grid&sort=shot');
});

test('says when a roll has no frames yet', async () => {
  renderPage(fakeArchive({ rolls: [aRoll('2026-014')] }));

  expect(await screen.findByText('No frames yet')).toBeDefined();
});

test('lists each roll with its number of frames', async () => {
  renderPage(
    fakeArchive({ rolls: [aRollOf('2025-003', 1), aRollOf('2026-014', 36)] }),
  );

  expect(await screen.findByText('2025-003')).toBeDefined();
  expect(screen.getByText('1 frame')).toBeDefined();
  expect(screen.getByText('2026-014')).toBeDefined();
  expect(screen.getByText('36 frames')).toBeDefined();
});

test('names any roll whose file cannot be read, and what is wrong', async () => {
  renderPage(
    fakeArchive({
      rolls: [aRoll('2026-014')],
      unreadable: [{ folder: '2026-015', problem: 'it is not valid JSON' }],
    }),
  );

  expect(
    await screen.findByText(
      "Roll 2026-015 can't be read: it is not valid JSON. Fix or replace its roll.json in the archive.",
    ),
  ).toBeDefined();
  expect(screen.getByText('2026-014')).toBeDefined();
});

test('says when there are no rolls yet', async () => {
  renderPage(fakeArchive());

  expect(await screen.findByText('No rolls yet.')).toBeDefined();
});

test('says so when the rolls cannot be loaded', async () => {
  const archive = fakeArchive();
  archive.stop();
  renderPage(archive);

  expect(
    await screen.findByText("Couldn't load the rolls. Is the service running?"),
  ).toBeDefined();
});

test('opens the new roll page from New roll', async () => {
  renderPage(fakeArchive());
  await screen.findByText('No rolls yet.');

  expect(
    screen.getByRole('link', { name: 'New roll' }).getAttribute('href'),
  ).toBe('/rolls/new');
});
