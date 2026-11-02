// Frame numbers are free text (D19), sorted as they run along the film:
// by their leading number, negatives first, then by what follows it, so
// 00, 0, 1, 2, 10, 12, 12A, 14-15. Numbers like "00" come before "0" when
// equal in value, as on cameras that print both. Text with no leading
// number follows the numbers, and frames with no number come last.

const leadingNumber = /^-?\d+/;

function compareText(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function compareFrameNumbers(
  a: string | null,
  b: string | null,
): number {
  if (a === null || b === null) {
    return Number(a === null) - Number(b === null);
  }
  const aDigits = leadingNumber.exec(a)?.[0];
  const bDigits = leadingNumber.exec(b)?.[0];
  if (aDigits === undefined || bDigits === undefined) {
    return (
      Number(aDigits === undefined) - Number(bDigits === undefined) ||
      compareText(a, b)
    );
  }
  return (
    Number(aDigits) - Number(bDigits) ||
    bDigits.length - aDigits.length ||
    compareText(a.slice(aDigits.length), b.slice(bDigits.length)) ||
    compareText(a, b)
  );
}

/** The frames sorted by frame number; frames with the same number keep their scan order. */
export function inFrameOrder<T extends { readonly number: string | null }>(
  frames: readonly T[],
): T[] {
  return [...frames].sort((a, b) => compareFrameNumbers(a.number, b.number));
}
