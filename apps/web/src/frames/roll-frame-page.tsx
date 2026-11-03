import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery } from '@tanstack/react-query';
import { inFrameOrder } from '../rolls/frame-order.ts';
import { Link } from '../routing.tsx';
import { FrameView, type CollectionFrame } from './frame-view.tsx';

class RollNotFound extends Error {}

/** A frame opened from its roll: the roll's frames, in frame order, to step through. */
export function RollFramePage({
  api,
  rollId,
  frameId,
}: {
  readonly api: ApiClient;
  readonly rollId: string;
  readonly frameId: string;
}) {
  const roll = useQuery({
    queryKey: ['rolls', rollId],
    queryFn: async () => {
      const { data, response } = await api.GET('/api/rolls/{rollId}', {
        params: { path: { rollId } },
      });
      if (data !== undefined) {
        return { roll: data, etag: response.headers.get('ETag') ?? '' };
      }
      throw response.status === 404
        ? new RollNotFound()
        : new Error("Couldn't load the roll.");
    },
  });

  if (roll.isPending) {
    return <p>Loading the frame…</p>;
  }
  if (roll.isError) {
    return (
      <p>
        {roll.error instanceof RollNotFound
          ? 'There is no such roll.'
          : "Couldn't load the roll. Is the service running?"}{' '}
        <Link to="/">All rolls</Link>
      </p>
    );
  }
  const frames: CollectionFrame[] = inFrameOrder(roll.data.roll.frames).map(
    (frame) => ({ roll: roll.data.roll, frame }),
  );
  return (
    <FrameView
      api={api}
      frames={frames}
      current={frames.findIndex(({ frame }) => frame.id === frameId)}
      back={{ to: `/rolls/${rollId}`, label: `Roll ${roll.data.roll.roll}` }}
      addressOf={({ frame }) => `/rolls/${rollId}/frames/${frame.id}`}
      labelOf={({ frame }) => `Frame ${frame.number ?? 'with no number'}`}
    />
  );
}
