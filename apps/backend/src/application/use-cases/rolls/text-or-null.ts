/** Text with surrounding space removed, or null when there's none left. */
export function textOrNull(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
