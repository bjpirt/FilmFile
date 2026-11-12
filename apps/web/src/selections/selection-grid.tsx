import type { Roll } from '@filmfile/contracts/rolls';
import type { SearchFramesResponse } from '@filmfile/contracts/selections';
import type { ReactNode } from 'react';
import { Thumbnail } from '../rolls/thumbnail.tsx';
import { Link } from '../routing.tsx';
import { matchCount } from './selection-edit.ts';

export type FoundFrame = SearchFramesResponse['frames'][number];

/** "24 frames match", or "22 frames match, 2 excluded". */
export function MatchCount({
  count,
  excluded,
}: {
  readonly count: number;
  readonly excluded: number;
}) {
  return (
    <p className="match-count" role="status">
      {matchCount(count, excluded)}
    </p>
  );
}

/**
 * The frames found, as thumbnails in the order given, each opening the frame
 * in its roll. A page can put its own actions on each; one excluded by hand
 * stays in its place, greyed (D103).
 */
export function SelectionGrid({
  rolls,
  frames,
  actions,
}: {
  readonly rolls: readonly Roll[];
  readonly frames: readonly FoundFrame[];
  /** Given the frame and its name, "Roll 2026-014, frame 12", for naming its buttons. */
  readonly actions?: (frame: FoundFrame, name: string) => ReactNode;
}) {
  return (
    <ul className="contact-sheet selection-grid">
      {frames.map((found) => {
        const roll = rolls.find((r) => r.id === found.rollId);
        const frame = roll?.frames.find((f) => f.id === found.frameId);
        if (roll === undefined || frame === undefined) {
          return null;
        }
        const name = `Roll ${roll.roll}, frame ${frame.number ?? 'with no number'}`;
        return (
          <li
            key={`${found.rollId}-${found.frameId}`}
            className={found.excluded ? 'excluded' : undefined}
          >
            <Link to={`/rolls/${roll.id}/frames/${frame.id}`} aria-label={name}>
              <Thumbnail rollId={roll.id} frame={frame} decorative />
            </Link>
            {actions?.(found, name)}
          </li>
        );
      })}
    </ul>
  );
}
