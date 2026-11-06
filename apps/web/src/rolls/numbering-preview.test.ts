import { describe, expect, test } from 'vitest';
import { aRoll } from '../testing/fake-archive.ts';
import { numberingPreview } from './numbering-preview.ts';

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
      numberingPreview([filed, selected], [], {
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
      numberingPreview([filed, reserved, selected], [], {
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

  test('sorts by shot date, then current roll number', () => {
    const later = versioned(aRoll('2026-009', { shot: '2026-03-01' }));
    const tieLater = versioned(aRoll('2026-004', { shot: '2026-03' }));
    const tieEarlier = versioned(aRoll('2026-002', { shot: '2026-03' }));

    expect(
      numberingPreview([later, tieLater, tieEarlier], [], {
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
      numberingPreview(
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
      numberingPreview([versioned(aRoll('2026-001'))], [], {
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
      numberingPreview([filed, selected], [], {
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
      numberingPreview(rolls, [], {
        year: undefined,
        camera: undefined,
        film: undefined,
        lens: undefined,
      }),
    ).toEqual({ ok: true, changes: [] });
  });
});
