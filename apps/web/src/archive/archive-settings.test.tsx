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
  setUpArchive,
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
    'asks for the archive to be set up first, at %s',
    async (path) => {
      openAt(path, { settings: null, rolls: [aRoll('2026-014')] });

      expect(
        await screen.findByRole('heading', { name: 'Set up your archive' }),
      ).toBeDefined();
      expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    },
  );

  test('sets it up with its name, author and copyright, then shows the page asked for', async () => {
    const archive = openAt('/events', { settings: null });
    const form = await screen.findByRole('form', {
      name: 'Set up your archive',
    });

    fill(form, 'Name', 'Ben’s film archive');
    fill(form, 'Author', 'Ben Pirt');
    fill(form, 'Copyright', '© Ben Pirt');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Set up archive' }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Events' }),
    ).toBeDefined();
    expect(archive.settings()).toMatchObject({
      name: 'Ben’s film archive',
      author: 'Ben Pirt',
      copyright: '© Ben Pirt',
    });
  });

  test('leaves the author and copyright out when they’re blank', async () => {
    const archive = openAt('/', { settings: null });
    const form = await screen.findByRole('form', {
      name: 'Set up your archive',
    });

    fill(form, 'Name', 'Film');
    fireEvent.click(
      within(form).getByRole('button', { name: 'Set up archive' }),
    );

    await screen.findByRole('heading', { level: 1, name: 'Rolls' });
    expect(archive.settings()).toMatchObject({
      name: 'Film',
      author: null,
      copyright: null,
    });
  });

  test('asks for a name before setting it up', async () => {
    const archive = openAt('/', { settings: null });
    const form = await screen.findByRole('form', {
      name: 'Set up your archive',
    });

    fireEvent.click(
      within(form).getByRole('button', { name: 'Set up archive' }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Enter a name for the archive.',
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
        "Couldn't load the archive. Is the service running?",
      ),
    ).toBeDefined();
  });
});

describe('the settings page', () => {
  const settings = {
    ...setUpArchive,
    name: 'Film',
    author: 'Ben',
    copyright: '© Ben',
  };

  test('opens from the header, showing the archive’s details', async () => {
    openAt('/', { settings });

    fireEvent.click(await screen.findByRole('link', { name: 'Settings' }));

    const form = await screen.findByRole('form', { name: 'Settings' });
    expect(
      within(form).getByLabelText('Name', { exact: false }),
    ).toHaveProperty('value', 'Film');
    expect(within(form).getByLabelText('Author')).toHaveProperty(
      'value',
      'Ben',
    );
    expect(within(form).getByLabelText('Copyright')).toHaveProperty(
      'value',
      '© Ben',
    );
  });

  test('saves changes with the archive’s ETag, clearing what’s left blank', async () => {
    const archive = openAt('/settings', { settings });
    const form = await screen.findByRole('form', { name: 'Settings' });

    fill(form, 'Author', 'Ben Pirt');
    fill(form, 'Copyright', '');
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('status')).textContent).toBe('Saved.');
    expect(archive.settings()).toMatchObject({
      name: 'Film',
      author: 'Ben Pirt',
      copyright: null,
    });
    expect(archive.ifMatches).toEqual(['"v1"']);
  });

  test('asks for a name rather than clearing it', async () => {
    const archive = openAt('/settings', { settings });
    const form = await screen.findByRole('form', { name: 'Settings' });

    fill(form, 'Name', ' ');
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Enter a name for the archive.',
    );
    expect(archive.ifMatches).toEqual([]);
  });

  test('says when the settings changed elsewhere, keeping them', async () => {
    const archive = openAt('/settings', { settings });
    const form = await screen.findByRole('form', { name: 'Settings' });
    archive.changeArchive();

    fill(form, 'Author', 'Someone else');
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The settings changed since you opened them. Reload the page.',
    );
    expect(archive.settings()?.author).toBe('Ben');
  });
});
