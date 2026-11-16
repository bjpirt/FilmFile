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
import { afterEach, describe, expect, test } from 'vitest';
import {
  aFrame,
  aRoll,
  fakeArchive,
  setUpSettings,
  type ArchiveContents,
  type FakeArchive,
} from '../testing/fake-archive.ts';
import { publishedTime } from './published-time.ts';
import { SitePage } from './site-page.tsx';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const target = { bucket: 'photos-pirt', address: 'https://photos.example.com' };
const withAccount = {
  ...setUpSettings,
  cloudflareAccountId: '0123456789abcdef0123456789abcdef',
};
const publishedAt = '2026-11-13T14:02:00.000Z';

function archiveWith(
  extra: ArchiveContents = {},
  site: { readonly publish?: typeof target | null } = { publish: target },
) {
  return fakeArchive({
    rolls: [
      aRoll('2026-001', {
        frames: [aFrame('1', '12340001.jpg'), aFrame('2', '12340002.jpg')],
      }),
    ],
    sites: [
      {
        id: '01JC8Z7K3M00000000000000S1',
        slug: 'iceland',
        name: 'Iceland',
        selection: { rules: [], excluded: [] },
        ...site,
      },
    ],
    settings: withAccount,
    ...extra,
  });
}

function renderPage(archive: FakeArchive) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SitePage api={archive.api} slug="iceland" />
    </QueryClientProvider>,
  );
}

const section = () => screen.findByRole('region', { name: 'Publish' });
const button = (name: string) => screen.getByRole('button', { name });
const isDisabled = (name: string) => button(name).hasAttribute('disabled');

function fillTarget(bucket: string, address: string) {
  const form = screen.getByRole('form', { name: 'Where to publish' });
  fireEvent.change(within(form).getByLabelText('Bucket'), {
    target: { value: bucket },
  });
  fireEvent.change(within(form).getByLabelText('Address'), {
    target: { value: address },
  });
  return within(form).getByRole('button', { name: 'Save' });
}

describe('where a site is published', () => {
  test('with no target, says where to publish it, and nothing can be published', async () => {
    renderPage(archiveWith({}, { publish: null }));
    const publish = await section();

    expect(
      within(publish).getByText('Say where to publish the site.'),
    ).toBeTruthy();
    expect(
      within(publish).getByText(
        "Use a bucket only for this site: files it doesn't have are removed.",
      ),
    ).toBeTruthy();
    expect(isDisabled('Publish')).toBe(true);
    expect(isDisabled('Unpublish…')).toBe(true);
    expect(
      within(publish)
        .getByRole('link', { name: 'How to set up Cloudflare' })
        .getAttribute('href'),
    ).toBe(
      'https://github.com/bjpirt/FilmFile/blob/main/docs/publishing-to-cloudflare.md',
    );
  });

  test('saves the bucket and address together with Save, enabled once both are filled', async () => {
    const archive = archiveWith({}, { publish: null });
    renderPage(archive);
    await section();
    const save = fillTarget('photos-pirt', '');
    expect(save.hasAttribute('disabled')).toBe(true);

    fillTarget(' photos-pirt ', 'https://photos.example.com');
    expect(save.hasAttribute('disabled')).toBe(false);
    fireEvent.click(save);

    expect(await screen.findByText('Not published')).toBeTruthy();
    expect(archive.siteUpdates.at(-1)?.body).toEqual({ publish: target });
    expect(isDisabled('Publish')).toBe(false);
  });

  test('takes the target away when both fields are emptied and saved', async () => {
    const archive = archiveWith();
    renderPage(archive);
    await screen.findByText('Not published');

    fireEvent.click(fillTarget('', ''));

    expect(
      await screen.findByText('Say where to publish the site.'),
    ).toBeTruthy();
    expect(archive.siteUpdates.at(-1)?.body).toEqual({ publish: null });
  });

  test('says why a field is refused, in the service’s words, and keeps what was saved', async () => {
    const archive = archiveWith({}, { publish: null });
    renderPage(archive);
    await section();

    fireEvent.click(fillTarget('photos-pirt', 'http://photos.example.com'));

    expect(
      await screen.findByText('The address must be an https:// address.'),
    ).toBeTruthy();
    expect(archive.sites[0]?.publish).toBeNull();
    expect(screen.getByText('Say where to publish the site.')).toBeTruthy();
  });

  test('says the site stays in the old bucket when a published site moves to another', async () => {
    renderPage(
      archiveWith({
        sitePublished: {
          iceland: { stands: 'up-to-date', publishedAt, filesInBucket: 5 },
        },
      }),
    );
    await screen.findByText(
      `Published ${publishedTime(publishedAt)}, up to date`,
    );

    fireEvent.click(fillTarget('photos-new', 'https://photos.example.com'));

    expect(
      await screen.findByText(
        'The site stays in photos-pirt until you empty it in Cloudflare.',
      ),
    ).toBeTruthy();
  });
});

