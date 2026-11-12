import type { ApiClient } from '@filmfile/contracts/client';
import { useQueries } from '@tanstack/react-query';
import { cameraLabel } from '../equipment/use-cameras.ts';
import { filmStockLabel } from '../equipment/use-film-stocks.ts';
import { lensLabel } from '../equipment/use-lenses.ts';

/** One thing a rule can name: what is stored (a slug or an ID) and what's shown. */
export interface RuleOption {
  readonly value: string;
  readonly label: string;
}

/** What each rule's list can offer; undefined until it has loaded, so nothing is called "gone" too early. */
export interface RuleOptions {
  readonly events: readonly RuleOption[] | undefined;
  readonly rolls: readonly RuleOption[] | undefined;
  readonly cameras: readonly RuleOption[] | undefined;
  readonly lenses: readonly RuleOption[] | undefined;
  readonly films: readonly RuleOption[] | undefined;
}

/** The archive's events, rolls and equipment as rules can name them; the queries are shared with the pages that list them. */
export function useRuleOptions(api: ApiClient): RuleOptions {
  const [events, rolls, cameras, lenses, films] = useQueries({
    queries: [
      {
        queryKey: ['events'],
        queryFn: async () => {
          const { data } = await api.GET('/api/events');
          if (data === undefined) {
            throw new Error("Couldn't load the events.");
          }
          return data.events;
        },
      },
      {
        queryKey: ['rolls'],
        queryFn: async () => {
          const { data } = await api.GET('/api/rolls');
          if (data === undefined) {
            throw new Error("Couldn't load the rolls.");
          }
          return data;
        },
      },
      {
        queryKey: ['cameras'],
        queryFn: async () => {
          const { data } = await api.GET('/api/equipment/cameras');
          if (data === undefined) {
            throw new Error("Couldn't load the cameras.");
          }
          return data.cameras;
        },
      },
      {
        queryKey: ['lenses'],
        queryFn: async () => {
          const { data } = await api.GET('/api/equipment/lenses');
          if (data === undefined) {
            throw new Error("Couldn't load the lenses.");
          }
          return data.lenses;
        },
      },
      {
        queryKey: ['films'],
        queryFn: async () => {
          const { data } = await api.GET('/api/equipment/films');
          if (data === undefined) {
            throw new Error("Couldn't load the film stocks.");
          }
          return data.films;
        },
      },
    ],
  });
  return {
    events: events.data?.map((e) => ({ value: e.slug, label: e.name })),
    rolls: rolls.data?.rolls.map((r) => ({
      value: r.id,
      label: [r.roll, r.name].filter(Boolean).join(' '),
    })),
    cameras: cameras.data?.map((c) => ({
      value: c.slug,
      label: cameraLabel(c),
    })),
    lenses: lenses.data?.map((l) => ({ value: l.slug, label: lensLabel(l) })),
    films: films.data?.map((f) => ({
      value: f.slug,
      label: filmStockLabel(f),
    })),
  };
}
