import type { ApiClient } from '@filmfile/contracts/client';
import type { EventChoice } from './event-choice.ts';

/** The event chosen, by slug (null for none), or why there isn't one. */
export type ChosenEvent =
  | { readonly ok: true; readonly slug: string | null }
  | { readonly ok: false; readonly problem: string };

/** The slug of the event chosen, creating it now if it's new. */
export async function chooseEvent(
  api: ApiClient,
  choice: EventChoice,
): Promise<ChosenEvent> {
  switch (choice.kind) {
    case 'none':
      return { ok: true, slug: null };
    case 'existing':
      return { ok: true, slug: choice.slug };
    case 'new':
      return createEvent(api, choice.details.name.trim());
  }
}

async function createEvent(api: ApiClient, name: string): Promise<ChosenEvent> {
  if (name === '') {
    return {
      ok: false,
      problem: "Enter the new event's name, like Iceland 2026.",
    };
  }
  const { data, response } = await api.POST('/api/events', { body: { name } });
  if (data !== undefined) {
    return { ok: true, slug: data.slug };
  }
  switch (response.status) {
    case 409: {
      // The archive already has it, perhaps added since the list was loaded:
      // use it.
      const latest = await api.GET('/api/events');
      const added = (latest.data?.events ?? []).find(
        (event) => event.name.toLowerCase() === name.toLowerCase(),
      );
      return added === undefined
        ? {
            ok: false,
            problem: `There's already an event with a name like ${name}. Choose it from the list.`,
          }
        : { ok: true, slug: added.slug };
    }
    case 422:
      return {
        ok: false,
        problem:
          'Enter an event name with letters or digits, like Iceland 2026.',
      };
    default:
      return {
        ok: false,
        problem: "Couldn't add the event. Is the service running?",
      };
  }
}
