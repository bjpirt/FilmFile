// @vitest-environment happy-dom
import type { Camera, FilmStock, Lens } from '@filmfile/contracts/equipment';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
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
  type ArchiveContents,
  type FakeArchive,
} from '../testing/fake-archive.ts';
import { RollPage } from './roll-page.tsx';

afterEach(cleanup);

const rollId = aRoll('2026-014').id;

const planar: Lens = {
  slug: 'zeiss-planar-80mm-f-2-8',
  make: 'Zeiss',
  name: 'Planar',
  focalLength: 80,
  maxAperture: 2.8,
};

const nikonFe: Camera = { slug: 'nikon-fe', make: 'Nikon', model: 'FE' };

const portra: FilmStock = {
  slug: 'kodak-portra-400',
  make: 'Kodak',
  name: 'Portra',
  iso: 400,
  type: 'colour-negative',
  format: '35mm',
};

/** The archive the page is tested against: the one roll, with these frames and details, and any other contents. */
function archiveWith(
  frames: Frame[] = [],
  details: Partial<Roll> = {},
  contents: ArchiveContents = {},
): FakeArchive {
  return fakeArchive({
    ...contents,
    rolls: [aRoll('2026-014', { ...details, frames })],
  });
}

/** The roll's frames as the archive has them now. */
function framesOf(archive: FakeArchive): readonly Frame[] {
  return archive.rolls[0]?.frames ?? [];
}

function aScan(name: string, content = name): File {
  return new File([content], name, { type: 'image/jpeg' });
}

function aFrameWithScan(number: string | null, file: string): Frame {
  return {
    id: `01JC8Z7K3M00000000000000${file.slice(6, 8)}`,
    number,
    title: null,
    rating: null,
    notes: null,
    camera: null,
    lens: null,
    event: null,
    toScan: false,
    shot: null,
    defaultVersion: null,
    versions: [
      {
        id: `01JC8Z7K3M00000000000001${file.slice(6, 8)}`,
        fileName: file,
        sha256: file,
        bytes: 3,
        width: 3,
        height: 2,
        added: '2026-11-02T12:00:00.000Z',
        rotate: 0,
        kind: 'scan',
      },
    ],
  };
}

function renderPage(archive: FakeArchive) {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queries}>
      <RollPage api={archive.api} rollId={rollId} />
    </QueryClientProvider>,
  );
}

/** Chooses one of the roll's actions from its Actions menu. */
async function chooseAction(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Actions' }));
  fireEvent.click(screen.getByRole('menuitem', { name }));
}

function chooseScans(...files: File[]) {
  // On a roll with frames, the drop zone opens from Add scans.
  if (screen.queryByLabelText('Choose scans') === null) {
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add scans' }));
  }
  fireEvent.change(screen.getByLabelText('Choose scans'), {
    target: { files },
  });
}

test('offers the roll’s actions in one menu, selecting and renumbering once it has frames', async () => {
  renderPage(archiveWith([aFrameWithScan('1', '12340001.jpg')]));
  fireEvent.click(await screen.findByRole('button', { name: 'Actions' }));

  expect(
    screen.getAllByRole('menuitem').map((item) => item.textContent),
  ).toEqual([
    'Mark as filed',
    'Edit details',
    'Add scans',
    'Bulk edit',
    'Renumber…',
    'Delete roll…',
  ]);
  cleanup();

  renderPage(archiveWith());
  fireEvent.click(await screen.findByRole('button', { name: 'Actions' }));
  expect(
    screen.getAllByRole('menuitem').map((item) => item.textContent),
  ).toEqual(['Mark as filed', 'Edit details', 'Add scans', 'Delete roll…']);
});

test('heads the page with the roll number and how many frames it has', async () => {
  renderPage(
    archiveWith([
      aFrameWithScan('1', '12340001.jpg'),
      aFrameWithScan('2', '12340002.jpg'),
    ]),
  );

  expect(
    await screen.findByRole('heading', { name: 'Roll 2026-014' }),
  ).toBeDefined();
  expect(screen.getByText('2 frames')).toBeDefined();
});

test('shows the roll’s name, camera, lens, film stock, date shot and notes', async () => {
  renderPage(
    archiveWith(
      [],
      {
        name: 'Iceland, first day',
        notes: 'Jökulsárlón at dawn.',
        shot: '2026-09-14T06:30',
        camera: 'nikon-fe',
        film: 'kodak-portra-400',
        lens: 'zeiss-planar-80mm-f-2-8',
        event: 'iceland-2026',
      },
      {
        cameras: [nikonFe],
        films: [portra],
        lenses: [planar],
        events: [{ slug: 'iceland-2026', name: 'Iceland 2026', date: null }],
      },
    ),
  );

  expect(await screen.findByText('Iceland, first day')).toBeDefined();
  const href = (name: string) =>
    screen.getByRole('link', { name }).getAttribute('href');
  expect(href('Nikon FE')).toBe('/?camera=nikon-fe');
  expect(href('Zeiss Planar 80mm f/2.8')).toBe(
    '/?lens=zeiss-planar-80mm-f-2-8',
  );
  expect(href('Kodak Portra 400')).toBe('/?film=kodak-portra-400');
  expect(href('Iceland 2026')).toBe('/events/iceland-2026');
  expect(await screen.findByText('Nikon FE')).toBeDefined();
  expect(await screen.findByText('Kodak Portra 400')).toBeDefined();
  expect(await screen.findByText('Zeiss Planar 80mm f/2.8')).toBeDefined();
  expect(details()).toEqual([
    ['Camera', 'Nikon FE'],
    ['Lens', 'Zeiss Planar 80mm f/2.8'],
    ['Film stock', 'Kodak Portra 400'],
    ['Event', 'Iceland 2026'],
    ['Shot', '14 Sep 2026, 06:30'],
  ]);
  expect(screen.getByText('Jökulsárlón at dawn.')).toBeDefined();
});

/** The roll's details row, as label and value pairs. */
function details(): (string | null)[][] {
  return Array.from(document.querySelectorAll('dl div'), (item) =>
    Array.from(item.children, (child) => child.textContent),
  );
}