describe('how the bucket stands', () => {
  test.each([
    [{ stands: 'not-published' as const }, 'Not published'],
    [
      { stands: 'not-built' as const },
      'Not built yet: Publish builds it first.',
    ],
    [
      { stands: 'up-to-date' as const, publishedAt, filesInBucket: 3 },
      `Published ${publishedTime(publishedAt)}, up to date`,
    ],
    [
      {
        stands: 'needs-update' as const,
        publishedAt,
        filesToUpdate: 12,
        filesInBucket: 3,
      },
      `Published ${publishedTime(publishedAt)}: 12 files to update`,
    ],
    [
      {
        stands: 'needs-update' as const,
        publishedAt,
        filesToUpdate: 1,
        filesInBucket: 3,
      },
      `Published ${publishedTime(publishedAt)}: 1 file to update`,
    ],
  ])('shows %o as “%s”', async (stated, text) => {
    renderPage(archiveWith({ sitePublished: { iceland: stated } }));

    expect(await screen.findByText(text)).toBeTruthy();
  });

  test('without an account ID in Settings, says so with a link there, and nothing can be published', async () => {
    renderPage(archiveWith({ settings: setUpSettings }));

    expect(
      await screen.findByText('Set your Cloudflare account ID in Settings.', {
        exact: false,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Open Settings' }).getAttribute('href'),
    ).toBe('/settings');
    expect(isDisabled('Publish')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull();
  });

  test('when the bucket can’t be asked, says why with “Check again”, and Publish stays enabled', async () => {
    const archive = archiveWith();
    archive.failCheck({
      failure: 'unreachable',
      message: "Couldn't reach Cloudflare. Are you online?",
    });
    renderPage(archive);

    expect((await screen.findByRole('alert')).textContent).toBe(
      "Couldn't reach Cloudflare. Are you online?",
    );
    expect(screen.queryByRole('link', { name: 'Open Settings' })).toBeNull();
    expect(isDisabled('Publish')).toBe(false);

    archive.failCheck(null);
    fireEvent.click(button('Check again'));
    expect(await screen.findByText('Not published')).toBeTruthy();
  });

  test('links to Settings when the keys are what is missing', async () => {
    const archive = archiveWith();
    archive.failCheck({
      failure: 'no-credentials',
      message:
        "No [filmfile] profile in ~/.aws/credentials, so the site can't be published.",
    });
    renderPage(archive);

    expect(
      await screen.findByRole('link', { name: 'Open Settings' }),
    ).toBeTruthy();
  });
});

describe('publishing', () => {
  test('shows the build, then the upload, then that it is up to date, and offers View site', async () => {
    const archive = archiveWith({
      sitePublishStates: [
        { state: 'running', phase: 'building', done: 1, total: 4 },
        { state: 'running', phase: 'uploading', done: 12, total: 40 },
        { state: 'running', phase: 'removing', done: 0, total: 3 },
        { state: 'done' },
      ],
    });
    renderPage(archive);
    await screen.findByText('Not published');
    expect(screen.queryByRole('link', { name: 'View site' })).toBeNull();

    fireEvent.click(button('Publish'));

    expect(await screen.findByText('Making images: 1 of 4')).toBeTruthy();
    expect(button('Cancel')).toBeTruthy();
    expect(
      await screen.findByText('Uploading 12 of 40', {}, { timeout: 3000 }),
    ).toBeTruthy();
    expect(
      await screen.findByText('Removing old files: 3', {}, { timeout: 3000 }),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        `Published ${publishedTime(publishedAt)}, up to date`,
        {},
        { timeout: 3000 },
      ),
    ).toBeTruthy();
    expect(archive.sitePublishes).toEqual(['iceland']);
    const view = screen.getByRole('link', { name: 'View site' });
    expect(view.getAttribute('href')).toBe('https://photos.example.com');
    expect(view.getAttribute('target')).toBe('_blank');
  });

  test('Cancel stops it, and it then says so', async () => {
    const archive = archiveWith({
      sitePublishStates: [
        { state: 'running', phase: 'uploading', done: 1, total: 40 },
        { state: 'cancelled' },
      ],
    });
    renderPage(archive);
    await screen.findByText('Not published');
    fireEvent.click(button('Publish'));
    await screen.findByText('Uploading 1 of 40');

    fireEvent.click(button('Cancel'));

    expect(
      await screen.findByText('Publishing cancelled.', {}, { timeout: 3000 }),
    ).toBeTruthy();
    expect(archive.sitePublishesCancelled).toEqual(['iceland']);
  });

  test('a failed publish says what to fix, that what was uploaded stays, and links to Settings for the keys', async () => {
    renderPage(
      archiveWith({
        sitePublishStates: [
          {
            state: 'failed',
            failure: 'keys-refused',
            message: 'Cloudflare refused the keys in the [filmfile] profile.',
          },
        ],
      }),
    );
    await screen.findByText('Not published');

    fireEvent.click(button('Publish'));

    expect(
      await screen.findByText(
        'Cloudflare refused the keys in the [filmfile] profile. Files already uploaded stay.',
        { exact: false },
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Settings' })).toBeTruthy();
  });

  test('a publish stopped because the site could not be built says only that', async () => {
    renderPage(
      archiveWith({
        sitePublishStates: [
          {
            state: 'failed',
            failure: 'build-failed',
            message: "Couldn't build the site, so it wasn't published.",
          },
        ],
      }),
    );
    await screen.findByText('Not published');

    fireEvent.click(button('Publish'));

    expect(
      (
        await screen.findByText(
          "Couldn't build the site, so it wasn't published.",
        )
      ).textContent,
    ).toBe("Couldn't build the site, so it wasn't published.");
  });

  test('asks first before publishing a site with no frames', async () => {
    const archive = archiveWith({ rolls: [] });
    renderPage(archive);
    await screen.findByText('Not published');
    await screen.findByText('No frames match');

    fireEvent.click(button('Publish'));
    const asking = await screen.findByRole('alertdialog', {
      name: 'Publish an empty site',
    });

    expect(asking.textContent).toContain(
      'This site has no frames. Publish it anyway? Everything else in photos-pirt is removed.',
    );
    expect(document.activeElement?.textContent).toBe('Cancel');
    fireEvent.click(within(asking).getByRole('button', { name: 'Cancel' }));
    expect(archive.sitePublishes).toEqual([]);

    fireEvent.click(button('Publish'));
    fireEvent.click(
      within(
        await screen.findByRole('alertdialog', {
          name: 'Publish an empty site',
        }),
      ).getByRole('button', { name: 'Publish' }),
    );
    await waitFor(() => {
      expect(archive.sitePublishes).toEqual(['iceland']);
    });
  });
});

describe('unpublishing', () => {
  const published = {
    sitePublished: {
      iceland: {
        stands: 'up-to-date' as const,
        publishedAt,
        filesInBucket: 2104,
      },
    },
  };

  test('asks first, naming how many files go from which bucket, then says it is not published', async () => {
    const archive = archiveWith(published);
    renderPage(archive);
    await screen.findByText(
      `Published ${publishedTime(publishedAt)}, up to date`,
    );

    fireEvent.click(button('Unpublish…'));
    const asking = screen.getByRole('alertdialog', {
      name: 'Unpublish Iceland',
    });

    expect(asking.textContent).toContain(
      'Unpublish Iceland? This removes 2,104 files from photos-pirt.',
    );
    expect(document.activeElement?.textContent).toBe('Cancel');
    fireEvent.click(within(asking).getByRole('button', { name: 'Unpublish' }));

    expect(await screen.findByText('Not published')).toBeTruthy();
    expect(archive.siteUnpublishes).toEqual(['iceland']);
    expect(isDisabled('Unpublish…')).toBe(true);
  });

  test('is disabled with nothing published', async () => {
    renderPage(archiveWith());
    await screen.findByText('Not published');

    expect(isDisabled('Unpublish…')).toBe(true);
  });

  test('says why when it fails', async () => {
    const archive = archiveWith(published);
    archive.failUnpublish({
      error: "Couldn't reach Cloudflare. Are you online?",
      reason: 'unreachable',
    });
    renderPage(archive);
    await screen.findByText(
      `Published ${publishedTime(publishedAt)}, up to date`,
    );

    fireEvent.click(button('Unpublish…'));
    fireEvent.click(
      within(
        screen.getByRole('alertdialog', { name: 'Unpublish Iceland' }),
      ).getByRole('button', { name: 'Unpublish' }),
    );

    expect(
      await screen.findByText("Couldn't reach Cloudflare. Are you online?"),
    ).toBeTruthy();
  });
});

describe('what can’t happen together', () => {
  test('Publish and Unpublish wait while the site is built', async () => {
    renderPage(
      archiveWith({
        ...{
          sitePublished: {
            iceland: {
              stands: 'up-to-date' as const,
              publishedAt,
              filesInBucket: 3,
            },
          },
        },
        siteBuildStates: [{ state: 'running', done: 1, total: 4 }],
      }),
    );
    await screen.findByText(
      `Published ${publishedTime(publishedAt)}, up to date`,
    );

    fireEvent.click(button('Build site'));
    await screen.findByText('Making images: 1 of 4');

    expect(isDisabled('Publish')).toBe(true);
    expect(isDisabled('Unpublish…')).toBe(true);
  });

  test('Build waits while the site is published', async () => {
    renderPage(
      archiveWith({
        sitePublishStates: [
          { state: 'running', phase: 'uploading', done: 1, total: 40 },
        ],
      }),
    );
    await screen.findByText('Not published');

    fireEvent.click(button('Publish'));
    await screen.findByText('Uploading 1 of 40');

    expect(isDisabled('Build site')).toBe(true);
  });

  test('Build and Publish wait while the site is unpublished', async () => {
    const archive = archiveWith({
      sitePublished: {
        iceland: { stands: 'up-to-date', publishedAt, filesInBucket: 3 },
      },
    });
    const release = archive.holdUnpublishes();
    renderPage(archive);
    await screen.findByText(
      `Published ${publishedTime(publishedAt)}, up to date`,
    );

    fireEvent.click(button('Unpublish…'));
    fireEvent.click(
      within(
        screen.getByRole('alertdialog', { name: 'Unpublish Iceland' }),
      ).getByRole('button', { name: 'Unpublish' }),
    );

    expect(await screen.findByText('Unpublishing…')).toBeTruthy();
    expect(isDisabled('Build site')).toBe(true);
    expect(isDisabled('Publish')).toBe(true);
    release();
    expect(await screen.findByText('Not published')).toBeTruthy();
  });
});
