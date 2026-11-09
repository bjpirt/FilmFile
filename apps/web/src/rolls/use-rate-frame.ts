import type { ApiClient } from '@filmfile/contracts/client';
import type { Roll } from '@filmfile/contracts/rolls';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

/** A roll as read, with the version a change to it is sent against. */
interface ReadRoll {
  readonly roll: Roll;
  readonly etag: string;
}

function withRating(roll: Roll, frameId: string, rating: number | null): Roll {
  return {
    ...roll,
    frames: roll.frames.map((frame) =>
      frame.id === frameId ? { ...frame, rating } : frame,
    ),
  };
}

/**
 * Rates frames from their thumbnails (FF-149, D62). A rating shows at once,
 * wherever the frame is shown, and is saved in the background: each roll's
 * saves run one after another, against the version the last left, so quick
 * clicks never clash. A save that fails puts the rating back and says why.
 * The roll's own page reads it as `['rolls', rollId]` and an event's page
 * reads every roll as `['rolls']`, so both are kept in step.
 */
export function useRateFrame(api: ApiClient) {
  const queryClient = useQueryClient();
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const queues = useRef(new Map<string, Promise<void>>());

  function show(rollId: string, frameId: string, rating: number | null) {
    queryClient.setQueryData<ReadRoll>(['rolls', rollId], (read) =>
      read === undefined
        ? undefined
        : { ...read, roll: withRating(read.roll, frameId, rating) },
    );
    queryClient.setQueryData<{ readonly rolls: readonly Roll[] }>(
      ['rolls'],
      (list) =>
        list === undefined
          ? undefined
          : {
              ...list,
              rolls: list.rolls.map((roll) =>
                roll.id === rollId ? withRating(roll, frameId, rating) : roll,
              ),
            },
    );
  }

  async function readRoll(rollId: string): Promise<ReadRoll> {
    const cached = queryClient.getQueryData<ReadRoll>(['rolls', rollId]);
    if (cached !== undefined) {
      return cached;
    }
    return await queryClient.query({
      queryKey: ['rolls', rollId],
      queryFn: async (): Promise<ReadRoll> => {
        const { data, response } = await api.GET('/api/rolls/{rollId}', {
          params: { path: { rollId } },
        });
        if (data === undefined) {
          throw new Error("Couldn't load the roll.");
        }
        return { roll: data, etag: response.headers.get('ETag') ?? '' };
      },
    });
  }

  async function save(
    rollId: string,
    frameId: string,
    rating: number | null,
    previous: number | null,
  ) {
    const failed = (message: string) => {
      show(rollId, frameId, previous);
      setProblem(message);
    };
    try {
      const read = await readRoll(rollId);
      const { response } = await api.PATCH(
        '/api/rolls/{rollId}/frames/{frameId}',
        {
          params: {
            path: { rollId, frameId },
            header: { 'if-match': read.etag },
          },
          body: { rating },
        },
      );
      if (response.status === 409) {
        failed(
          "This roll changed since you opened it. The rating wasn't saved. Reload the page.",
        );
        // Read again, so the next click is against what the roll is now.
        await queryClient.invalidateQueries({ queryKey: ['rolls'] });
        return;
      }
      if (!response.ok) {
        failed("Couldn't save the rating. Is the service running?");
        return;
      }
      // Only the version moves on: a later click on this frame is already shown.
      const etag = response.headers.get('ETag');
      if (etag !== null) {
        queryClient.setQueryData<ReadRoll>(['rolls', rollId], (now) =>
          now === undefined ? undefined : { ...now, etag },
        );
      }
    } catch {
      failed("Couldn't save the rating. Is the service running?");
    }
  }

  /** Rates the frame (null clears it), from the rating it shows now. */
  function rate(
    rollId: string,
    frameId: string,
    rating: number | null,
    previous: number | null,
  ) {
    setProblem(undefined);
    show(rollId, frameId, rating);
    const queued = (queues.current.get(rollId) ?? Promise.resolve()).then(() =>
      save(rollId, frameId, rating, previous),
    );
    queues.current.set(rollId, queued);
  }

  return { rate, problem };
}
