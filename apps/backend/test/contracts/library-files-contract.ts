import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import type { LibraryFiles } from '../../src/application/ports/library-files.ts';
import { ctx } from '../support/builders.ts';

const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const md5 = (text: string) => createHash('md5').update(text).digest('hex');

/** What every LibraryFiles must do, run against each adapter. */
export function libraryFilesContract(
  name: string,
  make: () => Promise<{
    readonly files: LibraryFiles;
    /** Puts a file at a path from the FilmFile folder. */
    readonly put: (path: string, text: string) => Promise<void>;
  }>,
): void {
  describe(`${name} meets the LibraryFiles contract`, () => {
    test('describes the library’s files and settings.json, by path, with size, SHA-256 and MD5', async () => {
      const { files, put } = await make();
      await put('settings.json', '{"s":1}');
      await put('Library/rolls/2026-014-AAAAAAAA/roll.json', '{"r":1}');
      await put('Library/blobs/ab/cd.jpg', 'jpeg');

      expect(await files.describe(ctx)).toEqual([
        {
          path: 'Library/blobs/ab/cd.jpg',
          size: 4,
          sha256: sha256('jpeg'),
          md5: md5('jpeg'),
        },
        {
          path: 'Library/rolls/2026-014-AAAAAAAA/roll.json',
          size: 7,
          sha256: sha256('{"r":1}'),
          md5: md5('{"r":1}'),
        },
        {
          path: 'settings.json',
          size: 7,
          sha256: sha256('{"s":1}'),
          md5: md5('{"s":1}'),
        },
      ]);
    });

    test('leaves out names starting with a dot', async () => {
      const { files, put } = await make();
      await put('Library/.DS_Store', 'x');
      await put('Library/rolls/._roll.json', 'x');
      await put('Library/.hidden/a.json', 'x');
      await put('Library/a.json', 'a');

      expect((await files.describe(ctx)).map((file) => file.path)).toEqual([
        'Library/a.json',
      ]);
    });

    test('sees a changed file’s new SHA-256 and MD5', async () => {
      const { files, put } = await make();
      await put('Library/a.json', 'one');
      await files.describe(ctx);
      await put('Library/a.json', 'second');

      expect(await files.describe(ctx)).toEqual([
        {
          path: 'Library/a.json',
          size: 6,
          sha256: sha256('second'),
          md5: md5('second'),
        },
      ]);
    });

    test('says how many files it has checked, of how many, as it goes', async () => {
      const { files, put } = await make();
      await put('Library/a.json', 'a');
      await put('Library/b.json', 'b');
      await put('settings.json', 's');
      const told: (readonly [number, number])[] = [];

      await files.describe(ctx, {
        checked: (done, total) => told.push([done, total]),
        signal: new AbortController().signal,
      });

      expect(told.at(0)).toEqual([0, 3]);
      expect(told.at(-1)).toEqual([3, 3]);
    });

    test('stops checking when asked to', async () => {
      const { files, put } = await make();
      await put('Library/a.json', 'a');
      const stopped = new AbortController();
      stopped.abort();

      await expect(
        files.describe(ctx, {
          checked: () => undefined,
          signal: stopped.signal,
        }),
      ).rejects.toThrow();
    });

    test('gives every file’s size, by path, without hashing', async () => {
      const { files, put } = await make();
      await put('settings.json', '{"s":1}');
      await put('Library/.DS_Store', 'x');
      await put('Library/a.json', 'abc');

      expect(await files.sizes(ctx)).toEqual([
        { path: 'Library/a.json', size: 3 },
        { path: 'settings.json', size: 7 },
      ]);
    });

    test('reads a file’s bytes as a stream', async () => {
      const { files, put } = await make();
      await put('Library/a.json', 'the bytes');

      expect(await new Response(files.read(ctx, 'Library/a.json')).text()).toBe(
        'the bytes',
      );
    });

    test('refuses a path outside the folder', async () => {
      const { files, put } = await make();
      await put('Library/a.json', 'x');

      expect(() => files.read(ctx, '../outside.json')).toThrow();
    });
  });
}
