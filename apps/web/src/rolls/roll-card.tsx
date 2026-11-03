import type { Roll } from '@filmfile/contracts/rolls';
import { Link } from '../routing.tsx';
import { formatShot } from './format-shot.ts';
import { frameCount } from './frame-count.ts';
import { thumbnailUrl } from './thumbnail-url.ts';

/** A roll on the rolls page: a peek at its first three scans, its number and how many frames it has. */
export function RollCard({ roll }: { readonly roll: Roll }) {
  const peek = [0, 1, 2].map((i) => {
    const frame = roll.frames[i];
    return frame === undefined ? undefined : thumbnailUrl(roll.id, frame);
  });
  return (
    <li className="roll-card">
      <div className="peek" aria-hidden="true">
        {peek.map((src, i) =>
          src === undefined ? (
            <div key={i} className="peek-empty" />
          ) : (
            <img key={i} src={src} alt="" />
          ),
        )}
      </div>
      <div className="roll-card-body">
        <Link to={`/rolls/${roll.id}`} className="roll-number">
          {roll.roll}
        </Link>
        <span className="muted">{frameCount(roll.frames.length)}</span>
      </div>
      {(roll.name !== null || roll.shot !== null) && (
        <div className="roll-card-details">
          {roll.name !== null && <span>{roll.name}</span>}
          {roll.shot !== null && (
            <span className="muted">{formatShot(roll.shot)}</span>
          )}
        </div>
      )}
    </li>
  );
}