describe('editing the details', () => {
  const iceland = {
    name: 'Iceland',
    notes: 'Jökulsárlón at dawn.',
    shot: '2026-09-14',
  };

  async function editDetails() {
    await chooseAction('Edit details');
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

  /** Chooses an option in a dropdown by the text it shows. */
  function choose(label: string, option: string) {
    const select = field(label);
    const chosen = within(select).getByRole<HTMLOptionElement>('option', {
      name: option,
    });
    fireEvent.change(select, { target: { value: chosen.value } });
  }

  test('opens with the roll number first, then the details, filled in', async () => {
    renderPage(archiveWith([], iceland));
    await editDetails();

    const labels = within(screen.getByRole('form', { name: 'Roll details' }))
      .getAllByRole('textbox')
      .map((box) => box.closest('label')?.textContent.replace('*', '').trim());
    expect(labels[0]).toBe('Roll number');
    expect(field('Roll number').value).toBe('2026-014');
    expect(field('Name').value).toBe('Iceland');
    expect(field('Notes').value).toBe('Jökulsárlón at dawn.');
    expect(field('Year').value).toBe('2026');
    expect(field('Month').value).toBe('09');
    expect(field('Day').value).toBe('14');
    expect(field('Time').value).toBe('');
  });

  test('changes the roll’s number, showing it at once in the heading and the breadcrumb', async () => {
    const service = archiveWith([], iceland);
    renderPage(service);
    await editDetails();

    fill('Roll number', '2026-009');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Roll 2026-009' }),
    ).toBeDefined();
    expect(service.rolls[0]?.roll).toBe('2026-009');
    expect(service.rollUpdates).toEqual([
      expect.objectContaining({ roll: '2026-009' }),
    ]);
  });

  test('sends the number only when it was changed', async () => {
    const service = archiveWith([], iceland);
    renderPage(service);
    await editDetails();

    fill('Name', 'Westfjords');
    fill('Roll number', '2026-009');
    fill('Roll number', '2026-014');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await screen.findByText('Westfjords');
    expect(service.rollUpdates).toHaveLength(1);
    expect(service.rollUpdates[0]).not.toHaveProperty('roll');
  });

  test('accepts a freeform roll number when editing', async () => {
    const service = archiveWith([], iceland);
    renderPage(service);
    await editDetails();

    expect(field('Roll number').maxLength).toBe(100);
    fill('Roll number', 'BP/roll 1');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Roll BP/roll 1' }),
    ).toBeDefined();
    expect(service.rolls[0]?.roll).toBe('BP/roll 1');
  });

  test('asks for a roll number when the edited value is blank', async () => {
    const service = archiveWith([], iceland);
    renderPage(service);
    await editDetails();

    fill('Roll number', ' ');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Enter a roll number.',
    );
    expect(service.rollUpdates).toEqual([]);
  });

  test('refuses a number another roll has, keeping the panel open and changing nothing', async () => {
    const service = fakeArchive({
      rolls: [aRoll('2026-014', iceland), aRoll('2026-009')],
    });
    renderPage(service);
    await editDetails();

    fill('Roll number', '2026-009');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Roll 2026-009 already exists.',
    );
    expect(field('Roll number').value).toBe('2026-009');
    expect(service.rolls[0]?.roll).toBe('2026-014');
  });

  test('keeps a number whose year isn’t the year shot, and says nothing', async () => {
    const service = archiveWith([], iceland);
    renderPage(service);
    await editDetails();

    fill('Roll number', '2024-030');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await screen.findByRole('heading', { level: 1, name: 'Roll 2024-030' });
    expect(service.rolls[0]).toMatchObject({
      roll: '2024-030',
      shot: '2026-09-14',
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('saves the details, sending the roll’s ETag, and shows them', async () => {
    const service = archiveWith([], iceland);
    renderPage(service);
    await editDetails();

    fill('Name', 'Westfjords');
    fill('Notes', '');
    fill('Month', '');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Westfjords')).toBeDefined();
    expect(details()).toEqual([['Shot', '2026']]);
    expect(screen.queryByText('Jökulsárlón at dawn.')).toBeNull();
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(service.ifMatches).toEqual(['"v1"']);
  });

  test('picks a camera from the archive’s', async () => {
    const service = archiveWith([], iceland, { cameras: [nikonFe] });
    renderPage(service);
    await editDetails();
    await screen.findByRole('option', { name: 'Nikon FE' });

    choose('Camera', 'Nikon FE');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Nikon FE')).toBeDefined();
    expect(service.cameras).toEqual([nikonFe]);
  });

  test('adds a camera the archive doesn’t have yet', async () => {
    const service = archiveWith([], iceland, { cameras: [nikonFe] });
    renderPage(service);
    await editDetails();

    choose('Camera', 'Add new…');
    fill('Make', 'Pentax');
    fill('Model', 'K1000');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Pentax K1000')).toBeDefined();
    expect(service.cameras.map((camera) => camera.slug)).toEqual([
      'nikon-fe',
      'pentax-k1000',
    ]);
  });

  test('offers the archive’s cameras, then Add new…, with the roll’s chosen', async () => {
    renderPage(
      archiveWith(
        [],
        { ...iceland, camera: 'nikon-fe' },
        { cameras: [nikonFe] },
      ),
    );
    await screen.findByText('Nikon FE');
    await editDetails();

    const options = within(field('Camera')).getAllByRole<HTMLOptionElement>(
      'option',
    );
    expect(options.map((option) => option.textContent)).toEqual([
      '—',
      'Nikon FE',
      'Add new…',
    ]);
    expect(options[1]?.selected).toBe(true);
  });

  test('adds a film stock the archive doesn’t have yet, with its details', async () => {
    const service = archiveWith([], iceland, { films: [portra] });
    renderPage(service);
    await editDetails();

    await screen.findByRole('option', { name: 'Kodak Portra 400' });
    choose('Film stock', 'Add new…');
    fill('Make', 'Fuji');
    fireEvent.change(
      within(
        screen.getByRole('group', { name: 'New film stock' }),
      ).getByLabelText('Name', {
        normalizer: (text) => text.replace('*', '').trim(),
      }),
      { target: { value: 'Velvia' } },
    );
    fill('ISO', '50');
    choose('Type', 'Colour slide');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Fuji Velvia 50')).toBeDefined();
    expect(service.films.at(-1)).toEqual({
      slug: 'fuji-velvia-50',
      make: 'Fuji',
      name: 'Velvia',
      iso: 50,
      type: 'colour-slide',
      format: null,
    });
  });

  test('shows the roll’s film stock chosen, and can clear it', async () => {
    const service = archiveWith(
      [],
      { ...iceland, film: 'kodak-portra-400' },
      { films: [portra] },
    );
    renderPage(service);
    await screen.findByText('Kodak Portra 400');
    await editDetails();

    expect(
      within(field('Film stock')).getByRole<HTMLOptionElement>('option', {
        name: 'Kodak Portra 400',
      }).selected,
    ).toBe(true);

    choose('Film stock', '—');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => {
      expect(screen.queryByText('Kodak Portra 400')).toBeNull();
    });
  });

  test('picks a lens from the archive’s, and can clear it', async () => {
    const service = archiveWith([], iceland, { lenses: [planar] });
    renderPage(service);
    await editDetails();
    await screen.findByRole('option', { name: 'Zeiss Planar 80mm f/2.8' });

    choose('Lens', 'Zeiss Planar 80mm f/2.8');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Zeiss Planar 80mm f/2.8')).toBeDefined();

    await editDetails();
    choose('Lens', '—');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    await waitFor(() => {
      expect(screen.queryByText('Zeiss Planar 80mm f/2.8')).toBeNull();
    });
  });

  test('puts the roll in an event, shown in its details row', async () => {
    const service = archiveWith([], iceland, {
      events: [{ slug: 'iceland-2026', name: 'Iceland 2026', date: null }],
    });
    renderPage(service);
    await editDetails();
    await screen.findByRole('option', { name: 'Iceland 2026' });

    choose('Event', 'Iceland 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Iceland 2026')).toBeDefined();
    expect(details()).toContainEqual(['Event', 'Iceland 2026']);
  });

  test('adds a new event with a date from the details, and puts the roll in it (FF-171)', async () => {
    const service = archiveWith([], iceland);
    renderPage(service);
    await editDetails();

    choose('Event', 'Add new…');
    const newEvent = screen.getByRole('group', { name: 'New event' });
    fireEvent.change(
      within(newEvent).getByLabelText('Name', { exact: false }),
      {
        target: { value: 'Westfjords' },
      },
    );
    const date = within(screen.getByRole('group', { name: 'Event date' }));
    fireEvent.change(date.getByLabelText('Year', { exact: false }), {
      target: { value: '2025' },
    });
    fireEvent.change(date.getByLabelText('Month'), { target: { value: '06' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(await screen.findByText('Westfjords')).toBeDefined();
    expect(service.events).toEqual([
      { slug: 'westfjords', name: 'Westfjords', date: '2025-06' },
    ]);
    expect(service.rolls[0]?.event).toBe('westfjords');
  });

  test('asks for a year', async () => {
    const service = archiveWith([], iceland);
    renderPage(service);
    await editDetails();

    fill('Year', '');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(screen.getByRole('alert').textContent).toBe(
      'Enter the year as four digits, like 2026.',
    );
    expect(service.ifMatches).toEqual([]);
  });

  test('refuses to overwrite a roll changed since the page loaded, keeping what was entered', async () => {
    const service = archiveWith([], iceland);
    renderPage(service);
    await editDetails();
    service.changeRoll(rollId);

    fill('Name', 'Westfjords');
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'This roll changed since you opened it.',
    );
    expect(field('Name').value).toBe('Westfjords');
  });

  test('goes back to the details as they were on Cancel, saving nothing', async () => {
    const service = archiveWith([], iceland);
    renderPage(service);
    await editDetails();

    fill('Name', 'Westfjords');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Iceland')).toBeDefined();
    expect(service.ifMatches).toEqual([]);
  });
});

describe('deleting a frame', () => {
  const twoFrames = () => [
    aFrameWithScan('1', '12340001.jpg'),
    aFrameWithScan('2', '12340002.jpg'),
  ];

  test('asks to confirm, then deletes the frame, sending the roll’s ETag', async () => {
    const service = archiveWith(twoFrames());
    renderPage(service);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete frame 2' }),
    );

    const confirm = screen.getByRole('alertdialog', { name: 'Delete frame 2' });
    expect(confirm.textContent).toBe('Delete this frame?DeleteCancel');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(framesOf(service).map((frame) => frame.number)).toEqual(['1']);
    });
    expect(service.ifMatches).toEqual(['"v1"']);
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });
  });

  test('keeps the frame on Cancel', async () => {
    const service = archiveWith(twoFrames());
    renderPage(service);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete frame 2' }),
    );

    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Cancel',
      }),
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(framesOf(service)).toHaveLength(2);
  });

  test('refuses to delete from a roll changed since the page loaded', async () => {
    const service = archiveWith(twoFrames());
    renderPage(service);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete frame 2' }),
    );
    service.changeRoll(rollId);

    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Delete',
      }),
    );

    expect(
      (await screen.findByText(/This roll changed since you opened it/))
        .textContent,
    ).toContain('Reload');
    expect(framesOf(service)).toHaveLength(2);
  });

  test('names a frame with no number as such', async () => {
    renderPage(archiveWith([aFrameWithScan(null, '12340001.jpg')]));

    expect(
      await screen.findByRole('button', {
        name: 'Delete the frame with no number',
      }),
    ).toBeDefined();
  });
});

