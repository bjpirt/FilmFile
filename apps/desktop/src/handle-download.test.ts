import { expect, test } from 'vitest';
import { handleDownload, type Download } from './handle-download.ts';

type State = 'completed' | 'cancelled' | 'interrupted';

/** A download that finishes as told once `finish` is called. */
function aDownload(name: string, savedAs: string) {
  let done: ((event: unknown, state: State) => void) | undefined;
  const options: { defaultPath: string }[] = [];
  const download: Download = {
    getFilename: () => name,
    setSaveDialogOptions: (chosen) => {
      options.push(chosen);
    },
    getSavePath: () => savedAs,
    once: (_event, listener) => {
      done = listener;
    },
  };
  return {
    download,
    options,
    finish: (state: State) => {
      done?.({}, state);
    },
  };
}

function watching(lastFolder?: string) {
  const files: string[] = [];
  return {
    files,
    deps: {
      lastFolder: () => lastFolder,
      downloads: '/Users/ben/Downloads',
      saved: (file: string) => {
        files.push(file);
      },
    },
  };
}

test('asks where to save, suggesting the name it was given in the Downloads folder the first time', () => {
  const { download, options } = aDownload('2026-014-12A.jpg', '');

  handleDownload(download, watching().deps);

  expect(options).toEqual([
    { defaultPath: '/Users/ben/Downloads/2026-014-12A.jpg' },
  ]);
});

test('starts in the folder last saved to', () => {
  const { download, options } = aDownload('2026-014 Westfjords.zip', '');

  handleDownload(download, watching('/Users/ben/Pictures/Iceland').deps);

  expect(options).toEqual([
    {
      defaultPath: '/Users/ben/Pictures/Iceland/2026-014 Westfjords.zip',
    },
  ]);
});

test('tells where the file was saved once it is there', () => {
  const { download, finish } = aDownload(
    '2026-014-12A.jpg',
    '/Volumes/Prints/2026-014-12A.jpg',
  );
  const { deps, files } = watching();
  handleDownload(download, deps);

  expect(files).toEqual([]);
  finish('completed');

  expect(files).toEqual(['/Volumes/Prints/2026-014-12A.jpg']);
});

test.each(['cancelled', 'interrupted'] as const)(
  'says and remembers nothing when it is %s',
  (state) => {
    const { download, finish } = aDownload('a.jpg', '/Volumes/Prints/a.jpg');
    const { deps, files } = watching();
    handleDownload(download, deps);

    finish(state);

    expect(files).toEqual([]);
  },
);
