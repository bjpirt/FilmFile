/** How far an image is turned clockwise, in degrees: a quarter turn at a time (D41). */
export type QuarterTurn = 0 | 90 | 180 | 270;

export const quarterTurns: readonly QuarterTurn[] = [0, 90, 180, 270];

export function isQuarterTurn(value: number): value is QuarterTurn {
  return quarterTurns.some((turn) => turn === value);
}
