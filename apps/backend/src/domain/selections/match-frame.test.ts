import { describe, expect, test } from 'vitest';
import { isFrameId, isRollId } from '../shared/ids.ts';
import { isSlug } from '../shared/slug.ts';
import type { VersionKind } from '../rolls/version-kind.ts';
import type { FrameFacts } from './frame-facts.ts';
import { matchSelection, matchesRule } from './match-frame.ts';
import type { Rule, Selection } from './selection.ts';
import { compareShotOrder } from './shot-order.ts';

function slug(value: string) {
  if (!isSlug(value)) {
    throw new Error(`bad test data: ${value}`);
  }
  return value;
}

const rollId = ((): FrameFacts['rollId'] => {
  const id = '1'.padStart(26, '0');
  if (!isRollId(id)) {
    throw new Error('bad test data');
  }
  return id;
})();

function frameId(n: number): FrameFacts['frameId'] {
  const id = String(n).padStart(26, '0');
  if (!isFrameId(id)) {
    throw new Error('bad test data');
  }
  return id;
}

function aFrame(over: Partial<FrameFacts> = {}): FrameFacts {
  return {
    rollId,
    frameId: frameId(1),
    rollNumber: '2026-001',
    position: 0,
    hidden: false,
    rating: null,
    event: undefined,
    camera: undefined,
    lens: undefined,
    film: undefined,
    shot: undefined,
    versionKinds: new Set<VersionKind>(['scan']),
    ...over,
  };
}

const rules = (...list: Rule[]): Selection => ({
  rules: list,
  excluded: [],
});

describe('rules', () => {
  test('rating: at least, and unrated never', () => {
    const rule: Rule = { kind: 'rating', atLeast: 4 };
    expect(matchesRule(rule, aFrame({ rating: 4 }))).toBe(true);
    expect(matchesRule(rule, aFrame({ rating: 5 }))).toBe(true);
    expect(matchesRule(rule, aFrame({ rating: 3 }))).toBe(false);
    expect(matchesRule(rule, aFrame({ rating: null }))).toBe(false);
  });

  test.each([
    ['event', { kind: 'event', events: [slug('iceland')] }, 'event'],
    ['camera', { kind: 'camera', cameras: [slug('leica-m6')] }, 'camera'],
    ['lens', { kind: 'lens', lenses: [slug('summicron')] }, 'lens'],
    ['film', { kind: 'film', films: [slug('portra-400')] }, 'film'],
  ] as const)(
    '%s: any of the values, never when the frame has none',
    (_name, rule, field) => {
      const value = Object.values(rule)[1]?.[0];
      expect(matchesRule(rule, aFrame({ [field]: value }))).toBe(true);
      expect(matchesRule(rule, aFrame({ [field]: slug('other') }))).toBe(false);
      expect(matchesRule(rule, aFrame())).toBe(false);
    },
  );

  test('roll: any of the rolls', () => {
    const rule: Rule = { kind: 'roll', rolls: [rollId] };
    expect(matchesRule(rule, aFrame())).toBe(true);
    expect(matchesRule({ kind: 'roll', rolls: [] }, aFrame())).toBe(false);
  });

  test('shot dates are compared at the limit’s precision, undated never match', () => {
    const after: Rule = { kind: 'shot-after', date: '2026-09' };
    const before: Rule = { kind: 'shot-before', date: '2026-09' };
    const inSeptember = aFrame({ shot: '2026-09-14T15:30' });
    expect(matchesRule(after, inSeptember)).toBe(true);
    expect(matchesRule(before, inSeptember)).toBe(true);
    expect(matchesRule(after, aFrame({ shot: '2026-08-31' }))).toBe(false);
    expect(matchesRule(before, aFrame({ shot: '2026-10-01' }))).toBe(false);
    expect(matchesRule(after, aFrame({ shot: '2027' }))).toBe(true);
    expect(matchesRule(after, aFrame())).toBe(false);
    expect(matchesRule(before, aFrame())).toBe(false);
  });

  test('a year limit matches any day in the year', () => {
    expect(
      matchesRule(
        { kind: 'shot-before', date: '2026' },
        aFrame({ shot: '2026-12-31' }),
      ),
    ).toBe(true);
    expect(
      matchesRule(
        { kind: 'shot-after', date: '2026-09-14' },
        aFrame({ shot: '2026-09' }),
      ),
    ).toBe(false);
  });

  test('has: a version of the kind', () => {
    const final = new Set<VersionKind>(['scan', 'final']);
    expect(
      matchesRule(
        { kind: 'has', version: 'final' },
        aFrame({ versionKinds: final }),
      ),
    ).toBe(true);
    expect(matchesRule({ kind: 'has', version: 'raw-scan' }, aFrame())).toBe(
      false,
    );
  });
});

describe('selections', () => {
  test('with no rules every frame is on it', () => {
    expect(matchSelection(rules(), aFrame())).toBe('included');
  });

  test('a frame must meet every rule', () => {
    const selection = rules(
      { kind: 'rating', atLeast: 4 },
      { kind: 'event', events: [slug('iceland')] },
    );
    expect(
      matchSelection(selection, aFrame({ rating: 5, event: slug('iceland') })),
    ).toBe('included');
    expect(matchSelection(selection, aFrame({ rating: 5 }))).toBeUndefined();
  });

  test('a frame excluded by hand is found, but marked excluded', () => {
    const selection: Selection = {
      rules: [],
      excluded: [{ rollId, frameId: frameId(1) }],
    };
    expect(matchSelection(selection, aFrame())).toBe('excluded');
    expect(matchSelection(selection, aFrame({ frameId: frameId(2) }))).toBe(
      'included',
    );
  });

  test('an excluded frame the rules no longer find is not found', () => {
    const selection: Selection = {
      rules: [{ kind: 'rating', atLeast: 5 }],
      excluded: [{ rollId, frameId: frameId(1) }],
    };
    expect(matchSelection(selection, aFrame())).toBeUndefined();
  });

  test('a hidden frame is never found, excluded or not', () => {
    expect(matchSelection(rules(), aFrame({ hidden: true }))).toBeUndefined();
  });
});

describe('shot order', () => {
  test('earlier first, undated last, then roll number and place on the roll', () => {
    const frames = [
      aFrame({ frameId: frameId(1), rollNumber: '2026-002', shot: undefined }),
      aFrame({ frameId: frameId(2), shot: '2026-09-02' }),
      aFrame({
        frameId: frameId(3),
        rollNumber: '2026-010',
        shot: '2026-09-01',
        position: 0,
      }),
      aFrame({
        frameId: frameId(4),
        rollNumber: '2026-002',
        shot: '2026-09-01',
        position: 3,
      }),
      aFrame({
        frameId: frameId(5),
        rollNumber: '2026-002',
        shot: '2026-09-01',
        position: 1,
      }),
    ];
    expect(
      [...frames].sort(compareShotOrder).map((frame) => frame.frameId),
    ).toEqual([frameId(5), frameId(4), frameId(3), frameId(2), frameId(1)]);
  });
});
