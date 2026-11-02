import { expect, test } from 'vitest';
import { assertNever } from './assert-never.ts';

type Shape = 'circle' | 'square';

function sides(shape: Shape): number {
  switch (shape) {
    case 'circle':
      return 0;
    case 'square':
      return 4;
    default:
      return assertNever(shape);
  }
}

test('throws when a value the types rule out reaches it', () => {
  // Simulates data that broke the types, e.g. a bad file that skipped validation.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the point of the test
  const triangle = 'triangle' as Shape;

  expect(() => sides(triangle)).toThrow('Unexpected value: "triangle"');
});
