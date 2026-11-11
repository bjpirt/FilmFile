import type { ApiClient } from '@filmfile/contracts/client';
import type { Event } from '@filmfile/contracts/events';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useQuery } from '@tanstack/react-query';
import { cameraName, useCameras } from '../equipment/use-cameras.ts';
import { filmStockName, useFilmStocks } from '../equipment/use-film-stocks.ts';
import { lensName, useLenses } from '../equipment/use-lenses.ts';
import { inFrameOrder } from '../rolls/frame-order.ts';
import { eventsOfFrame } from './frame-events.ts';

// An event's frames, from every roll, in shot order and grouped as chosen:
// those of its rolls, and those put in it themselves (U17). Shared by the
// event's page and the frame view opened from it, so both show the frames in
// the same order.

/** How an event's frames are grouped, kept in the address as `?group=`. */
export type Grouping = 'none' | 'roll' | 'camera' | 'lens' | 'film';

export const groupings: readonly { value: Grouping; label: string }[] = [
  { value: 'none', label: 'Nothing' },
  { value: 'roll', label: 'Roll' },
  { value: 'camera', label: 'Camera' },
  { value: 'lens', label: 'Lens' },
  { value: 'film', label: 'Film stock' },
];

/**
 * An event's page address (`?group=camera&hidden=show`), for the links that
 * leave it and come back to it, so the frame view opened from it keeps both.
 */
export function eventQuery(group: Grouping, showHidden: boolean): string {
  const params = new URLSearchParams();
  if (group !== 'none') {
    params.set('group', group);
  }
  if (showHidden) {
    params.set('hidden', 'show');
  }
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}

export function groupingOf(value: string | null): Grouping {
  return groupings.find((g) => g.value === value)?.value ?? 'none';
}

/** A frame with the roll it's on. */
export interface RollFrame {
  readonly roll: Roll;
  readonly frame: Frame;
}

export interface FrameGroup {
  /** The group's heading, or undefined when not grouping. */
  readonly title: string | undefined;
  /** The roll the group is, when grouping by roll. */
  readonly roll?: Roll;
  /** The rolls page showing what the group is, when grouping by camera, lens or film stock. */
  readonly rollsLink?: string;
  readonly frames: RollFrame[];
}

export class EventNotFound extends Error {}

/** Rolls in shot order: by date shot, undated last, then by roll number. */
function inShotOrder(rolls: readonly Roll[]): Roll[] {
  return [...rolls].sort((a, b) => {
    if (a.shot !== b.shot) {
      if (a.shot === null || b.shot === null) {
        return a.shot === null ? 1 : -1;
      }
      return a.shot.localeCompare(b.shot);
    }
    return a.roll.localeCompare(b.roll);
  });
}

/**
 * Frames by when they were shot: a frame's own date where it has one, else
 * its roll's (D47); undated last. Frames shot on the same date keep the
 * order they're given in.
 */
function byDateShot(frames: readonly RollFrame[]): RollFrame[] {
  const shot = ({ roll, frame }: RollFrame) => frame.shot ?? roll.shot;
  return [...frames].sort((a, b) => {
    const [x, y] = [shot(a), shot(b)];
    if (x === y) {
      return 0;
    }
    if (x === null || y === null) {
      return x === null ? 1 : -1;
    }
    return x.localeCompare(y);
  });
}

/** Frames under each title, keeping their order, in the order titles first appear. */
function groupedBy(
  frames: readonly RollFrame[],
  titleOf: (frame: RollFrame) => string,
): FrameGroup[] {
  const groups = new Map<string, RollFrame[]>();
  for (const frame of frames) {
    const title = titleOf(frame);
    groups.set(title, [...(groups.get(title) ?? []), frame]);
  }
  return [...groups].map(([title, members]) => ({ title, frames: members }));
}

