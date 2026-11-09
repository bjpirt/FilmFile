// @vitest-environment happy-dom
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
  type ArchiveContents,
  type FakeArchive,
} from '../testing/fake-archive.ts';
import { ImportRollsPage } from './import-rolls-page.tsx';

beforeEach(() => {
  window.history.replaceState(null, '', '/rolls/import');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderPage(archive: FakeArchive) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ImportRollsPage api={archive.api} />
    </QueryClientProvider>,
  );
}

function aScan(path: string): File {
  const file = new File([path], path.split('/').at(-1) ?? path, {
    type: 'image/jpeg',
  });
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
}

/** Chooses a folder with the folder picker, from the files in it, given with their paths. */
function chooseFolder(...paths: string[]) {
  fireEvent.change(screen.getByLabelText('Choose folder'), {
    target: { files: paths.map(aScan) },
  });
}

const twoRolls = [
  'lab/roll A/12340001.jpg',
  'lab/roll A/12340002.jpg',
  'lab/roll B/56780001.jpg',
];

function rowOf(name: string): HTMLElement {
  const rows = screen.getByRole('table', { name: 'Rolls to import' });
  const row = within(rows)
    .getAllByRole('row')
    .find((item) => within(item).queryByLabelText(`Import ${name}`) !== null);
  if (row === undefined) {
    throw new Error(`no row for ${name}`);
  }
  return row;
}

/** The frames a row says its folder holds. */
function framesOf(row: HTMLElement): string | null | undefined {
  return within(row).getAllByRole('cell')[2]?.textContent;
}

function withPattern(
  rollNumberPattern: string,
  contents: ArchiveContents = {},
): FakeArchive {
  return fakeArchive({
    ...contents,
    settings: { ...setUpSettings, rollNumberPattern },
  });
}

describe('choosing the folder', () => {
  test('previews each roll folder with its scans, its date and the number it gets', async () => {
    renderPage(fakeArchive({ rolls: [aRoll('2026-014')] }));
    await waitFor(() => {
      expect(screen.getByLabelText('Choose folder')).toBeDefined();
    });

    chooseFolder(...twoRolls);

    const a = rowOf('roll A');
    expect(framesOf(a)).toBe('2');
    expect(within(a).getByLabelText('Year', { exact: false })).toHaveProperty(
      'value',
      '2026',
    );
    await waitFor(() => {
      expect(a.textContent).toContain('2026-015');
    });
    expect(rowOf('roll B').textContent).toContain('2026-016');
    expect(framesOf(rowOf('roll B'))).toBe('1');
    expect(
      screen.getByRole('button', { name: 'Import 2 rolls' }),
    ).toHaveProperty('disabled', false);
  });

  test('dates a roll from its folder’s name, and numbers it for that year', async () => {
    renderPage(fakeArchive({ rolls: [aRoll('2019-003', { shot: '2019' })] }));

    chooseFolder('lab/2019-05-12 Iceland/1.jpg', 'lab/roll B/1.jpg');

    const iceland = rowOf('2019-05-12 Iceland');
    expect(
      within(iceland).getByLabelText('Year', { exact: false }),
    ).toHaveProperty('value', '2019');
    expect(within(iceland).getByLabelText('Month')).toHaveProperty(
      'value',
      '05',
    );
    expect(within(iceland).getByLabelText('Day')).toHaveProperty('value', '12');
    await waitFor(() => {
      expect(iceland.textContent).toContain('2019-004');
    });
    expect(rowOf('roll B').textContent).toContain('2026-001');
  });

  test('follows a date that is changed, and a roll left out', async () => {
    renderPage(fakeArchive());
    chooseFolder(...twoRolls);
    await waitFor(() => {
      expect(rowOf('roll A').textContent).toContain('2026-001');
    });

    fireEvent.change(
      within(rowOf('roll A')).getByLabelText('Year', { exact: false }),
      {
        target: { value: '2024' },
      },
    );
    expect(rowOf('roll A').textContent).toContain('2024-001');
    expect(rowOf('roll B').textContent).toContain('2026-001');

    fireEvent.click(screen.getByLabelText('Import roll A'));
    expect(within(rowOf('roll A')).getAllByRole('cell')[4]?.textContent).toBe(
      '',
    );
    expect(screen.getByRole('button', { name: 'Import 1 roll' })).toBeDefined();
  });

  test('wants a year of four digits before importing', async () => {
    renderPage(fakeArchive());
    chooseFolder(...twoRolls);
    await screen.findByRole('button', { name: 'Import 2 rolls' });

    fireEvent.change(
      within(rowOf('roll A')).getByLabelText('Year', { exact: false }),
      {
        target: { value: '26' },
      },
    );

    expect(rowOf('roll A').textContent).toContain(
      'Enter the year as four digits, like 2026.',
    );
    expect(
      screen.getByRole('button', { name: 'Import 2 rolls' }),
    ).toHaveProperty('disabled', true);
  });

  test('lists folders with no scans as skipped', () => {
    renderPage(fakeArchive());

    chooseFolder(...twoRolls, 'lab/thumbs/index.html');

    expect(screen.getByText('Skipped: thumbs (no scans)')).toBeDefined();
  });

  test('makes a roll of a folder that holds scans itself, and says when there are no roll folders', () => {
    renderPage(fakeArchive());

    chooseFolder('Iceland/12340001.jpg', 'Iceland/12340002.jpg');
    expect(framesOf(rowOf('Iceland'))).toBe('2');

    chooseFolder('lab/notes/readme.txt');
    expect(screen.getByRole('alert').textContent).toBe(
      'There are no roll folders with scans in it.',
    );
  });

  test('puts MM, DD or event in a number whose details are missing, and says what to do', async () => {
    renderPage(withPattern('{event}-{year}{month}-{n:2}'));

    chooseFolder(...twoRolls);

    await waitFor(() => {
      expect(rowOf('roll A').textContent).toContain('event-2026MM-01');
    });
    expect(rowOf('roll B').textContent).toContain('event-2026MM-02');
    expect(
      screen.getByText(
        'Numbers with MM, DD or event need those details: set them on each roll, then choose Number rolls…',
      ),
    ).toBeDefined();
  });
});

