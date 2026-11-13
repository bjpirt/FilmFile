import { folderName, rollFolderLabel } from '../rolls/folder-names.ts';

/**
 * A frame's page on a site, without `.html` (D105): its number made safe and
 * the end of its ID, as its folder in the archive is named, or `frame-` and
 * the ID's end when it has no number.
 */
export function framePageName(number: string | null, id: string): string {
  return number === null
    ? `frame-${folderName(id)}`
    : `${rollFolderLabel(number)}-${folderName(id)}`;
}
