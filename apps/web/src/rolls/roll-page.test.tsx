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
import { afterEach, describe, expect, test } from 'vitest';
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

function chooseScans(...files: File[]) {
  // On a roll with frames, the drop zone opens from Add scans.
  if (screen.queryByLabelText('Choose scans') === null) {
    fireEvent.click(screen.getByRole('button', { name: 'Add scans' }));
  }
  fireEvent.change(screen.getByLabelText('Choose scans'), {
    target: { files },
  });
}

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

test('shows the roll’s name, camera, lens, film stock, date shot and description', async () => {
  renderPage(
    archiveWith(
      [],
      {
        name: 'Iceland, first day',
        description: 'Jökulsárlón at dawn.',
        shot: '2026-09-14T06:30',
        camera: 'nikon-fe',
        film: 'kodak-portra-400',
        lens: 'zeiss-planar-80mm-f-2-8',
      },
      { cameras: [nikonFe], films: [portra], lenses: [planar] },
    ),
  );

  expect(await screen.findByText('Iceland, first day')).toBeDefined();
  expect(await screen.findByText('Nikon FE')).toBeDefined();
  expect(await screen.findByText('Kodak Portra 400')).toBeDefined();
  expect(await screen.findByText('Zeiss Planar 80mm f/2.8')).toBeDefined();
  expect(details()).toEqual([
    ['Camera', 'Nikon FE'],
    ['Lens', 'Zeiss Planar 80mm f/2.8'],
    ['Film stock', 'Kodak Portra 400'],
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
    description: 'Jökulsárlón at dawn.',
    shot: '2026-09-14',
  };

  async function editDetails() {
    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit details' }),
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

  /** Chooses an option in a dropdown by the text it shows. */
  function choose(label: string, option: string) {
    const select = field(label);
    const chosen = within(select).getByRole<HTMLOptionElement>('option', {
      name: option,
    });
    fireEvent.change(select, { target: { value: chosen.value } });
  }

  test('opens with the roll’s details filled in', async () => {
    renderPage(archiveWith([], iceland));
    await editDetails();

    expect(field('Name').value).toBe('Iceland');
    expect(field('Description').value).toBe('Jökulsárlón at dawn.');
    expect(field('Year').value).toBe('2026');
    expect(field('Month').value).toBe('09');
    expect(field('Day').value).toBe('14');
    expect(field('Time').value).toBe('');
    expect(
      screen
        .getByRole('button', { name: 'Edit details' })
        .getAttribute('aria-expanded'),
    ).toBe('true');
  });

  test('saves the details, sending the roll’s ETag, and shows them', async () => {
    const service = archiveWith([], iceland);
    renderPage(service);
    await editDetails();

    fill('Name', 'Westfjords');
    fill('Description', '');
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

describe('adding scans', () => {
  test('opens the drop zone from Add scans on a roll with frames', async () => {
    renderPage(archiveWith([aFrameWithScan('1', '12340001.jpg')]));
    const addScans = await screen.findByRole('button', { name: 'Add scans' });
    expect(screen.queryByLabelText('Choose scans')).toBeNull();
    expect(addScans.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(addScans);

    expect(screen.getByLabelText('Choose scans')).toBeDefined();
    expect(addScans.getAttribute('aria-expanded')).toBe('true');
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

test('shows frames in frame order, or in scan order when chosen', async () => {
  renderPage(
    archiveWith([
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
    archiveWith([
      { id: rollId.replace('01', '02'), number: '5', versions: [] },
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
      'Uploaded 0 scans. Not uploaded: scan 1.jpg (must be a JPEG file name like 12340014.jpg).',
    ),
  ).toBeDefined();
  expect(framesOf(service)).toHaveLength(0);
});

test('says when the roll does not exist', async () => {
  renderPage(fakeArchive());

  expect(await screen.findByText('There is no such roll.')).toBeDefined();
});