describe('importing', () => {
  async function previewed(archive: FakeArchive, ...paths: string[]) {
    renderPage(archive);
    chooseFolder(...paths);
    await screen.findByRole('button', { name: /^Import \d+ rolls?$/ });
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /^Import \d+ rolls?$/ }),
      ).toHaveProperty('disabled', false);
    });
  }

  test('makes each roll named after its folder, with its number and date, and adds its scans in order, then says what it did', async () => {
    const archive = fakeArchive();
    await previewed(archive, ...twoRolls, 'lab/2019 Iceland/1.jpg');

    fireEvent.click(screen.getByRole('button', { name: 'Import 3 rolls' }));

    expect(
      await screen.findByText('Imported 3 rolls, 4 frames.'),
    ).toBeDefined();
    expect(archive.created).toEqual([
      { roll: '2019-001', name: '2019 Iceland', shot: '2019' },
      { roll: '2026-001', name: 'roll A', shot: '2026' },
      { roll: '2026-002', name: 'roll B', shot: '2026' },
    ]);
    expect(archive.uploads).toEqual([
      '1.jpg',
      '12340001.jpg',
      '12340002.jpg',
      '56780001.jpg',
    ]);
    const table = within(screen.getByRole('table', { name: 'Imported rolls' }));
    expect(table.getAllByRole('row').map((row) => row.textContent)).toEqual([
      'NumberNameDateFramesStatus',
      '2019-0012019 Iceland20191✓ Added',
      '2026-001roll A20262✓ Added',
      '2026-002roll B20261✓ Added',
    ]);
    expect(table.getAllByRole('link').map((link) => link.textContent)).toEqual([
      '2019-001',
      '2026-001',
      '2026-002',
    ]);
    expect(screen.getAllByRole('link', { name: 'All rolls' })).toHaveLength(2);
  });

  test('gives a roll whose number was taken in the meantime the next free one', async () => {
    const archive = fakeArchive();
    await previewed(archive, ...twoRolls);
    // Another tab takes the number the first is to get.
    archive.rolls.push(aRoll('2026-001', { shot: '2026' }));

    fireEvent.click(screen.getByRole('button', { name: 'Import 2 rolls' }));

    await screen.findByText('Imported 2 rolls, 3 frames.');
    expect(archive.rolls.map((roll) => roll.roll).sort()).toEqual([
      '2026-001',
      '2026-002',
      '2026-003',
    ]);
  });

  test('goes on past a scan that is refused, and lists it', async () => {
    const archive = fakeArchive();
    await previewed(
      archive,
      'lab/roll A/12340001.jpg',
      'lab/roll A/not a name.jpg',
      'lab/roll B/56780001.jpg',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Import 2 rolls' }));

    await screen.findByText('Imported 2 rolls, 2 frames.');
    expect(screen.getByText(/Not added: not a name.jpg/)).toBeDefined();
    expect(archive.rolls).toHaveLength(2);
  });

  test('goes on past a roll that can not be made, and says so', async () => {
    const archive = fakeArchive();
    await previewed(archive, ...twoRolls);
    archive.stop();

    fireEvent.click(screen.getByRole('button', { name: 'Import 2 rolls' }));

    expect(
      await screen.findAllByText(
        "Couldn't be made: the service didn't make it",
        {
          exact: false,
        },
      ),
    ).toHaveLength(2);
    expect(screen.getByText('Imported 0 rolls, 0 frames.')).toBeDefined();
  });

  test('stops when cancelled, keeping what is made, and says what was left', async () => {
    const archive = fakeArchive();
    await previewed(archive, ...twoRolls);

    fireEvent.click(screen.getByRole('button', { name: 'Import 2 rolls' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(
      await screen.findByText(/Cancelled: 1 roll not imported\./),
    ).toBeDefined();
    expect(
      screen.getByText('Not imported (cancelled)', { exact: false }),
    ).toBeDefined();
    expect(archive.rolls.map((roll) => roll.name)).toEqual(['roll A']);
  });

  test('says what to do about numbers with a placeholder in them', async () => {
    const archive = withPattern('{year}{month}-{n:2}');
    await previewed(archive, ...twoRolls);

    fireEvent.click(screen.getByRole('button', { name: 'Import 2 rolls' }));

    await screen.findByText('Imported 2 rolls, 3 frames.');
    expect(archive.rolls.map((roll) => roll.roll)).toEqual([
      '2026MM-01',
      '2026MM-02',
    ]);
    expect(
      screen.getAllByText('Set its date or event, then choose Number rolls…', {
        exact: false,
      }),
    ).toHaveLength(2);
  });
});
