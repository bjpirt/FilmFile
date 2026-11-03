import type { ApiClient } from '@filmfile/contracts/client';
import type { components } from '@filmfile/contracts/api-types';
import type { Roll } from '@filmfile/contracts/rolls';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { CollectionFrame } from './frame-view.tsx';

/** The details of a frame to change; one left out stays as it is. */
export type FrameChanges = components['schemas']['UpdateFrameRequest'];

interface ReadRoll {
  readonly roll: Roll;
  readonly etag: string;
}

/**
 * Saves changes to the frame shown, or deletes it, each against the roll's
 * ETag as the last save left it, so a roll changed elsewhere is never
 * overwritten. Saves run one after another: a title saved on leaving its
 * field and a star clicked straight after would otherwise both be sent
 * against the same version.
 */
export function useSaveFrame(
  api: ApiClient,
  shown: CollectionFrame | undefined,
) {
  const queryClient = useQueryClient();
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const rollId = shown?.roll.id ?? '';
  const frameId = shown?.frame.id ?? '';
  // The roll as read, for its version.
  useQuery({
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
    enabled: shown !== undefined,
  });

  async function send(changes: FrameChanges) {
    const read = queryClient.getQueryData<ReadRoll>(['rolls', rollId]);
    if (read === undefined) {
      return;
    }
    setProblem(undefined);
    const { data, response } = await api.PATCH(
      '/api/rolls/{rollId}/frames/{frameId}',
      {
        params: {
          path: { rollId, frameId },
          header: { 'if-match': read.etag },
        },
        body: changes,
      },
    );
    if (response.status === 409) {
      setProblem('This roll changed since you opened it. Reload the page.');
      return;
    }
    if (data === undefined) {
      setProblem("Couldn't save it. Is the service running?");
      return;
    }
    // Kept at once, so the next save goes against the roll as this one left it.
    queryClient.setQueryData<ReadRoll>(['rolls', rollId], {
      roll: {
        ...read.roll,
        frames: read.roll.frames.map((f) => (f.id === data.id ? data : f)),
      },
      etag: response.headers.get('ETag') ?? read.etag,
    });
    await queryClient.invalidateQueries({ queryKey: ['rolls'], exact: true });
  }

  async function sendDelete(onDeleted: () => void) {
    const read = queryClient.getQueryData<ReadRoll>(['rolls', rollId]);
    if (read === undefined) {
      return;
    }
    setProblem(undefined);
    const { response } = await api.DELETE(
      '/api/rolls/{rollId}/frames/{frameId}',
      {
        params: {
          path: { rollId, frameId },
          header: { 'if-match': read.etag },
        },
      },
    );
    if (response.status === 409) {
      setProblem('This roll changed since you opened it. Reload the page.');
      return;
    }
    if (!response.ok) {
      setProblem("Couldn't delete it. Is the service running?");
      return;
    }
    // Moved on first, so the frame view never shows the frame as missing.
    onDeleted();
    queryClient.setQueryData<ReadRoll>(['rolls', rollId], {
      roll: {
        ...read.roll,
        frames: read.roll.frames.filter((f) => f.id !== frameId),
      },
      etag: response.headers.get('ETag') ?? read.etag,
    });
    await queryClient.invalidateQueries({ queryKey: ['rolls'], exact: true });
  }

  function queued(send: () => Promise<void>): Promise<void> {
    saving.current = saving.current.then(send).catch(() => {
      setProblem("Couldn't save it. Is the service running?");
    });
    return saving.current;
  }

  return {
    save: (changes: FrameChanges) => queued(() => send(changes)),
    /** Deletes the frame into the archive's deleted folder, then calls `onDeleted`. */
    remove: (onDeleted: () => void) => queued(() => sendDelete(onDeleted)),
    problem,
  };
}
