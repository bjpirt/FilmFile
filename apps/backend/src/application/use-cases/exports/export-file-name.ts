import type { Frame, Roll } from '../../../domain/rolls/roll.ts';

/**
 * The name an exported frame is saved as: `2026-014-12A.jpg`, or
 * `2026-014-frame.jpg` for a frame with no number. A roll's number can be
 * anything, so only letters, digits, dots and dashes are kept.
 */
export function exportFileName(roll: Roll, frame: Frame): string {
  const safe = `${roll.roll}-${frame.number ?? 'frame'}`.replace(
    /[^A-Za-z0-9.-]+/g,
    '-',
  );
  return `${safe}.jpg`;
}
