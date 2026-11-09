// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { App } from '../app.tsx';
import {
  aRoll,
  fakeArchive,
  setUpSettings,
  type ArchiveContents,
  type FakeArchive,
} from '../testing/fake-archive.ts';

afterEach(cleanup);

function openAt(path: string, contents: ArchiveContents = {}): FakeArchive {
  window.history.pushState(null, '', path);
  const archive = fakeArchive(contents);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <App api={archive.api} />
    </QueryClientProvider>,
  );
  return archive;
}

function fill(form: HTMLElement, label: string, value: string) {
  fireEvent.change(within(form).getByLabelText(label, { exact: false }), {
    target: { value },
  });
}

describe('first-run setup', () => {
  test.each(['/', '/events', `/rolls/${aRoll('2026-014').id}`])(
    'asks for FilmFile to be set up first, at %s',
    async (path) => {
      openAt(path, { settings: null, rolls: [aRoll('2026-014')] });

      expect(
        await screen.findByRole('heading', { name: 'Set up FilmFile' }),
      ).toBeDefined();
      expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    },
  );

  test('sets it up with its author and a copyright made from it, then shows the page asked for', async () => {
    const archive = openAt('/events', { settings: null });
    const form = await screen.findByRole('form', {
      name: 'Set up FilmFile',
    });

    fill(form, 'Author', 'Ben Pirt');
    expect(within(form).getByLabelText('Copyright')).toHaveProperty(
      'value',
      '© Ben Pirt. All rights reserved.',
    );
    fireEvent.click(within(form).getByRole('button', { name: 'Set up' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Events' }),
    ).toBeDefined();
    expect(archive.settings()).toMatchObject({
      author: 'Ben Pirt',
      copyright: '© Ben Pirt. All rights reserved.',
    });
  });

  test('keeps a copyright written by hand when the author changes', async () => {
    openAt('/', { settings: null });
    const form = await screen.findByRole('form', {
      name: 'Set up FilmFile',
    });

    fill(form, 'Author', 'Ben');
    fill(form, 'Copyright', '© 2026 Ben Pirt');
    fill(form, 'Author', 'Ben Pirt');

    expect(within(form).getByLabelText('Copyright')).toHaveProperty(
      'value',
      '© 2026 Ben Pirt',
    );
  });

  test('leaves the copyright out when it’s cleared', async () => {
    const archive = openAt('/', { settings: null });
    const form = await screen.findByRole('form', {
      name: 'Set up FilmFile',
    });

    fill(form, 'Author', 'Ben Pirt');
    fill(form, 'Copyright', '');
    fireEvent.click(within(form).getByRole('button', { name: 'Set up' }));

    await screen.findByRole('heading', { level: 1, name: 'Rolls' });
    expect(archive.settings()).toMatchObject({
      author: 'Ben Pirt',
      copyright: null,
    });
  });

  test('asks for an author before setting it up', async () => {
    const archive = openAt('/', { settings: null });
    const form = await screen.findByRole('form', {
      name: 'Set up FilmFile',
    });

    fireEvent.click(within(form).getByRole('button', { name: 'Set up' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Enter who the photographs are by.',
    );
    expect(archive.settings()).toBeNull();
  });

  test('says when the service can’t be reached', async () => {
    window.history.pushState(null, '', '/');
    const archive = fakeArchive();
    archive.stop();
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <App api={archive.api} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText(
        "Couldn't load the settings. Is the service running?",
      ),
    ).toBeDefined();
  });
});

describe('the settings page', () => {
  const settings = {
    ...setUpSettings,
    author: 'Ben',
    copyright: '© Ben. All rights reserved.',
  };

  test('opens from the header, showing the author and copyright', async () => {
    openAt('/', { settings });

    fireEvent.click(await screen.findByRole('link', { name: 'Settings' }));

    const form = await screen.findByRole('form', { name: 'Settings' });
    expect(
      within(form).getByLabelText('Author', { exact: false }),
    ).toHaveProperty('value', 'Ben');
    expect(within(form).getByLabelText('Copyright')).toHaveProperty(
      'value',
      '© Ben. All rights reserved.',
    );
  });

  test('saves changes with the settings’ ETag, the copyright following the author, then shows the rolls', async () => {
    const archive = openAt('/settings', { settings });
    const form = await screen.findByRole('form', { name: 'Settings' });

    fill(form, 'Author', 'Ben Pirt');
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Rolls' }),
    ).toBeDefined();
    expect(window.location.pathname).toBe('/');
    expect(archive.settings()).toMatchObject({
      author: 'Ben Pirt',
      copyright: '© Ben Pirt. All rights reserved.',
    });
    expect(archive.ifMatches).toEqual(['"v1"']);
  });

  test('shows where the FilmFile folder is, and how to change it', async () => {
    openAt('/settings', { settings });

    expect(
      await screen.findByRole('heading', { name: 'FilmFile folder' }),
    ).toBeDefined();
    expect(screen.getByText(settings.folder)).toBeDefined();
    expect(
      screen.getByText(
        'Change it in the app with File › Open FilmFile Folder…, or set FILMFILE_FOLDER and restart.',
      ),
    ).toBeDefined();
  });

  test('leaves a copyright of its own alone when the author changes', async () => {
    openAt('/settings', {
      settings: { ...settings, copyright: '© 2026 Ben' },
    });
    const form = await screen.findByRole('form', { name: 'Settings' });

    fill(form, 'Author', 'Ben Pirt');

    expect(within(form).getByLabelText('Copyright')).toHaveProperty(
      'value',
      '© 2026 Ben',
    );
  });

  test('asks for an author rather than clearing it', async () => {
    const archive = openAt('/settings', { settings });
    const form = await screen.findByRole('form', { name: 'Settings' });

    fill(form, 'Author', ' ');
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Enter who the photographs are by.',
    );
    expect(archive.ifMatches).toEqual([]);
  });

  test('says when the settings changed elsewhere, keeping them', async () => {
    const archive = openAt('/settings', { settings });
    const form = await screen.findByRole('form', { name: 'Settings' });
    archive.changeSettings();

    fill(form, 'Author', 'Someone else');
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The settings changed since you opened them. Reload the page.',
    );
    expect(archive.settings()?.author).toBe('Ben');
  });
});

