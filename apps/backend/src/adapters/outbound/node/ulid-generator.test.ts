import { expect, test } from 'vitest';
import { UlidGenerator } from './ulid-generator.ts';

test('makes a different ULID each time, of each kind', () => {
  const ids = new UlidGenerator();

  const made = [ids.newRollId(), ids.newFrameId(), ids.newVersionId()];

  for (const id of made) {
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  }
  expect(new Set(made).size).toBe(3);
});
