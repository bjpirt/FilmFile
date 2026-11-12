import type { FrameSelection } from '@filmfile/contracts/selections';
import type {
  FrameRef,
  Rule,
  Selection,
} from '../../../../domain/selections/selection.ts';
import { isFrameId, isRollId } from '../../../../domain/shared/ids.ts';
import { isSlug, type Slug } from '../../../../domain/shared/slug.ts';

type Body = FrameSelection;

/** The request's selection as the domain's, or undefined if an ID or slug is malformed. */
export function selectionOf(body: Body): Selection | undefined {
  const slugs = (values: readonly string[]): Slug[] | undefined =>
    values.every(isSlug) ? values.filter(isSlug) : undefined;
  const refs = (list: Body['excluded']): FrameRef[] | undefined => {
    const out: FrameRef[] = [];
    for (const { rollId, frameId } of list) {
      if (!isRollId(rollId) || !isFrameId(frameId)) {
        return undefined;
      }
      out.push({ rollId, frameId });
    }
    return out;
  };
  const rules: Rule[] = [];
  for (const rule of body.rules) {
    switch (rule.kind) {
      case 'rating':
      case 'shot-after':
      case 'shot-before':
      case 'has':
        rules.push(rule);
        break;
      case 'roll': {
        if (!rule.rolls.every(isRollId)) {
          return undefined;
        }
        rules.push({ kind: 'roll', rolls: rule.rolls.filter(isRollId) });
        break;
      }
      case 'event': {
        const events = slugs(rule.events);
        if (events === undefined) {
          return undefined;
        }
        rules.push({ kind: 'event', events });
        break;
      }
      case 'camera': {
        const cameras = slugs(rule.cameras);
        if (cameras === undefined) {
          return undefined;
        }
        rules.push({ kind: 'camera', cameras });
        break;
      }
      case 'lens': {
        const lenses = slugs(rule.lenses);
        if (lenses === undefined) {
          return undefined;
        }
        rules.push({ kind: 'lens', lenses });
        break;
      }
      case 'film': {
        const films = slugs(rule.films);
        if (films === undefined) {
          return undefined;
        }
        rules.push({ kind: 'film', films });
        break;
      }
    }
  }
  const excluded = refs(body.excluded);
  return excluded === undefined ? undefined : { rules, excluded };
}

/** A selection as the API says it, in the order it's kept. */
export function selectionBody(selection: Selection): FrameSelection {
  return {
    rules: selection.rules.map((rule): FrameSelection['rules'][number] => {
      switch (rule.kind) {
        case 'event':
          return { kind: 'event', events: [...rule.events] };
        case 'roll':
          return { kind: 'roll', rolls: [...rule.rolls] };
        case 'camera':
          return { kind: 'camera', cameras: [...rule.cameras] };
        case 'lens':
          return { kind: 'lens', lenses: [...rule.lenses] };
        case 'film':
          return { kind: 'film', films: [...rule.films] };
        case 'rating':
        case 'shot-after':
        case 'shot-before':
        case 'has':
          return rule;
      }
    }),
    excluded: selection.excluded.map(({ rollId, frameId }) => ({
      rollId,
      frameId,
    })),
  };
}
