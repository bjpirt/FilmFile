import type { ApiClient } from '@filmfile/contracts/client';
import type { Roll } from '@filmfile/contracts/rolls';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

/** A roll as read, with the version a change to it is sent against. */
interface ReadRoll {
  readonly roll: Roll;
  readonly etag: string;
}

/** What a thumbnail changes on a frame: its rating, or whether it's hidden. */
type Change = { readonly rating: number | null } | { readonly hidden: boolean };

function withChange(roll: Roll, frameId: string, change: Change): Roll {
  return {
    ...roll,
    frames: roll.frames.map((frame) =>
      frame.id === frameId ? { ...frame, ...change } : frame,
    ),
  };
}

/**
 * Rates and hides frames from their thumbnails (FF-149, D62, D99). A rating shows at once,
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

  function show(rollId: string, frameId: string, change: Change) {
    queryClient.setQueryData<ReadRoll>(['rolls', rollId], (read) =>
      read === undefined
        ? undefined
        : { ...read, roll: withChange(read.roll, frameId, change) },
    );
    queryClient.setQueryData<{ readonly rolls: readonly Roll[] }>(
      ['rolls'],
      (list) =>
        list === undefined
          ? undefined
          : {
              ...list,
              rolls: list.rolls.map((roll) =>
                roll.id === rollId ? withChange(roll, frameId, change) : roll,
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
    change: Change,
    previous: Change,
    what: { readonly noun: string; readonly failure: string },
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
          body: change,
        },
      );
      if (response.status === 409) {
        failed(
          `This roll changed since you opened it. The ${what.noun} wasn't saved. Reload the page.`,
        );
        // Read again, so the next click is against what the roll is now.
        await queryClient.invalidateQueries({ queryKey: ['rolls'] });
        return;
      }
      if (!response.ok) {
        failed(what.failure);
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
      failed(what.failure);
    }
  }

  function change(
    rollId: string,
    frameId: string,
    now: Change,
    previous: Change,
    what: { readonly noun: string; readonly failure: string },
  ) {
    setProblem(undefined);
    show(rollId, frameId, now);
    const queued = (queues.current.get(rollId) ?? Promise.resolve()).then(() =>
      save(rollId, frameId, now, previous, what),
    );
    queues.current.set(rollId, queued);
  }

  /** Rates the frame (null clears it), from the rating it shows now. */
  function rate(
    rollId: string,
    frameId: string,
    rating: number | null,
    previous: number | null,
  ) {
    change(
      rollId,
      frameId,
      { rating },
      { rating: previous },
      {
        noun: 'rating',
        failure: "Couldn't save the rating. Is the service running?",
      },
    );
  }

  /** Hides or unhides the frame; `name` is how the frame is called in a failure, e.g. "frame 3". */
  function hide(
    rollId: string,
    frameId: string,
    hidden: boolean,
    name: string,
  ) {
    change(
      rollId,
      frameId,
      { hidden },
      { hidden: !hidden },
      {
        noun: hidden ? 'hiding' : 'unhiding',
        failure: `Couldn't ${hidden ? 'hide' : 'unhide'} ${name}.`,
      },
    );
  }

  return { rate, hide, problem };
}
