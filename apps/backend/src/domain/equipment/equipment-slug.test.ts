import { expect, test } from 'vitest';
import { isEquipmentSlug, slugFor } from './equipment-slug.ts';

test.each([
  ['Nikon FE', 'nikon-fe'],
  ['  Canon AE-1 Program ', 'canon-ae-1-program'],
  ['Hasselblad 500C/M', 'hasselblad-500c-m'],
  ['Rolleiflex 2.8F', 'rolleiflex-2-8f'],
  ['Zeiss Ikon Contaflex Super BC', 'zeiss-ikon-contaflex-super-bc'],
  ['Fujifilm Klasse W (élite)', 'fujifilm-klasse-w-elite'],
])('makes %j into %j', (name, slug) => {
  expect(slugFor(name)).toBe(slug);
});

test.each(['', '   ', '!!!', '日本'])(
  'has no slug for %j, which has no letters or digits it can use',
  (name) => {
    expect(slugFor(name)).toBeUndefined();
  },
);

test('keeps a slug to 60 characters, without a dash at the end', () => {
  const slug = slugFor(`${'a'.repeat(59)} b`);

  expect(slug).toBe('a'.repeat(59));
});

test.each(['nikon-fe', 'a', '500c'])('accepts %j as a slug', (slug) => {
  expect(isEquipmentSlug(slug)).toBe(true);
});

test.each(['Nikon-FE', '-fe', 'fe-', 'nikon--fe', '../fe', 'a'.repeat(61)])(
  'refuses %j as a slug',
  (slug) => {
    expect(isEquipmentSlug(slug)).toBe(false);
  },
);
