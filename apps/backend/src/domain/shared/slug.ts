declare const brand: unique symbol;

/**
 * How a camera, film stock, lens or event is named in the archive: its file
 * name and the value rolls refer to it by, e.g. `nikon-fe`. Lower-case
 * letters and digits in words joined by single dashes.
 */
export type Slug = string & { readonly [brand]: 'Slug' };

const maxLength = 60;

export function isSlug(value: string): value is Slug {
  return value.length <= maxLength && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * The slug for a name, e.g. "Canon AE-1 Program" → `canon-ae-1-program`, or
 * undefined if the name has no letters or digits a slug can use.
 */
export function slugFor(name: string): Slug | undefined {
  const slug = name
    .normalize('NFKD')
    // Accents, split off by NFKD, are dropped: é → e.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');
  return isSlug(slug) ? slug : undefined;
}