describe('selecting frames', () => {
  const threeFrames = () => [
    aFrameWithScan('1', '12340001.jpg'),
    aFrameWithScan('2', '12340002.jpg'),
    aFrameWithScan('3', '12340003.jpg'),
  ];

  async function startSelecting(archive = archiveWith(threeFrames())) {
    renderPage(archive);
    await chooseAction('Bulk edit');
    return archive;
  }

  function box(number: string): HTMLElement {
    return screen.getByRole('checkbox', { name: `Select frame ${number}` });
  }

  function ticked(): string[] {
    return ['1', '2', '3'].filter((number) => {
      const checkbox = box(number);
      return checkbox instanceof HTMLInputElement && checkbox.checked;
    });
  }

  function count(): string {
    return screen.getByRole('status', { name: 'Selection' }).textContent;
  }

  test('gives each frame a checkbox in place of opening it or deleting it', async () => {
    await startSelecting();

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(count()).toBe('No frames selected');
    expect(screen.queryByRole('link', { name: 'Open frame 1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete frame 1' })).toBeNull();
  });

  test('selects a frame by its checkbox or its picture, and unselects it again', async () => {
    await startSelecting();

    fireEvent.click(box('2'));
    expect(ticked()).toEqual(['2']);
    expect(count()).toBe('1 frame selected');

    fireEvent.click(screen.getByRole('img', { name: '12340003.jpg' }));
    expect(ticked()).toEqual(['2', '3']);

    fireEvent.click(box('2'));
    expect(ticked()).toEqual(['3']);
  });

  test('selects a run of frames with shift-click', async () => {
    await startSelecting();

    fireEvent.click(box('1'));
    fireEvent.click(box('3'), { shiftKey: true });

    expect(ticked()).toEqual(['1', '2', '3']);
    expect(count()).toBe('3 frames selected');
  });

  test('selects every frame, and clears them', async () => {
    await startSelecting();

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(ticked()).toEqual(['1', '2', '3']);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(ticked()).toEqual([]);
  });

  test('leaves with Done or Esc, forgetting the selection and saving nothing', async () => {
    const archive = await startSelecting();
    fireEvent.click(box('1'));

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open frame 1' })).toBeDefined();

    await chooseAction('Bulk edit');
    expect(ticked()).toEqual([]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(archive.requests.filter((r) => !r.startsWith('GET'))).toEqual([]);
  });
});

describe('frames grouped by event (FF-102)', () => {
  const events = [
    { slug: 'iceland-2026', name: 'Iceland 2026', date: null },
    { slug: 'norway-2025', name: 'Norway 2025', date: null },
  ];

  function inEvent(number: string, event: string | null): Frame {
    return {
      ...aFrameWithScan(number, `1234000${number}.jpg`),
      event,
    };
  }

  /** The labels over the groups, as the sheet shows them. */
  function labels(): string[] {
    return Array.from(document.querySelectorAll('.event-group-title')).map(
      (label) => label.textContent,
    );
  }

  function framesIn(group: string): (string | null)[] {
    return within(screen.getByRole('list', { name: `Frames in ${group}` }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-label'));
  }

  const mixed = () =>
    archiveWith(
      [
        inEvent('1', 'iceland-2026'),
        inEvent('2', 'norway-2025'),
        inEvent('3', 'iceland-2026'),
        inEvent('4', null),
      ],
      {},
      { events },
    );

  test('shows a label for each event, with its frames in frame order, in the order of their first frames, and No event last', async () => {
    renderPage(mixed());

    await screen.findByRole('list', { name: 'Frames in Iceland 2026' });

    expect(labels()).toEqual([
      'Iceland 2026 · 2',
      'Norway 2025 · 1',
      'No event · 1',
    ]);
    expect(framesIn('Iceland 2026')).toEqual(['Open frame 1', 'Open frame 3']);
    expect(framesIn('Norway 2025')).toEqual(['Open frame 2']);
    expect(framesIn('No event')).toEqual(['Open frame 4']);
    expect(screen.queryByRole('list', { name: 'Contact sheet' })).toBeNull();
  });

  test('links each event’s label to its page, but not No event', async () => {
    renderPage(mixed());
    await screen.findByRole('list', { name: 'Frames in Iceland 2026' });

    expect(
      screen.getByRole('link', { name: 'Iceland 2026' }).getAttribute('href'),
    ).toBe('/events/iceland-2026');
    expect(
      screen.getByRole('link', { name: 'Norway 2025' }).getAttribute('href'),
    ).toBe('/events/norway-2025');
    expect(screen.queryByRole('link', { name: 'No event' })).toBeNull();
  });

  test('has no labels when every frame is in one event, or none', async () => {
    renderPage(
      archiveWith(
        [inEvent('1', null), inEvent('2', 'iceland-2026')],
        { event: 'iceland-2026' },
        { events },
      ),
    );
    await screen.findByRole('list', { name: 'Contact sheet' });
    expect(labels()).toEqual([]);

    cleanup();
    renderPage(archiveWith([inEvent('1', null), inEvent('2', null)]));
    await screen.findByRole('list', { name: 'Contact sheet' });
    expect(labels()).toEqual([]);
  });

  test('groups by an event a frame has of its own over the roll’s', async () => {
    renderPage(
      archiveWith(
        [inEvent('1', null), inEvent('2', 'norway-2025')],
        { event: 'iceland-2026' },
        { events },
      ),
    );

    await screen.findByRole('list', { name: 'Frames in Iceland 2026' });

    expect(labels()).toEqual(['Iceland 2026 · 1', 'Norway 2025 · 1']);
  });

  test('shows a frame marked as in no event under No event, though its roll has an event', async () => {
    renderPage(
      archiveWith(
        [inEvent('1', null), { ...inEvent('2', null), event: false }],
        { event: 'iceland-2026' },
        { events },
      ),
    );

    await screen.findByRole('list', { name: 'Frames in Iceland 2026' });

    expect(labels()).toEqual(['Iceland 2026 · 1', 'No event · 1']);
  });

  test('groups the sheet when a bulk edit puts frames in another event, and takes the groups away again', async () => {
    renderPage(
      archiveWith(
        [inEvent('1', null), inEvent('2', null), inEvent('3', null)],
        {},
        { events },
      ),
    );
    await screen.findByRole('list', { name: 'Contact sheet' });
    await chooseAction('Bulk edit');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select frame 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Event…' }));
    const form = screen.getByRole('form', { name: 'Set event' });
    fireEvent.change(within(form).getByLabelText('Event for 1 frame'), {
      target: { value: 'norway-2025' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Set' }));

    await screen.findByText('Event set on 1 frame.');
    await waitFor(() => {
      expect(labels()).toEqual(['Norway 2025 · 1', 'No event · 2']);
    });
    // The checkboxes stay across the groups.
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  test('shows every frame in scan order, without groups, while renumbering', async () => {
    renderPage(mixed());
    await screen.findByRole('list', { name: 'Frames in Iceland 2026' });

    await chooseAction('Renumber…');

    expect(labels()).toEqual([]);
    expect(
      within(screen.getByRole('list', { name: 'Contact sheet' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(4);
  });

  test('selects every frame across the groups, and a shift-click run in the order on screen', async () => {
    renderPage(mixed());
    await screen.findByRole('list', { name: 'Frames in Iceland 2026' });
    await chooseAction('Bulk edit');

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByRole('status', { name: 'Selection' }).textContent).toBe(
      '4 frames selected',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    // On screen: 1, 3, 2, 4 (Iceland, Norway, No event): a run from 1 to 2 has 3 in it.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select frame 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select frame 2' }), {
      shiftKey: true,
    });
    const ticked = ['1', '2', '3', '4'].filter((number) => {
      const box = screen.getByRole('checkbox', {
        name: `Select frame ${number}`,
      });
      return box instanceof HTMLInputElement && box.checked;
    });
    expect(ticked).toEqual(['1', '2', '3']);
  });
});

describe('setting details on selected frames', () => {
  const leica: Camera = { slug: 'leica-m6', make: 'Leica', model: 'M6' };

  async function selectFramesOf(numbers: string[], archive?: FakeArchive) {
    const service =
      archive ??
      archiveWith(
        [
          aFrameWithScan('1', '12340001.jpg'),
          aFrameWithScan('2', '12340002.jpg'),
          aFrameWithScan('3', '12340003.jpg'),
        ],
        { camera: 'nikon-fe' },
        {
          cameras: [nikonFe, leica],
          events: [{ slug: 'westfjords', name: 'Westfjords', date: null }],
        },
      );
    renderPage(service);
    await chooseAction('Bulk edit');
    for (const number of numbers) {
      fireEvent.click(
        screen.getByRole('checkbox', { name: `Select frame ${number}` }),
      );
    }
    return service;
  }

  function setTo(detail: string, label: string, option: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    fireEvent.click(
      screen.getByRole('menuitem', {
        name: `${detail[0]?.toUpperCase() ?? ''}${detail.slice(1)}…`,
      }),
    );
    const form = screen.getByRole('form', { name: `Set ${detail}` });
    fireEvent.change(within(form).getByLabelText(label), {
      target: { value: option },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Set' }));
  }

  test('sets an event, camera or lens, but never a film stock, which is the roll’s', async () => {
    await selectFramesOf(['1']);

    fireEvent.click(screen.getByRole('button', { name: 'Set' }));

    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['Event…', 'Camera…', 'Lens…', 'Mark to scan', 'Unmark']);
  });

  test('closes a choice on Esc, still selecting', async () => {
    await selectFramesOf(['1']);
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Camera…' }));

    fireEvent.keyDown(screen.getByLabelText('Camera for 1 frame'), {
      key: 'Escape',
    });

    expect(screen.queryByRole('form', { name: 'Set camera' })).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  test('can’t set anything until frames are selected', async () => {
    await selectFramesOf([]);

    expect(
      screen.getByRole('button', { name: 'Set' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  test('gives the selected frames their own camera in one save, marking them', async () => {
    const service = await selectFramesOf(['1', '3']);

    setTo('camera', 'Camera for 2 frames', 'leica-m6');

    expect(await screen.findByText('Camera set on 2 frames.')).toBeDefined();
    expect(framesOf(service).map((frame) => frame.camera)).toEqual([
      'leica-m6',
      null,
      'leica-m6',
    ]);
    expect(service.ifMatches).toEqual(['"v1"']);
    await waitFor(() => {
      expect(screen.getAllByText('Its own camera')).toHaveLength(2);
    });
  });

  test('puts the selected frames in no event, though their roll has one', async () => {
    const service = await selectFramesOf(['2']);
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Event…' }));
    const form = screen.getByRole('form', { name: 'Set event' });
    const choose = within(form).getByLabelText('Event for 1 frame');

    fireEvent.change(choose, {
      target: {
        value: within(choose)
          .getByRole('option', { name: 'No event' })
          .getAttribute('value'),
      },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Set' }));

    await screen.findByText('Event set on 1 frame.');
    expect(framesOf(service).map((frame) => frame.event)).toEqual([
      null,
      false,
      null,
    ]);
  });

  test('puts the selected frames in an event', async () => {
    const service = await selectFramesOf(['2']);

    setTo('event', 'Event for 1 frame', 'westfjords');

    await screen.findByText('Event set on 1 frame.');
    expect(framesOf(service).map((frame) => frame.event)).toEqual([
      null,
      'westfjords',
      null,
    ]);
  });

  test('marks and unmarks selected frames to scan with count feedback', async () => {
    const service = await selectFramesOf(['1', '3']);

    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark to scan' }));
    expect(await screen.findByText('2 frames marked to scan.')).toBeDefined();
    expect(framesOf(service).map((frame) => frame.toScan)).toEqual([
      true,
      false,
      true,
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unmark' }));
    expect(
      await screen.findByText('Scan mark removed from 2 frames.'),
    ).toBeDefined();
    expect(framesOf(service).map((frame) => frame.toScan)).toEqual([
      false,
      false,
      false,
    ]);
  });

  test('does not announce a scan mark when the roll changed elsewhere', async () => {
    const service = await selectFramesOf(['1']);
    service.changeRoll(rollId);

    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark to scan' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This roll changed since you opened it. Reload the page.',
    );
    expect(service.rolls[0]?.frames[0]?.toScan).toBe(false);
    expect(screen.queryByText('1 frame marked to scan.')).toBeNull();
  });

  test('gives them back the roll’s', async () => {
    const service = archiveWith(
      [
        { ...aFrameWithScan('1', '12340001.jpg'), camera: 'leica-m6' },
        aFrameWithScan('2', '12340002.jpg'),
      ],
      { camera: 'nikon-fe' },
      { cameras: [nikonFe, leica] },
    );
    await selectFramesOf(['1'], service);

    setTo('camera', 'Camera for 1 frame', '');

    await screen.findByText('1 frame uses the roll’s camera.');
    expect(framesOf(service).map((frame) => frame.camera)).toEqual([
      null,
      null,
    ]);
  });

  test('says when the roll changed elsewhere, saving nothing', async () => {
    const service = await selectFramesOf(['1']);
    service.changeRoll(rollId);

    setTo('camera', 'Camera for 1 frame', 'leica-m6');

    expect((await screen.findByRole('alert')).textContent).toContain(
      'This roll changed since you opened it.',
    );
    expect(framesOf(service).map((frame) => frame.camera)).toEqual([
      null,
      null,
      null,
    ]);
  });
});

describe('deleting selected frames', () => {
  async function selectFramesOf(numbers: string[]) {
    const service = archiveWith([
      aFrameWithScan('1', '12340001.jpg'),
      aFrameWithScan('2', '12340002.jpg'),
      aFrameWithScan('3', '12340003.jpg'),
    ]);
    renderPage(service);
    await chooseAction('Bulk edit');
    for (const number of numbers) {
      fireEvent.click(
        screen.getByRole('checkbox', { name: `Select frame ${number}` }),
      );
    }
    return service;
  }

  test('asks to confirm, then deletes them together, sending the roll’s ETag', async () => {
    const service = await selectFramesOf(['1', '3']);

    fireEvent.click(screen.getByRole('button', { name: 'Delete…' }));
    const confirm = screen.getByRole('alertdialog', {
      name: 'Delete 2 frames',
    });
    expect(confirm.textContent).toContain('Delete these 2 frames?');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(framesOf(service).map((frame) => frame.number)).toEqual(['2']);
    });
    expect(service.deleted.map((frame) => frame.number)).toEqual(['1', '3']);
    expect(service.ifMatches).toEqual(['"v1"']);
    expect(
      (await screen.findByRole('status', { name: 'Selection' })).textContent,
    ).toBe('No frames selected');
  });

  test('keeps them on Cancel', async () => {
    const service = await selectFramesOf(['2']);

    fireEvent.click(screen.getByRole('button', { name: 'Delete…' }));
    fireEvent.click(
      within(
        screen.getByRole('alertdialog', { name: 'Delete 1 frame' }),
      ).getByRole('button', { name: 'Cancel' }),
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(service.deleted).toEqual([]);
  });

  test('closes the question on Esc, still selecting', async () => {
    await selectFramesOf(['2']);

    fireEvent.click(screen.getByRole('button', { name: 'Delete…' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  test('can’t delete until frames are selected', async () => {
    await selectFramesOf([]);

    expect(
      screen.getByRole('button', { name: 'Delete…' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  test('says when the roll changed elsewhere, keeping them', async () => {
    const service = await selectFramesOf(['1']);
    service.changeRoll(rollId);

    fireEvent.click(screen.getByRole('button', { name: 'Delete…' }));
    fireEvent.click(
      within(
        screen.getByRole('alertdialog', { name: 'Delete 1 frame' }),
      ).getByRole('button', { name: 'Delete' }),
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'This roll changed since you opened it.',
    );
    expect(service.deleted).toEqual([]);
  });
});

describe('deleting the roll', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', `/rolls/${rollId}`);
  });

  test('asks to confirm, saying how many frames go with it, then deletes it and opens the rolls page', async () => {
    const service = archiveWith([
      aFrameWithScan('1', '12340001.jpg'),
      aFrameWithScan('2', '12340002.jpg'),
    ]);
    renderPage(service);
    await chooseAction('Delete roll…');

    const confirm = screen.getByRole('alertdialog', {
      name: 'Delete roll 2026-014',
    });
    expect(confirm.textContent).toBe(
      'Delete this roll and its 2 frames?Delete rollCancel',
    );
    fireEvent.click(
      within(confirm).getByRole('button', { name: 'Delete roll' }),
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(service.rolls).toEqual([]);
    expect(service.ifMatches).toEqual(['"v1"']);
  });

  test('asks more simply for a roll with no frames', async () => {
    renderPage(archiveWith());
    await chooseAction('Delete roll…');

    expect(screen.getByRole('alertdialog').textContent).toBe(
      'Delete this roll?Delete rollCancel',
    );
  });

  test('keeps the roll on Cancel', async () => {
    const service = archiveWith();
    renderPage(service);
    await chooseAction('Delete roll…');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(service.rolls).toHaveLength(1);
  });

  test('refuses to delete a roll changed since the page loaded', async () => {
    const service = archiveWith();
    renderPage(service);
    await chooseAction('Delete roll…');
    service.changeRoll(rollId);

    fireEvent.click(screen.getByRole('button', { name: 'Delete roll' }));

    expect(
      await screen.findByText(/This roll changed since you opened it/),
    ).toBeDefined();
    expect(service.rolls).toHaveLength(1);
    expect(window.location.pathname).toBe(`/rolls/${rollId}`);
  });
});

describe('adding scans', () => {
  test('opens the drop zone from Add scans on a roll with frames, and closes it', async () => {
    renderPage(archiveWith([aFrameWithScan('1', '12340001.jpg')]));
    await screen.findByRole('button', { name: 'Actions' });
    expect(screen.queryByLabelText('Choose scans')).toBeNull();

    await chooseAction('Add scans');
    expect(screen.getByLabelText('Choose scans')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByLabelText('Choose scans')).toBeNull();
  });

  test('shows the drop zone straight away on a roll with no frames', async () => {
    renderPage(archiveWith());

    expect(await screen.findByLabelText('Choose scans')).toBeDefined();
  });
});

test('shows a thumbnail of each frame, labelled with its frame number', async () => {
  renderPage(
    archiveWith([
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

test('always shows frames in frame order, whatever order they were scanned in', async () => {
  renderPage(
    archiveWith([
      aFrameWithScan('3', '12340001.jpg'),
      aFrameWithScan('1', '12340002.jpg'),
      aFrameWithScan('2', '12340003.jpg'),
    ]),
  );

  expect(
    (await screen.findAllByRole('img')).map((img) => img.getAttribute('alt')),
  ).toEqual(['12340002.jpg', '12340003.jpg', '12340001.jpg']);
  expect(screen.queryByText('Scan order')).toBeNull();
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
    const service = archiveWith([aFrameWithScan('1', '12340001.jpg')]);
    renderPage(service);

    fireEvent.click(await numberButton('Change frame number 1'));
    typeNumber('12A');

    expect(await numberButton('Change frame number 12A')).toBeDefined();
    expect(framesOf(service)[0]?.number).toBe('12A');
    expect(service.ifMatches).toEqual(['"v1"']);
  });

  test('clears the number when it is emptied', async () => {
    const service = archiveWith([aFrameWithScan('1', '12340001.jpg')]);
    renderPage(service);

    fireEvent.click(await numberButton('Change frame number 1'));
    typeNumber('');

    expect(await numberButton('Set a frame number')).toBeDefined();
    expect(framesOf(service)[0]?.number).toBeNull();
  });

  test('changes nothing on Esc', async () => {
    const service = archiveWith([aFrameWithScan('1', '12340001.jpg')]);
    renderPage(service);

    fireEvent.click(await numberButton('Change frame number 1'));
    typeNumber('7', 'Escape');

    expect(await numberButton('Change frame number 1')).toBeDefined();
    expect(service.ifMatches).toEqual([]);
  });

  test('takes at most 9 characters', async () => {
    renderPage(archiveWith([aFrameWithScan('1', '12340001.jpg')]));

    fireEvent.click(await numberButton('Change frame number 1'));

    expect(
      screen.getByLabelText('Frame number').getAttribute('maxlength'),
    ).toBe('9');
  });

  test('refuses to overwrite a roll changed since the page loaded, and offers a reload', async () => {
    const service = archiveWith([aFrameWithScan('1', '12340001.jpg')]);
    renderPage(service);
    fireEvent.click(await numberButton('Change frame number 1'));
    // Someone else changes the roll, e.g. in another tab.
    service.changeRoll(rollId);

    typeNumber('2');

    expect(
      await screen.findByText('This roll changed since you opened it.'),
    ).toBeDefined();
    expect(framesOf(service)[0]?.number).toBe('1');
    expect(screen.getByLabelText<HTMLInputElement>('Frame number').value).toBe(
      '2',
    );
  });

  test('saves again after a reload, against the roll as it is now', async () => {
    const service = archiveWith([aFrameWithScan('1', '12340001.jpg')]);
    renderPage(service);
    fireEvent.click(await numberButton('Change frame number 1'));
    service.changeRoll(rollId);
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
    const archive = archiveWith([aFrameWithScan('1', '12340001.jpg')]);
    archive.failSaves();
    renderPage(archive);

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
    const service = archiveWith([
      aFrameWithScan('1', '12340001.jpg'),
      aFrameWithScan('2', '12340002.jpg'),
      aFrameWithScan('3', '12340003.jpg'),
    ]);
    renderPage(service);
    await chooseAction('Renumber…');
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
    expect(framesOf(service).map((f) => f.number)).toEqual(['3', '2', '1']);
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
    service.changeRoll(rollId);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('This roll changed since you opened it.'),
    ).toBeDefined();
    expect(framesOf(service).map((f) => f.number)).toEqual(['1', '2', '3']);
    expect(screen.getByLabelText<HTMLSelectElement>('Which scan').value).toBe(
      'last',
    );
  });

  test('says so when the numbers could not be saved', async () => {
    const archive = archiveWith([aFrameWithScan('1', '12340001.jpg')]);
    archive.failSaves();
    renderPage(archive);
    await chooseAction('Renumber…');

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

test('marks frames with details of their own, saying which', async () => {
  renderPage(
    archiveWith(
      [
        { ...aFrameWithScan('1', '12340001.jpg'), camera: 'leica-m6' },
        { ...aFrameWithScan('2', '12340002.jpg'), camera: 'nikon-fe' },
      ],
      { camera: 'nikon-fe' },
    ),
  );

  const [first, second] = await screen.findAllByRole('listitem');
  expect(
    within(first ?? document.body).getByText('Its own camera'),
  ).toBeDefined();
  // The same camera as the roll's is no difference worth marking.
  expect(within(second ?? document.body).queryByText(/^Its own/)).toBeNull();
});

test('shows pending and scanned marks, and counts only pending frames', async () => {
  const rawSource = aFrameWithScan('2', '12340002.jpg');
  const finalSource = aFrameWithScan('3', '12340003.jpg');
  const rawVersions: Frame['versions'] = rawSource.versions.map((version) => ({
    ...version,
    kind: 'raw-scan',
  }));
  const finalVersions: Frame['versions'] = finalSource.versions.map(
    (version) => ({
      ...version,
      kind: 'final',
    }),
  );
  renderPage(
    archiveWith([
      { ...aFrameWithScan('1', '12340001.jpg'), toScan: true },
      { ...rawSource, toScan: true, versions: rawVersions },
      { ...finalSource, toScan: true, versions: finalVersions },
    ]),
  );

  expect(await screen.findByText('3 frames (1 to scan)')).toBeDefined();
  const [pending, scannedRaw, scannedFinal] =
    await screen.findAllByRole('listitem');
  expect(
    pending?.querySelector('[title="To scan at higher resolution"]'),
  ).not.toBeNull();
  expect(
    pending
      ?.querySelector('[title="To scan at higher resolution"]')
      ?.classList.contains('scanned'),
  ).toBe(false);
  expect(
    scannedRaw
      ?.querySelector('[title="Scanned"]')
      ?.classList.contains('scanned'),
  ).toBe(true);
  expect(
    scannedFinal
      ?.querySelector('[title="Scanned"]')
      ?.classList.contains('scanned'),
  ).toBe(true);
});

test('marks a frame with notes, as it marks details of its own', async () => {
  renderPage(
    archiveWith([
      { ...aFrameWithScan('1', '12340001.jpg'), notes: 'Lens cap half on' },
    ]),
  );

  const [frame] = await screen.findAllByRole('listitem');
  expect(within(frame ?? document.body).getByText('Has notes')).toBeDefined();
});

test('marks a frame with more than one version, saying how many', async () => {
  const one = aFrameWithScan('1', '12340001.jpg');
  const [scan] = aFrameWithScan('2', '12340002.jpg').versions;
  const three = aFrameWithScan('2', '12340002.jpg');
  renderPage(
    archiveWith([
      one,
      {
        ...three,
        versions: [
          ...three.versions,
          ...(scan === undefined
            ? []
            : [
                { ...scan, id: '01JC8Z7K3M0000000000000002', sha256: 'raw' },
                { ...scan, id: '01JC8Z7K3M0000000000000003', sha256: 'final' },
              ]),
        ],
      },
    ]),
  );

  const [first, second] = await screen.findAllByRole('listitem');
  expect(within(second ?? document.body).getByText('3 versions')).toBeDefined();
  // A frame with just its scan has nothing to say.
  expect(within(first ?? document.body).queryByText(/versions$/)).toBeNull();
});

test('shows a frame’s rating as stars on its thumbnail, and none for a frame not rated', async () => {
  renderPage(
    archiveWith([
      { ...aFrameWithScan('1', '12340001.jpg'), rating: 4 },
      aFrameWithScan('2', '12340002.jpg'),
    ]),
  );

  const [rated, unrated] = await screen.findAllByRole('listitem');
  const stars = within(rated ?? document.body).getByText('Rated 4 of 5');
  expect(stars.closest('.frame-stars')?.textContent).toContain('★★★★');
  expect(within(unrated ?? document.body).queryByText(/^Rated/)).toBeNull();
});

test('hides the stars while selecting frames, and shows them again when done', async () => {
  renderPage(
    archiveWith([{ ...aFrameWithScan('1', '12340001.jpg'), rating: 4 }]),
  );
  await screen.findByText('Rated 4 of 5');

  await chooseAction('Bulk edit');
  expect(screen.queryByText('Rated 4 of 5')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(await screen.findByText('Rated 4 of 5')).toBeDefined();
});

test('shows the stars while renumbering', async () => {
  renderPage(
    archiveWith([{ ...aFrameWithScan('1', '12340001.jpg'), rating: 2 }]),
  );
  await screen.findByText('Rated 2 of 5');

  await chooseAction('Renumber…');

  expect(screen.getByText('Rated 2 of 5')).toBeDefined();
});

describe('rating from a thumbnail (FF-149)', () => {
  function twoFrames(): FakeArchive {
    return archiveWith([
      { ...aFrameWithScan('1', '12340001.jpg'), rating: 2 },
      aFrameWithScan('2', '12340002.jpg'),
    ]);
  }

  async function firstItem(): Promise<HTMLElement> {
    const [first] = await screen.findAllByRole('listitem');
    return first ?? document.body;
  }

  test('offers five stars to rate with, named for what a click does, and not in the Tab order', async () => {
    renderPage(twoFrames());
    const [first, second] = await screen.findAllByRole('listitem');

    const rated = within(
      within(first ?? document.body).getByRole('group', {
        name: 'Rated 2 of 5',
      }),
    ).getAllByRole('button');
    expect(rated.map((star) => star.getAttribute('aria-label'))).toEqual([
      'Rate 1 star',
      'Clear rating',
      'Rate 3 stars',
      'Rate 4 stars',
      'Rate 5 stars',
    ]);
    expect(rated.map((star) => star.classList.contains('filled'))).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(rated.every((star) => star.tabIndex === -1)).toBe(true);
    expect(
      within(
        within(second ?? document.body).getByRole('group', {
          name: 'Not rated',
        }),
      )
        .getAllByRole('button')
        .some((star) => star.classList.contains('filled')),
    ).toBe(false);
  });

  test('previews the rating a click would give while pointing at a star', async () => {
    renderPage(twoFrames());
    const first = await firstItem();
    const group = within(first).getByRole('group', { name: 'Rated 2 of 5' });

    fireEvent.mouseEnter(
      within(group).getByRole('button', { name: 'Rate 4 stars' }),
    );

    const stars = within(group).getAllByRole('button');
    expect(stars.map((star) => star.classList.contains('filled'))).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(stars.every((star) => star.classList.contains('previewing'))).toBe(
      true,
    );
    fireEvent.mouseLeave(group);
    expect(
      within(group)
        .getAllByRole('button')
        .map((star) => star.classList.contains('filled')),
    ).toEqual([true, true, false, false, false]);
  });

  test('rates the frame with a click, without opening it, saved against the roll’s version', async () => {
    const archive = twoFrames();
    renderPage(archive);
    const [, second] = await screen.findAllByRole('listitem');

    fireEvent.click(
      within(second ?? document.body).getByRole('button', {
        name: 'Rate 3 stars',
      }),
    );

    expect(await screen.findByText('Rated 3 of 5')).toBeDefined();
    await waitFor(() => {
      expect(framesOf(archive)[1]?.rating).toBe(3);
    });
    expect(archive.ifMatches).toEqual(['"v1"']);
    expect(window.location.pathname).toBe(`/rolls/${rollId}`);
  });

  test('clears the rating when the frame’s own rating is clicked', async () => {
    const archive = twoFrames();
    renderPage(archive);
    const first = await firstItem();

    fireEvent.click(
      within(first).getByRole('button', { name: 'Clear rating' }),
    );

    await waitFor(() => {
      expect(framesOf(archive)[0]?.rating).toBeNull();
    });
    expect(screen.queryByText('Rated 2 of 5')).toBeNull();
  });

  test('saves quick clicks on several frames one after another, against the version the last left', async () => {
    const archive = twoFrames();
    renderPage(archive);
    const [first, second] = await screen.findAllByRole('listitem');

    fireEvent.click(
      within(first ?? document.body).getByRole('button', {
        name: 'Rate 5 stars',
      }),
    );
    fireEvent.click(
      within(second ?? document.body).getByRole('button', {
        name: 'Rate 4 stars',
      }),
    );

    await waitFor(() => {
      expect(framesOf(archive).map((frame) => frame.rating)).toEqual([5, 4]);
    });
    expect(archive.ifMatches).toEqual(['"v1"', '"v2"']);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('puts the stars back and says so when the roll changed elsewhere', async () => {
    const archive = twoFrames();
    renderPage(archive);
    const first = await firstItem();
    archive.changeRoll(archive.rolls[0]?.id ?? '');

    fireEvent.click(
      within(first).getByRole('button', { name: 'Rate 5 stars' }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      "This roll changed since you opened it. The rating wasn't saved. Reload the page.",
    );
    expect(framesOf(archive)[0]?.rating).toBe(2);
    expect(await screen.findByText('Rated 2 of 5')).toBeDefined();
  });

  test('puts the stars back and says so when the save fails', async () => {
    const archive = twoFrames();
    renderPage(archive);
    const first = await firstItem();
    archive.failSaves();

    fireEvent.click(
      within(first).getByRole('button', { name: 'Rate 5 stars' }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      "Couldn't save the rating. Is the service running?",
    );
    expect(await screen.findByText('Rated 2 of 5')).toBeDefined();
  });

  test('can’t rate while renumbering or selecting frames', async () => {
    renderPage(twoFrames());
    await screen.findAllByRole('listitem');

    await chooseAction('Renumber…');
    expect(screen.queryByRole('button', { name: /^Rate \d/ })).toBeNull();
    expect(screen.getByText('Rated 2 of 5')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await chooseAction('Bulk edit');
    expect(screen.queryByRole('button', { name: /^Rate \d/ })).toBeNull();
  });
});

test('shows a placeholder for a frame with no scan', async () => {
  renderPage(
    archiveWith([
      {
        id: rollId.replace('01', '02'),
        number: '5',
        title: null,
        rating: null,
        notes: null,
        camera: null,
        lens: null,
        event: null,
        toScan: false,
        shot: null,
        defaultVersion: null,
        versions: [],
      },
    ]),
  );

  expect(await screen.findByText('No scan')).toBeDefined();
});

test('uploads each scan as a new frame, one at a time, in file name order', async () => {
  const service = archiveWith();
  renderPage(service);
  await screen.findByText('No frames yet.');

  chooseScans(aScan('12340002.jpg'), aScan('12340001.jpg'));

  expect(await screen.findByText('Uploaded 2 scans.')).toBeDefined();
  const [first, second] = framesOf(service).map((frame) => frame.id);
  expect(service.requests.filter((r) => r.startsWith('POST'))).toEqual([
    `POST /api/rolls/${rollId}/frames`,
    `POST /api/rolls/${rollId}/frames/${String(first)}/versions?file=12340001.jpg`,
    `POST /api/rolls/${rollId}/frames`,
    `POST /api/rolls/${rollId}/frames/${String(second)}/versions?file=12340002.jpg`,
  ]);
  expect(
    (await screen.findAllByRole('img')).map((img) => img.getAttribute('alt')),
  ).toEqual(['12340001.jpg', '12340002.jpg']);
});

test('numbers new frames in upload order, from 1 in an empty roll', async () => {
  const service = archiveWith();
  renderPage(service);
  await screen.findByText('No frames yet.');

  chooseScans(aScan('12340002.jpg'), aScan('12340001.jpg'));
  await screen.findByText('Uploaded 2 scans.');

  expect(framesOf(service).map((f) => f.number)).toEqual(['1', '2']);
});

test('numbers new frames on from the highest number in the roll', async () => {
  const service = archiveWith([
    aFrameWithScan('12A', '12340012.jpg'),
    aFrameWithScan('36', '12340036.jpg'),
    aFrameWithScan(null, '12340037.jpg'),
  ]);
  renderPage(service);
  await screen.findAllByRole('img');

  chooseScans(aScan('12340040.jpg'), aScan('12340041.jpg'));
  await screen.findByText('Uploaded 2 scans.');

  expect(framesOf(service).map((f) => f.number)).toEqual([
    '12A',
    '36',
    null,
    '37',
    '38',
  ]);
});

test('does not use up a number for a scan already in the roll', async () => {
  const service = archiveWith();
  renderPage(service);
  await screen.findByText('No frames yet.');
  chooseScans(aScan('12340001.jpg', 'same'));
  await screen.findByText('Uploaded 1 scan.');

  chooseScans(aScan('12340001.jpg', 'same'), aScan('12340002.jpg'));
  await screen.findByText('Uploaded 1 scan. 1 was already in the roll.');

  expect(framesOf(service).map((f) => f.number)).toEqual(['1', '2']);
});

test('accepts scans dropped onto the page', async () => {
  const service = archiveWith();
  renderPage(service);
  await screen.findByText('No frames yet.');

  fireEvent.drop(screen.getByText(/Drop individual scans/), {
    dataTransfer: { files: [aScan('12340001.jpg')] },
  });

  expect(await screen.findByText('Uploaded 1 scan.')).toBeDefined();
});

test('uploads the scans in a folder dropped onto the page', async () => {
  const service = archiveWith();
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

  fireEvent.drop(screen.getByText(/Drop individual scans/), {
    dataTransfer: {
      files: [],
      items: [{ kind: 'file', webkitGetAsEntry: () => folder }],
    },
  });

  expect(await screen.findByText('Uploaded 2 scans.')).toBeDefined();
});

test('says when a drop holds no scans', async () => {
  renderPage(archiveWith());
  await screen.findByText('No frames yet.');

  fireEvent.drop(screen.getByText(/Drop individual scans/), {
    dataTransfer: { files: [] },
  });

  expect(await screen.findByText(/No JPEG scans found/)).toBeDefined();
});

test('skips a scan that is already in the roll, without creating a frame', async () => {
  const service = archiveWith();
  renderPage(service);
  await screen.findByText('No frames yet.');
  chooseScans(aScan('12340001.jpg', 'same'));
  await screen.findByText('Uploaded 1 scan.');

  chooseScans(aScan('12340001.jpg', 'same'), aScan('12340002.jpg'));

  expect(
    await screen.findByText('Uploaded 1 scan. 1 was already in the roll.'),
  ).toBeDefined();
  expect(framesOf(service)).toHaveLength(2);
});

test('does not upload a file whose name the service would refuse', async () => {
  const service = archiveWith();
  renderPage(service);
  await screen.findByText('No frames yet.');

  chooseScans(aScan('scan 1.jpg'));

  expect(
    await screen.findByText(
      'Uploaded 0 scans. Not uploaded: scan 1.jpg (must be an image file name like 12340014.jpg, edit.png or DSC04412.ARW).',
    ),
  ).toBeDefined();
  expect(framesOf(service)).toHaveLength(0);
});

test('says when the roll does not exist', async () => {
  renderPage(fakeArchive());

  expect(await screen.findByText('There is no such roll.')).toBeDefined();
});

test('marks a roll as filed and shows a padlock on its heading, not its frames', async () => {
  const service = archiveWith([aFrameWithScan('1', '12340001.jpg')]);
  renderPage(service);

  await chooseAction('Mark as filed');

  const padlocks = await screen.findAllByRole('img', { name: 'Filed' });
  expect(padlocks).toHaveLength(1);
  expect(padlocks[0]?.closest('h1')).not.toBeNull();
});

test('asks before unmarking a filed roll and then removes its padlock', async () => {
  const service = archiveWith([], { filed: true });
  renderPage(service);
  await chooseAction('Unmark as filed…');

  const confirmation = await screen.findByRole('alertdialog', {
    name: 'Unmark as filed',
  });
  expect(confirmation.textContent).toContain(
    "Only unmark it if its negatives aren't filed under this number.",
  );
  fireEvent.click(
    within(confirmation).getByRole('button', { name: 'Unmark as filed' }),
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Actions' }));
  expect(
    await screen.findByRole('menuitem', { name: 'Mark as filed' }),
  ).toBeDefined();
  expect(screen.queryByRole('img', { name: 'Filed' })).toBeNull();
});

test('cancelling the unmark confirmation keeps the roll filed', async () => {
  const service = archiveWith([], { filed: true });
  renderPage(service);
  await chooseAction('Unmark as filed…');

  const confirmation = await screen.findByRole('alertdialog', {
    name: 'Unmark as filed',
  });
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));

  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getByRole('img', { name: 'Filed' })).toBeDefined();
  fireEvent.click(await screen.findByRole('button', { name: 'Actions' }));
  expect(
    await screen.findByRole('menuitem', { name: 'Unmark as filed…' }),
  ).toBeDefined();
});

test('shows a filed roll number as read-only in Edit details', async () => {
  renderPage(archiveWith([], { filed: true }));
  await chooseAction('Edit details');

  const note = screen.getByText('Filed: unmark it to change the number.');
  const filedNumber = note.parentElement?.querySelector('.filed-roll-number');
  expect(filedNumber?.textContent).toBe('2026-014');
  expect(
    filedNumber?.querySelector('[role="img"][aria-label="Filed"]'),
  ).not.toBeNull();
  expect(screen.queryByRole('textbox', { name: 'Roll number' })).toBeNull();
});

test('says when filing is refused because the roll changed elsewhere', async () => {
  const service = archiveWith();
  renderPage(service);
  service.changeRoll(rollId);

  await chooseAction('Mark as filed');

  expect((await screen.findByRole('alert')).textContent).toContain(
    'This roll changed since you opened it.',
  );
});
