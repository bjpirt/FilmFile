import { describe, expect, test } from 'vitest';
import type { ExportFolder } from '../../src/application/ports/export-destination.ts';

/** What every ExportFolder must do, run against each adapter; `read` gives back a file by its path. */
export function exportFolderContract(
  name: string,
  make: () => {
    readonly folder: ExportFolder;
    readonly read: (path: string) => Promise<string | undefined>;
  },
): void {
  describe(`${name} meets the ExportFolder contract`, () => {
    const bytes = (text: string) => new TextEncoder().encode(text);

    test('writes a file and says where, making the folders it is in', async () => {
      const { folder, read } = make();

      expect(await folder.write('2026/2026-014/a.jpg', bytes('one'))).toBe(
        '2026/2026-014/a.jpg',
      );
      expect(await read('2026/2026-014/a.jpg')).toBe('one');
    });

    test('numbers a name that is taken, never replacing what is there', async () => {
      const { folder, read } = make();

      await folder.write('a.jpg', bytes('first'));
      const second = await folder.write('a.jpg', bytes('second'));
      const third = await folder.write('a.jpg', bytes('third'));

      expect([second, third]).toEqual(['a-2.jpg', 'a-3.jpg']);
      expect(await read('a.jpg')).toBe('first');
      expect(await read('a-2.jpg')).toBe('second');
    });

    test('refuses a path that would leave the folder', async () => {
      const { folder } = make();

      await expect(
        folder.write('../outside.jpg', bytes('x')),
      ).rejects.toThrow();
      await expect(folder.write('a/../../b.jpg', bytes('x'))).rejects.toThrow();
    });
  });
}
