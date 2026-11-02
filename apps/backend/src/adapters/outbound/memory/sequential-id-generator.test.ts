import { expect, test } from 'vitest';
import { SequentialIdGenerator } from './sequential-id-generator.ts';

test('counts up across every kind of ID', () => {
  const ids = new SequentialIdGenerator();

  expect([ids.newRollId(), ids.newFrameId(), ids.newVersionId()]).toEqual([
    '00000000000000000000000001',
    '00000000000000000000000002',
    '00000000000000000000000003',
  ]);
});
