import { expect, test } from 'vitest';
import { shotFrom } from './shot-fields.ts';

test.each([
  [{ year: '', month: '', day: '', time: '' }, undefined],
  [{ year: '2026', month: '', day: '', time: '' }, '2026'],
  [{ year: '2026', month: '09', day: '', time: '' }, '2026-09'],
  [{ year: '2026', month: '09', day: '4', time: '' }, '2026-09-04'],
  [{ year: '2026', month: '09', day: '14', time: '06:30' }, '2026-09-14T06:30'],
  [{ year: '2026', month: '', day: '14', time: '06:30' }, '2026'],
])('turns %j into %j', (fields, shot) => {
  expect(shotFrom(fields)).toEqual({ valid: true, shot });
});

test.each([
  { year: '26', month: '', day: '', time: '' },
  { year: '', month: '09', day: '', time: '' },
])('refuses %j, whose year is not four digits', (fields) => {
  expect(shotFrom(fields)).toEqual({ valid: false });
});
