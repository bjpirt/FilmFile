import type { Event } from '@filmfile/contracts/events';
import { PickOrAddSelect } from '../forms/pick-or-add-select.tsx';
import { RequiredMarker } from '../forms/required-marker.tsx';
import { blankEvent, type EventChoice } from './event-choice.ts';

/** An event picked from the archive's, or Add new…, which asks for its name. */
export function EventField({
  events,
  choice,
  change,
}: {
  readonly events: readonly Event[];
  readonly choice: EventChoice;
  readonly change: (choice: EventChoice) => void;
}) {
  return (
    <>
      <PickOrAddSelect
        label="Event"
        options={events.map((event) => ({
          slug: event.slug,
          label: event.name,
        }))}
        choice={choice}
        blank={blankEvent}
        change={change}
      />
      {choice.kind === 'new' && (
        <fieldset className="new-equipment">
          <legend>New event</legend>
          <label>
            <span>
              Name <RequiredMarker />
            </span>
            <input
              value={choice.details.name}
              placeholder="Iceland 2026"
              maxLength={100}
              autoFocus
              onChange={(event) => {
                change({ kind: 'new', details: { name: event.target.value } });
              }}
            />
          </label>
        </fieldset>
      )}
    </>
  );
}