describe('the roll number pattern (D88)', () => {
  const settings = { ...setUpSettings, author: 'Ben' };

  async function patternForm() {
    return await screen.findByRole('form', { name: 'Roll number pattern' });
  }

  test('shows the pattern with an example of it', async () => {
    openAt('/settings', { settings });
    const form = await patternForm();

    expect(within(form).getByLabelText('Pattern')).toHaveProperty(
      'value',
      '{year}-{n:3}',
    );
    expect(within(form).getByRole('status').textContent).toBe(
      'Example: 2026-014',
    );
  });

  test('previews a pattern as it is typed, and says why one is not valid', async () => {
    openAt('/settings', { settings });
    const form = await patternForm();

    fill(form, 'Pattern', 'BP-{year}{month}-{n:2}');
    expect(within(form).getByRole('status').textContent).toBe(
      'Example: BP-202609-14',
    );

    fill(form, 'Pattern', '{year}');
    expect(within(form).getByRole('status').textContent).toBe(
      'The pattern needs a sequence number like {n:3}.',
    );
  });

  test('saves on its own, staying on the page and leaving the author alone', async () => {
    const archive = openAt('/settings', { settings });
    const form = await patternForm();

    fill(form, 'Pattern', 'BP-{year}-{n:2}');
    fireEvent.click(within(form).getByRole('button', { name: 'Save pattern' }));

    expect(
      await within(form).findByText('Saved the roll number pattern.'),
    ).toBeDefined();
    expect(window.location.pathname).toBe('/settings');
    expect(archive.settings()).toMatchObject({
      author: 'Ben',
      rollNumberPattern: 'BP-{year}-{n:2}',
    });
    expect(archive.ifMatches).toEqual(['"v1"']);
  });

  test('refuses a pattern that is not valid without saving', async () => {
    const archive = openAt('/settings', { settings });
    const form = await patternForm();

    fill(form, 'Pattern', '{n:3}{n:3}');
    fireEvent.click(within(form).getByRole('button', { name: 'Save pattern' }));

    expect((await within(form).findByRole('alert')).textContent).toBe(
      'The pattern can have only one sequence number like {n:3}.',
    );
    expect(archive.ifMatches).toEqual([]);
  });

  test('says when a roll lacks what the pattern needs, changing nothing', async () => {
    const archive = openAt('/settings', {
      settings,
      rolls: [aRoll('2026-014', { shot: '2026' })],
    });
    const form = await patternForm();

    fill(form, 'Pattern', '{year}{month}-{n:3}');
    fireEvent.click(within(form).getByRole('button', { name: 'Save pattern' }));

    expect((await within(form).findByRole('alert')).textContent).toBe(
      'The pattern needs a shot month on every roll.',
    );
    expect(archive.settings()?.rollNumberPattern).toBe('{year}-{n:3}');
  });

  test('says when the settings changed elsewhere', async () => {
    const archive = openAt('/settings', { settings });
    const form = await patternForm();
    archive.changeSettings();

    fill(form, 'Pattern', '{n:4}');
    fireEvent.click(within(form).getByRole('button', { name: 'Save pattern' }));

    expect((await within(form).findByRole('alert')).textContent).toBe(
      'The settings changed since you opened them. Reload the page.',
    );
  });
});
