import type { Camera, FilmStock } from '@filmfile/contracts/equipment';
import type { Event } from '@filmfile/contracts/events';
import type { Roll } from '@filmfile/contracts/rolls';
import { PadlockIcon } from '../padlock-icon.tsx';
import { cameraName } from '../equipment/use-cameras.ts';
import { filmStockName } from '../equipment/use-film-stocks.ts';
import { eventName } from '../events/use-events.ts';
import { Link } from '../routing.tsx';
import { formatShot } from './format-shot.ts';
import { bestRated } from './best-rated.ts';
import { frameCount } from './frame-count.ts';
import { thumbnailUrl } from './thumbnail-url.ts';

/** A roll on the rolls page: a peek at its three highest rated scans, its number, frame count and details. */
export function RollCard({
  roll,
  cameras,
  films,
  events,
  proposedNumber,
}: {
  readonly roll: Roll;
  readonly cameras: readonly Camera[];
  readonly films: readonly FilmStock[];
  readonly events: readonly Event[];
  readonly proposedNumber?: string | undefined;
}) {
  // e.g. "Iceland 2026 · Nikon FE · Kodak Portra 400 · Sep 2026"
  const about = [
    eventName(events, roll.event),
    cameraName(cameras, roll.camera),
    filmStockName(films, roll.film),
    roll.shot === null ? undefined : formatShot(roll.shot),
  ]
    .filter((part) => part !== undefined)
    .join(' · ');
  const best = bestRated(
    roll.frames.map((frame) => ({ frame })),
    3,
  );
  const peek = [0, 1, 2].map((i) => {
    const frame = best[i]?.frame;
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
        <div className="roll-card-number">
          <Link to={`/rolls/${roll.id}`} className="roll-number">
            {proposedNumber === undefined ? roll.roll : <s>{roll.roll}</s>}
          </Link>
          {proposedNumber !== undefined && (
            <span className="proposed-roll-number">{proposedNumber}</span>
          )}
          {roll.filed && (
            <span
              className="filed-mark"
              role="img"
              aria-label="Filed"
              title="Filed"
            >
              <PadlockIcon size={18} />
            </span>
          )}
        </div>
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
