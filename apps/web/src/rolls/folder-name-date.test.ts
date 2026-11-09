import { describe, expect, test } from 'vitest';
import { dateInFolderName } from './folder-name-date.ts';

describe('dateInFolderName', () => {
  test.each([
    ['Iceland 2019', '2019', '', ''],
    ['1999 holiday', '1999', '', ''],
    ['2024-08 Iceland', '2024', '08', ''],
    ['2024-08-12 Iceland', '2024', '08', '12'],
    ['2024_08_12 roll', '2024', '08', '12'],
    ['20240812', '2024', '08', '12'],
    ['roll 3, 202408', '2024', '08', ''],
  ])('reads %s', (name, year, month, day) => {
    expect(dateInFolderName(name)).toEqual({ year, month, day });
  });

  test('keeps the first year in a name', () => {
    expect(dateInFolderName('2018 and 2021')?.year).toBe('2018');
  });

  test.each([
    'roll A',
    'Iceland',
    '12340001',
    '20190001',
    'v1.2345',
    '1850 roll',
  ])('finds no year in %s', (name) => {
    expect(dateInFolderName(name)).toBeUndefined();
  });

  test('leaves out a day the month does not have, keeping the month', () => {
    expect(dateInFolderName('2023-02-30')).toEqual({
      year: '2023',
      month: '02',
      day: '',
    });
    expect(dateInFolderName('2024-02-29')?.day).toBe('29');
  });
});
