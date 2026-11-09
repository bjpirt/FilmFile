import { describe, expect, test } from 'vitest';
import { aRoll } from '../testing/fake-archive.ts';
import { numberingPreview } from './numbering-preview.ts';
import { patternOf } from './roll-number-pattern.ts';

function preview(
  snapshot: Parameters<typeof numberingPreview>[0],
  unreadable: Parameters<typeof numberingPreview>[1],
  filters: Parameters<typeof numberingPreview>[2],
  pattern = '{year}-{n:3}',
) {
  return numberingPreview(snapshot, unreadable, filters, patternOf(pattern));
}

function versioned(roll: ReturnType<typeof aRoll>, version = 'v1') {
  return { roll, version };
}

describe('numberingPreview', () => {
  test('uses the shot year and starts after the highest filed number', () => {
    const filed = versioned(
      aRoll('2025-003', { filed: true, shot: '2024-12' }),
    );
    const selected = versioned(
      aRoll('2024-001', { shot: '2025-03', camera: 'canon' }),
    );

    expect(
      preview([filed, selected], [], {
        year: '2025',
        camera: 'canon',
        film: undefined,
        lens: undefined,
      }),
    ).toEqual({
      ok: true,
      changes: [{ id: selected.roll.id, roll: '2025-004' }],
    });
  });

  test('leaves gaps below filed numbers unused and skips filtered-out numbers', () => {
    const filed = versioned(aRoll('2025-003', { filed: true, shot: '2025' }));
    const reserved = versioned(
      aRoll('2025-004', { shot: '2025', camera: 'nikon' }),
    );
    const selected = versioned(
      aRoll('2025-001', { shot: '2025', camera: 'canon' }),
    );

    expect(
      preview([filed, reserved, selected], [], {
        year: '2025',
        camera: 'canon',
        film: undefined,
        lens: undefined,
      }),
    ).toEqual({
      ok: true,
      changes: [{ id: selected.roll.id, roll: '2025-005' }],
    });
  });

  test('skips a filtered-out label with an equivalent numeric suffix', () => {
    const reserved = versioned(
      aRoll('2026-1', { shot: '2026', camera: 'nikon' }),
    );
    const selected = versioned(
      aRoll('BP/selected', { shot: '2026', camera: 'canon' }),
    );

    expect(
      preview([reserved, selected], [], {
        year: '2026',
        camera: 'canon',
        film: undefined,
        lens: undefined,
      }),
    ).toEqual({
      ok: true,
      changes: [{ id: selected.roll.id, roll: '2026-002' }],
    });
  });

  test('uses natural roll-number order for rolls with the same shot date', () => {
    const ten = versioned(aRoll('Roll 10', { shot: '2026-03' }));
    const two = versioned(aRoll('Roll 2', { shot: '2026-03' }));

    expect(
      preview([ten, two], [], {
        year: undefined,
        camera: undefined,
        film: undefined,
        lens: undefined,
      }),
    ).toEqual({
      ok: true,
      changes: [
        { id: two.roll.id, roll: '2026-001' },
        { id: ten.roll.id, roll: '2026-002' },
      ],
    });
  });

  test('sorts by shot date, then current roll number', () => {
    const later = versioned(aRoll('2026-009', { shot: '2026-03-01' }));
    const tieLater = versioned(aRoll('2026-004', { shot: '2026-03' }));
    const tieEarlier = versioned(aRoll('2026-002', { shot: '2026-03' }));

    expect(
      preview([later, tieLater, tieEarlier], [], {
        year: undefined,
        camera: undefined,
        film: undefined,
        lens: undefined,
      }),
    ).toEqual({
      ok: true,
      changes: [
        { id: tieEarlier.roll.id, roll: '2026-001' },
        { id: tieLater.roll.id, roll: '2026-002' },
        { id: later.roll.id, roll: '2026-003' },
      ],
    });
  });

  test('uses unreadable folder numbers as reserved numbers', () => {
    const selected = versioned(aRoll('2026-001', { shot: '2026' }));

    expect(
      preview(
        [selected],
        [{ folder: '2026-001-ABCD1234', problem: 'broken' }],
        {
          year: undefined,
          camera: undefined,
          film: undefined,
          lens: undefined,
        },
      ),
    ).toEqual({
      ok: true,
      changes: [{ id: selected.roll.id, roll: '2026-002' }],
    });
  });

  test('reports rolls that have no shot year', () => {
    expect(
      preview([versioned(aRoll('2026-001'))], [], {
        year: undefined,
        camera: undefined,
        film: undefined,
        lens: undefined,
      }),
    ).toEqual({ ok: false, kind: 'missing-shot-year' });
  });

  test('proposes the overflow number so Apply can refuse the whole batch', () => {
    const filed = versioned(aRoll('2026-999', { filed: true, shot: '2026' }));
    const selected = versioned(aRoll('2026-001', { shot: '2026' }));

    expect(
      preview([filed, selected], [], {
        year: undefined,
        camera: undefined,
        film: undefined,
        lens: undefined,
      }),
    ).toEqual({
      ok: true,
      changes: [{ id: selected.roll.id, roll: '2026-1000' }],
    });
  });

  test('returns no changes when the rolls are already numbered in date order', () => {
    const rolls = [
      versioned(aRoll('2026-001', { shot: '2026-01' })),
      versioned(aRoll('2026-002', { shot: '2026-02' })),
    ];

    expect(
      preview(rolls, [], {
        year: undefined,
        camera: undefined,
        film: undefined,
        lens: undefined,
      }),
    ).toEqual({ ok: true, changes: [] });
  });

  describe('with a custom pattern (D88)', () => {
    const everything = {
      year: undefined,
      camera: undefined,
      film: undefined,
      lens: undefined,
    };

    test('counts each month on its own, in shot-date order', () => {
      const october = versioned(aRoll('x1', { shot: '2026-10-03' }));
      const september2 = versioned(aRoll('x2', { shot: '2026-09-20' }));
      const september1 = versioned(aRoll('x3', { shot: '2026-09-02' }));

      expect(
        preview(
          [october, september2, september1],
          [],
          everything,
          '{year}{month}-{n:2}',
        ),
      ).toEqual({
        ok: true,
        changes: [
          { id: september1.roll.id, roll: '202609-01' },
          { id: september2.roll.id, roll: '202609-02' },
          { id: october.roll.id, roll: '202610-01' },
        ],
      });
    });

    test('uses one counter across years without date tokens, after the filed ones', () => {
      const filed = versioned(aRoll('BP07', { filed: true, shot: '2020' }));
      const first = versioned(aRoll('x1', { shot: '2025' }));
      const second = versioned(aRoll('x2', { shot: '2026' }));

      expect(
        preview([filed, second, first], [], everything, 'BP{n:2}'),
      ).toEqual({
        ok: true,
        changes: [
          { id: first.roll.id, roll: 'BP08' },
          { id: second.roll.id, roll: 'BP09' },
        ],
      });
    });

    test('counts each event on its own, skipping numbers of rolls that stay', () => {
      const staying = versioned(
        aRoll('iceland-01', {
          shot: '2026',
          event: 'iceland',
          camera: 'nikon',
        }),
      );
      const first = versioned(
        aRoll('x1', { shot: '2026', event: 'iceland', camera: 'canon' }),
      );
      const japan = versioned(
        aRoll('x2', { shot: '2026', event: 'japan', camera: 'canon' }),
      );

      expect(
        preview(
          [staying, first, japan],
          [],
          { ...everything, camera: 'canon' },
          '{event}-{n:2}',
        ),
      ).toEqual({
        ok: true,
        changes: [
          { id: first.roll.id, roll: 'iceland-02' },
          { id: japan.roll.id, roll: 'japan-01' },
        ],
      });
    });

    test('ignores filed numbers in another form, though they stay occupied', () => {
      const filed = versioned(aRoll('2026-050', { filed: true, shot: '2026' }));
      const selected = versioned(aRoll('x1', { shot: '2026' }));

      expect(preview([filed, selected], [], everything, '{n:3}')).toEqual({
        ok: true,
        changes: [{ id: selected.roll.id, roll: '001' }],
      });
    });

    test('reports a roll that lacks a month or event the pattern uses', () => {
      const year = versioned(aRoll('x1', { shot: '2026' }));

      expect(preview([year], [], everything, '{year}{month}-{n:2}')).toEqual({
        ok: false,
        kind: 'missing-pattern-details',
        missing: 'a shot month',
      });
      expect(preview([year], [], everything, '{event}-{n:2}')).toEqual({
        ok: false,
        kind: 'missing-pattern-details',
        missing: 'an event',
      });
    });
  });
});
