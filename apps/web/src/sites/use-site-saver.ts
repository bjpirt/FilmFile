import type { ApiClient } from '@filmfile/contracts/client';
import type { Site } from '@filmfile/contracts/sites';
import { useRef, useState } from 'react';

interface Change {
  readonly name?: string;
  readonly selection?: Site['selection'];
  readonly presentation?: Site['presentation'];
  readonly publish?: Site['publish'];
}

/** How a save ended: saved, refused with the service's issues (a 422), or neither. */
export type SaveOutcome =
  | { readonly kind: 'saved'; readonly site: Site }
  | { readonly kind: 'invalid'; readonly error: unknown }
  | { readonly kind: 'not-saved' };

export type SaveState =
  | 'saved'
  | 'saving'
  /** The site was changed elsewhere: nothing more is saved. */
  | 'conflict'
  /** A new name's slug is another site's. */
  | 'name-taken'
  | 'failed';

/**
 * Saves a site's changes straight away, one after another, each against the
 * version the last one left (D101). Once the site is found to have changed
 * elsewhere nothing more is sent, so what's there is kept.
 */
export function useSiteSaver({
  api,
  slug,
  etag,
  saved,
}: {
  readonly api: ApiClient;
  readonly slug: string;
  /** The version the page was loaded at. */
  readonly etag: string;
  /** Told the site as the service now has it, after each save. */
  readonly saved: (site: Site) => void;
}) {
  const [state, setState] = useState<SaveState>('saved');
  const current = useRef({ slug, etag });
  const queue = useRef<Promise<void>>(Promise.resolve());
  const waiting = useRef(0);
  const stopped = useRef(false);

  function save(change: Change): Promise<SaveOutcome> {
    const notSaved: SaveOutcome = { kind: 'not-saved' };
    if (stopped.current) {
      // The site changed elsewhere: what's on screen stays, and nothing more is sent.
      return queue.current.then(() => notSaved);
    }
    waiting.current += 1;
    setState('saving');
    const outcome = queue.current.then(async (): Promise<SaveOutcome> => {
      try {
        if (stopped.current) {
          return notSaved;
        }
        const { data, error, response } = await api.PATCH('/api/sites/{slug}', {
          params: {
            path: { slug: current.current.slug },
            header: { 'if-match': current.current.etag },
          },
          body: change,
        });
        if (data !== undefined) {
          current.current = {
            slug: data.slug,
            etag: response.headers.get('ETag') ?? current.current.etag,
          };
          saved(data);
          // Another change is waiting behind this one.
          setState(waiting.current > 1 ? 'saving' : 'saved');
          return { kind: 'saved', site: data };
        }
        if (response.status === 422) {
          // The one asking says what was wrong, by field; what's saved is as it was.
          setState(waiting.current > 1 ? 'saving' : 'saved');
          return { kind: 'invalid', error };
        }
        if (response.status === 409) {
          // A taken slug and a changed site are both 409; only the second stops the saving.
          const taken =
            typeof error === 'object' &&
            'error' in error &&
            error.error.includes('already exists');
          stopped.current = !taken;
          setState(taken ? 'name-taken' : 'conflict');
        } else {
          setState('failed');
        }
      } catch {
        setState('failed');
      } finally {
        waiting.current -= 1;
      }
      return notSaved;
    });
    queue.current = outcome.then(() => undefined);
    return outcome;
  }

  return { state, save };
}
