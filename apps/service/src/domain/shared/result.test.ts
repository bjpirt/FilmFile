import { describe, expect, test } from 'vitest';
import { err, ok, type Result } from './result.ts';

function parsePositive(input: number): Result<number, 'not-positive'> {
  return input > 0 ? ok(input) : err('not-positive');
}

describe('Result', () => {
  test('ok carries the value of a success', () => {
    const result = parsePositive(3);

    expect(result).toEqual({ ok: true, value: 3 });
  });

  test('err carries the error of an expected failure', () => {
    const result = parsePositive(-1);

    expect(result).toEqual({ ok: false, error: 'not-positive' });
  });

  test('checking ok narrows to the value or the error', () => {
    const result = parsePositive(5);

    const described = result.ok
      ? `value ${String(result.value)}`
      : result.error;

    expect(described).toBe('value 5');
  });
});
