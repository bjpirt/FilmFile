import { rollFolderLabel } from './folder-names.ts';
import { sameRollNumber, type RollNumber } from './roll-number.ts';

/** Whether an unreadable roll folder may hold this number or its safe label. */
export function folderHoldsNumber(folder: string, roll: RollNumber): boolean {
  const label = /^(.+)-[0-9A-HJKMNP-TV-Z]{8}$/iu.exec(folder)?.[1] ?? folder;
  return (
    sameRollNumber(folder, roll) ||
    sameRollNumber(label, roll) ||
    sameRollNumber(rollFolderLabel(label), rollFolderLabel(roll))
  );
}
