import { expect, test } from 'vitest';
import { readLocalConfig } from './read-local-config.ts';

test('uses port 4310 when none is set', () => {
  expect(readLocalConfig({})).toEqual({ port: 4310 });
});

test('reads the port from FILMFILE_PORT', () => {
  expect(readLocalConfig({ FILMFILE_PORT: '5000' })).toEqual({ port: 5000 });
});
