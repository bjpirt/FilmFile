import type { ApiClient } from '@filmfile/contracts/client';
import {
  eventQuery,
  groupingOf,
  useEventFrames,
} from '../events/event-frames.ts';
import { showingHidden } from '../rolls/hidden-frames.ts';
import { Link, useSearch } from '../routing.tsx';
import { FrameView } from './frame-view.tsx';

/**
 * A frame opened from an event: the event's frames from every roll, in the
 * order and grouping its page had, to step through.
 */
export function EventFramePage({
  api,
  slug,
  frameId,
}: {
  readonly api: ApiClient;
  readonly slug: string;
  readonly frameId: string;
}) {
  const search = useSearch();
  const group = groupingOf(new URLSearchParams(search).get('group'));
  const showHidden = showingHidden(search);
  const shown = useEventFrames(api, slug, group, showHidden, frameId);
  const grouping = eventQuery(group, showHidden);

  switch (shown.status) {
    case 'loading':
      return <p>Loading the frame…</p>;
    case 'not-found':
    case 'failed':
      return (
        <p>
          {shown.status === 'not-found'
            ? 'There is no such event.'
            : "Couldn't load the event. Is the service running?"}{' '}
          <Link to="/events">All events</Link>
        </p>
      );
    case 'loaded':
      break;
  }
  // As the event page shows them: group by group.
  const frames = shown.groups.flatMap((g) => g.frames);
  return (
    <FrameView
      api={api}
      frames={frames}
      current={frames.findIndex(({ frame }) => frame.id === frameId)}
      back={{ to: `/events/${slug}${grouping}`, label: shown.event.name }}
      addressOf={({ frame }) => `/events/${slug}/frames/${frame.id}${grouping}`}
      labelOf={({ roll, frame }) =>
        `Frame ${frame.number ?? 'with no number'} of roll ${roll.roll}`
      }
    />
  );
}
