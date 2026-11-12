import type { Roll } from '@filmfile/contracts/rolls';
import type { SearchFramesResponse } from '@filmfile/contracts/selections';
import { useState, type ReactNode } from 'react';
import { SelectionGrid, type FoundFrame } from './selection-grid.tsx';

type Group = NonNullable<SearchFramesResponse['groups']>[number];

const counted = (count: number) =>
  count === 1 ? '1 frame' : `${String(count)} frames`;

/**
 * The frames found, under a heading for each roll or event, as the built site
 * groups them: its name, its date if an event, and how many of its frames are
 * on the site. Each folds away; all are open at first.
 */
export function SelectionGroups({
  rolls,
  groups,
  actions,
}: {
  readonly rolls: readonly Roll[];
  readonly groups: readonly Group[];
  readonly actions?: (frame: FoundFrame, name: string) => ReactNode;
}) {
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  return groups.map((group) => {
    const isFolded = folded.has(group.key);
    const count = group.frames.filter((frame) => !frame.excluded).length;
    return (
      <section key={group.key} className="selection-group">
        <div className="selection-group-head">
          <button
            type="button"
            className="fold-group"
            aria-expanded={!isFolded}
            aria-label={`${isFolded ? 'Unfold' : 'Fold'} ${group.heading}`}
            onClick={() => {
              const next = new Set(folded);
              if (isFolded) {
                next.delete(group.key);
              } else {
                next.add(group.key);
              }
              setFolded(next);
            }}
          >
            {/* The menu button's chevron, pointing right when folded. */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={isFolded ? 'M9 6l6 6-6 6' : 'M6 9l6 6 6-6'} />
            </svg>
          </button>
          <h3>
            {group.heading}
            {group.detail !== undefined && (
              <span className="muted"> · {group.detail}</span>
            )}
            <span className="muted"> · {counted(count)}</span>
          </h3>
        </div>
        {!isFolded && (
          <SelectionGrid
            rolls={rolls}
            frames={group.frames}
            {...(actions === undefined ? {} : { actions })}
          />
        )}
      </section>
    );
  });
}
