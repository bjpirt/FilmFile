import type { Event } from '@filmfile/contracts/events';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { formatShot } from '../rolls/format-shot.ts';
import { thumbnailUrl } from '../rolls/thumbnail-url.ts';
import { Link } from '../routing.tsx';
import { eventsOfFrame, eventsOfRoll } from './frame-events.ts';

function counted(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/**
 * An event on the Events page, laid out as a roll is on the rolls page: a
 * peek at its first three photos, its name leading to its page, how many
 * rolls and photos are in it (through their frames too, U17), and its date.
 */
export function EventCard({
  event,
  rolls,
  edit,
}: {
  readonly event: Event;
  /** Every roll in the archive; those in the event are picked out here. */
  readonly rolls: readonly Roll[];
  readonly edit: () => void;
}) {
  const inEvent = rolls.filter((roll) =>
    eventsOfRoll(roll).includes(event.slug),
  );
  const photos: { readonly roll: Roll; readonly frame: Frame }[] =
    inEvent.flatMap((roll) =>
      roll.frames
        .filter((frame) => eventsOfFrame(frame, roll).includes(event.slug))
        .map((frame) => ({ roll, frame })),
    );
  const peek = [0, 1, 2].map((i) => {
    const photo = photos[i];
    return photo === undefined
      ? undefined
      : thumbnailUrl(photo.roll.id, photo.frame);
  });
  return (
    <li className="roll-card event-card">
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
        <Link to={`/events/${event.slug}`} className="event-name">
          {event.name}
        </Link>
      </div>
      <div className="roll-card-details">
        <span className="muted">
          {[
            counted(inEvent.length, 'roll', 'rolls'),
            counted(photos.length, 'photo', 'photos'),
            ...(event.date === null ? [] : [formatShot(event.date)]),
          ].join(' · ')}
        </span>
        <button
          type="button"
          className="card-action"
          aria-label={`Edit ${event.name}`}
          onClick={edit}
        >
          Edit
        </button>
      </div>
    </li>
  );
}