/** Groups by name, in name order, with frames that have none last. */
function namedGroups(
  frames: readonly RollFrame[],
  nameOf: (frame: RollFrame) => string | undefined,
  none: string,
  slugOf: (frame: RollFrame) => string | null,
  filter: 'camera' | 'lens' | 'film',
): FrameGroup[] {
  const groups = groupedBy(frames, (frame) => nameOf(frame) ?? none).map(
    (group) => {
      const first = group.frames[0];
      const slug = first === undefined ? null : slugOf(first);
      return slug === null
        ? group
        : { ...group, rollsLink: `/?${filter}=${slug}` };
    },
  );
  return groups.sort((a, b) => {
    if (a.title === none || b.title === none) {
      return a.title === none ? 1 : -1;
    }
    return (a.title ?? '').localeCompare(b.title ?? '', undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  });
}

/** What the event's page shows: the event and its frames, grouped. */
export type EventFrames =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'loaded';
      readonly event: Event;
      /** Every frame, in shot order, ungrouped. */
      readonly frames: readonly RollFrame[];
      /** How many of the event's frames are hidden, shown or not (D99). */
      readonly hidden: number;
      readonly groups: readonly FrameGroup[];
    };

/** The event and its frames from every roll in it, grouped as chosen. */
export function useEventFrames(
  api: ApiClient,
  slug: string,
  group: Grouping,
  /** Whether hidden frames are listed too, `?hidden=show` (D99). */
  showHidden = false,
  /** A frame to list even if it's hidden: the one the frame view has open. */
  keep?: string,
): EventFrames {
  const cameras = useCameras(api);
  const films = useFilmStocks(api);
  const lenses = useLenses(api);
  const event = useQuery({
    queryKey: ['events', slug],
    queryFn: async () => {
      const { data, response } = await api.GET('/api/events/{slug}', {
        params: { path: { slug } },
      });
      if (data !== undefined) {
        return data;
      }
      throw response.status === 404
        ? new EventNotFound()
        : new Error("Couldn't load the event.");
    },
  });
  const rolls = useQuery({
    queryKey: ['rolls'],
    queryFn: async () => {
      const { data } = await api.GET('/api/rolls');
      if (data === undefined) {
        throw new Error("Couldn't load the rolls.");
      }
      return data;
    },
  });

  if (event.isPending || rolls.isPending) {
    return { status: 'loading' };
  }
  if (event.isError || rolls.isError) {
    return {
      status: event.error instanceof EventNotFound ? 'not-found' : 'failed',
    };
  }
  const inEvent: RollFrame[] = byDateShot(
    inShotOrder(rolls.data.rolls).flatMap((roll) =>
      inFrameOrder(roll.frames)
        .filter((frame) => eventsOfFrame(frame, roll).includes(slug))
        .map((frame) => ({ roll, frame })),
    ),
  );
  const frames = inEvent.filter(
    ({ frame }) => showHidden || !frame.hidden || frame.id === keep,
  );
  const groups: FrameGroup[] = (() => {
    switch (group) {
      case 'none':
        return [{ title: undefined, frames }];
      case 'roll':
        return groupedBy(frames, ({ roll }) => roll.id).map((g) => ({
          ...g,
          title: g.frames[0]?.roll.roll,
          ...(g.frames[0] === undefined ? {} : { roll: g.frames[0].roll }),
        }));
      case 'camera':
        return namedGroups(
          frames,
          // A frame's own, where it has one (U15).
          ({ roll, frame }) => cameraName(cameras, frame.camera ?? roll.camera),
          'No camera',
          ({ roll, frame }) => frame.camera ?? roll.camera,
          'camera',
        );
      case 'lens':
        return namedGroups(
          frames,
          ({ roll, frame }) => lensName(lenses, frame.lens ?? roll.lens),
          'No lens',
          ({ roll, frame }) => frame.lens ?? roll.lens,
          'lens',
        );
      case 'film':
        return namedGroups(
          frames,
          // Always the roll's (D45).
          ({ roll }) => filmStockName(films, roll.film),
          'No film stock',
          ({ roll }) => roll.film,
          'film',
        );
    }
  })();
  return {
    status: 'loaded',
    event: event.data,
    frames,
    hidden: inEvent.filter(({ frame }) => frame.hidden).length,
    groups,
  };
}
