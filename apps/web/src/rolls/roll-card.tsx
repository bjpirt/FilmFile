import type { Camera } from '@filmfile/contracts/equipment';
import type { Roll } from '@filmfile/contracts/rolls';
import { cameraName } from '../equipment/use-cameras.ts';
import { Link } from '../routing.tsx';
import { formatShot } from './format-shot.ts';
import { frameCount } from './frame-count.ts';
import { thumbnailUrl } from './thumbnail-url.ts';

/** A roll on the rolls page: a peek at its first three scans, its number, frame count and details. */
export function RollCard({
  roll,
  cameras,
}: {
  readonly roll: Roll;
  readonly cameras: readonly Camera[];
}) {
  const camera = cameraName(cameras, roll.camera);
  // e.g. "Nikon FE · Sep 2026"
  const about = [camera, roll.shot === null ? undefined : formatShot(roll.shot)]
    .filter((part) => part !== undefined)
    .join(' · ');
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
      {(roll.name !== null || about !== '') && (
        <div className="roll-card-details">
          {roll.name !== null && <span>{roll.name}</span>}
          {about !== '' && <span className="muted">{about}</span>}
        </div>
      )}
    </li>
  );
}
