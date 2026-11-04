import type { ApiClient } from '@filmfile/contracts/client';
import type { components } from '@filmfile/contracts/api-types';
import type { Roll } from '@filmfile/contracts/rolls';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { CollectionFrame } from './frame-view.tsx';

/** The details of a frame to change; one left out stays as it is. */
export type FrameChanges = components['schemas']['UpdateFrameRequest'];

/** The images a version can be for now: web-native ones (U34). */
const versionTypes = ['image/jpeg', 'image/png', 'image/webp'];

/** Degrees clockwise a version is turned when shown. */
export type QuarterTurn = components['schemas']['Version']['rotate'];

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
    await refreshed();
  }

  /** Adds an image to the frame as another version (U34); its first stays the one shown. */
  async function sendVersion(file: File) {
    const read = queryClient.getQueryData<ReadRoll>(['rolls', rollId]);
    if (read === undefined) {
      return;
    }
    setProblem(undefined);
    if (!versionTypes.includes(file.type)) {
      setProblem('Only JPEG, PNG and WebP images can be added.');
      return;
    }
    const { data, response } = await api.POST(
      '/api/rolls/{rollId}/frames/{frameId}/versions',
      {
        params: { path: { rollId, frameId }, query: { file: file.name } },
        body: file,
        // Send the file as it is, not as JSON.
        bodySerializer: (body) => body,
        headers: { 'Content-Type': file.type },
      },
    );
    if (response.status === 409) {
      setProblem('That image is already in this roll.');
      return;
    }
    if (response.status === 422) {
      setProblem(
        'That file name can’t be used. Rename it to letters, digits and dashes, like edit-1.png.',
      );
      return;
    }
    if (data === undefined) {
      setProblem("Couldn't add it. Is the service running?");
      return;
    }
    const added = data;
    queryClient.setQueryData<ReadRoll>(['rolls', rollId], {
      roll: {
        ...read.roll,
        frames: read.roll.frames.map((f) =>
          f.id === frameId ? { ...f, versions: [...f.versions, added] } : f,
        ),
      },
      etag: read.etag,
    });
    await queryClient.invalidateQueries({ queryKey: ['rolls', rollId] });
    await queryClient.invalidateQueries({ queryKey: ['rolls'], exact: true });
  }

  /** Deletes one of the frame's versions (U28b), then calls `onDeleted`. */
  async function sendDeleteVersion(versionId: string, onDeleted: () => void) {
    const read = queryClient.getQueryData<ReadRoll>(['rolls', rollId]);
    if (read === undefined) {
      return;
    }
    setProblem(undefined);
    const { response } = await api.DELETE(
      '/api/rolls/{rollId}/frames/{frameId}/versions/{versionId}',
      {
        params: {
          path: { rollId, frameId, versionId },
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
    onDeleted();
    queryClient.setQueryData<ReadRoll>(['rolls', rollId], {
      roll: {
        ...read.roll,
        frames: read.roll.frames.map((f) =>
          f.id === frameId
            ? {
                ...f,
                versions: f.versions.filter((v) => v.id !== versionId),
                defaultVersion:
                  f.defaultVersion === versionId ? null : f.defaultVersion,
              }
            : f,
        ),
      },
      etag: response.headers.get('ETag') ?? read.etag,
    });
    await refreshed();
  }

  /** What shows the frame or its roll, read afresh after a change. */
  async function refreshed() {
    await queryClient.invalidateQueries({
      queryKey: ['rolls', rollId, 'frames', frameId, 'details'],
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

  async function sendTurn(versionId: string, rotate: QuarterTurn) {
    const read = queryClient.getQueryData<ReadRoll>(['rolls', rollId]);
    if (read === undefined) {
      return;
    }
    setProblem(undefined);
    const { data, response } = await api.PATCH(
      '/api/rolls/{rollId}/frames/{frameId}/versions/{versionId}',
      {
        params: {
          path: { rollId, frameId, versionId },
          header: { 'if-match': read.etag },
        },
        body: { rotate },
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
    queryClient.setQueryData<ReadRoll>(['rolls', rollId], {
      roll: {
        ...read.roll,
        frames: read.roll.frames.map((f) =>
          f.id === frameId
            ? {
                ...f,
                versions: f.versions.map((v) => (v.id === data.id ? data : v)),
              }
            : f,
        ),
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
    /** Turns one of the frame's versions as it's shown (D41). */
    turn: (versionId: string, rotate: QuarterTurn) =>
      queued(() => sendTurn(versionId, rotate)),
    /** Adds an image as another version of the frame (U34). */
    addVersion: (file: File) => queued(() => sendVersion(file)),
    /** Deletes one of the frame's versions (U28b). */
    deleteVersion: (versionId: string, onDeleted: () => void) =>
      queued(() => sendDeleteVersion(versionId, onDeleted)),
    /** Deletes the frame into the archive's deleted folder, then calls `onDeleted`. */
    remove: (onDeleted: () => void) => queued(() => sendDelete(onDeleted)),
    problem,
  };
}
