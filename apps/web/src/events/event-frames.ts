import type { ApiClient } from '@filmfile/contracts/client';
import type { Event } from '@filmfile/contracts/events';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useQuery } from '@tanstack/react-query';
import { cameraName, useCameras } from '../equipment/use-cameras.ts';
import { filmStockName, useFilmStocks } from '../equipment/use-film-stocks.ts';
import { lensName, useLenses } from '../equipment/use-lenses.ts';
import { inFrameOrder } from '../rolls/frame-order.ts';

// An event's frames from all its rolls, in shot order and grouped as chosen:
// shared by the event's page and the frame view opened from it, so both show
// the frames in the same order.

/** How an event's frames are grouped, kept in the address as `?group=`. */
export type Grouping = 'none' | 'roll' | 'camera' | 'lens' | 'film';

export const groupings: readonly { value: Grouping; label: string }[] = [
  { value: 'none', label: 'Nothing' },
  { value: 'roll', label: 'Roll' },
  { value: 'camera', label: 'Camera' },
  { value: 'lens', label: 'Lens' },
  { value: 'film', label: 'Film stock' },
];

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
  nameOf: (roll: Roll) => string | undefined,
  none: string,
): FrameGroup[] {
  return groupedBy(frames, ({ roll }) => nameOf(roll) ?? none).sort((a, b) => {
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
      readonly groups: readonly FrameGroup[];
    };

/** The event and its frames from every roll in it, grouped as chosen. */
export function useEventFrames(
  api: ApiClient,
  slug: string,
  group: Grouping,
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
  const frames: RollFrame[] = inShotOrder(
    rolls.data.rolls.filter((roll) => roll.event === slug),
  ).flatMap((roll) =>
    inFrameOrder(roll.frames).map((frame) => ({ roll, frame })),
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
          (roll) => cameraName(cameras, roll.camera),
          'No camera',
        );
      case 'lens':
        return namedGroups(
          frames,
          (roll) => lensName(lenses, roll.lens),
          'No lens',
        );
      case 'film':
        return namedGroups(
          frames,
          (roll) => filmStockName(films, roll.film),
          'No film stock',
        );
    }
  })();
  return { status: 'loaded', event: event.data, frames, groups };
}
