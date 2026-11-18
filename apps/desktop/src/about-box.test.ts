import { expect, test } from 'vitest';
import { aboutBox } from './about-box.ts';

test('says FilmFile and its version, with a way to GitHub and OK', () => {
  expect(aboutBox({ version: '0.1.0', dev: false })).toEqual({
    title: 'About FilmFile',
    message: 'FilmFile',
    detail: 'Version 0.1.0',
    buttons: ['FilmFile on GitHub', 'OK'],
    defaultId: 1,
    cancelId: 1,
  });
});

test('marks a version run from source', () => {
  expect(aboutBox({ version: '0.1.0', dev: true })).toMatchObject({
    detail: 'Version 0.1.0 (dev)',
  });
});
