import type { Roll } from '@filmfile/contracts/rolls';
import { Thumbnail } from '../rolls/thumbnail.tsx';
import type { FrameRef } from './selection-edit.ts';

/**
 * "Hidden: 2": the frames left off a selection by hand, each with a way to put
 * it back. A frame that has since gone from the archive isn't listed or
 * counted, though its entry is kept.
 */
export function HiddenFramesList({
  rolls,
  hidden,
  putBack,
}: {
  readonly rolls: readonly Roll[];
  readonly hidden: readonly FrameRef[];
  readonly putBack: (frame: FrameRef) => void;
}) {
  const there = hidden.flatMap((ref) => {
    const roll = rolls.find((r) => r.id === ref.rollId);
    const frame = roll?.frames.find((f) => f.id === ref.frameId);
    return roll === undefined || frame === undefined
      ? []
      : [{ ref, roll, frame }];
  });
  if (there.length === 0) {
    return null;
  }
  return (
    <section className="hidden-frames" aria-label="Frames left off">
      <p className="hidden-count">Hidden: {there.length}</p>
      <ul className="contact-sheet selection-grid">
        {there.map(({ ref, roll, frame }) => {
          const name = `Roll ${roll.roll}, frame ${frame.number ?? 'with no number'}`;
          return (
            <li key={`${ref.rollId}-${ref.frameId}`} className="hidden-frame">
              <Thumbnail rollId={roll.id} frame={frame} decorative />
              <button
                type="button"
                aria-label={`Put back ${name}`}
                onClick={() => {
                  putBack(ref);
                }}
              >
                Put back
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
