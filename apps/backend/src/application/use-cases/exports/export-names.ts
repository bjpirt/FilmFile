import type { Layout } from '../../ports/export-tickets.ts';

/** What a file name pattern can use, in braces: `{roll}-{frame}`. */
export const placeholders = [
  'roll',
  'frame',
  'title',
  'year',
  'original',
] as const;

type Placeholder = (typeof placeholders)[number];

/** What a frame's file name is made from. */
export interface NameParts {
  /** The roll's number. */
  readonly roll: string;
  /** The frame's number, or `frame` when it has none. */
  readonly frame: string;
  /** The frame's title, or nothing. */
  readonly title: string;
  /** The year it was shot, or `undated`. */
  readonly year: string;
  /** The scan's own file name, without its extension. */
  readonly original: string;
}

/** The pattern a single frame, and a first export, is named by. */
export const defaultPattern = '{roll}-{frame}';

/** The braces in a pattern that aren't a placeholder, e.g. `{rol}`. */
export function unknownPlaceholders(pattern: string): string[] {
  return [...pattern.matchAll(/\{([^{}]*)\}/g)]
    .map((match) => match[1] ?? '')
    .filter((name) => !placeholders.some((known) => known === name));
}

/**
 * Text made safe to be a file or folder name anywhere: no slashes, colons
 * or other characters a system refuses, no runs of spaces, and not starting
 * with a dot.
 */
export function safeName(text: string): string {
  return text
    .replace(/[\p{Cc}/\\:*?"<>|]+/gu, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .replace(/[-_.\s]+$/, '')
    .trim();
}

/** A pattern filled in for one frame, made safe; the default pattern if nothing is left. */
export function fileNameOf(pattern: string, parts: NameParts): string {
  const filled = pattern.replace(/\{([^{}]*)\}/g, (whole, name: string) => {
    const value = placeholders.find((known) => known === name);
    return value === undefined ? whole : parts[value satisfies Placeholder];
  });
  const named = safeName(filled);
  return named === '' ? safeName(`${parts.roll}-${parts.frame}`) : named;
}

/** The folders a layout puts a frame's file in: none, the roll's, or the year's then the roll's. */
function foldersFor(layout: Layout, parts: NameParts): string[] {
  switch (layout) {
    case 'flat':
      return [];
    case 'roll-folder':
      return [safeName(parts.roll)];
    case 'year-roll':
      return [safeName(parts.year), safeName(parts.roll)];
  }
}

/** A path with `-2`, `-3` after its name, before the extension; the path itself for 1. */
export function numberedPath(path: string, n: number): string {
  if (n === 1) {
    return path;
  }
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  return dot > slash + 1
    ? `${path.slice(0, dot)}-${String(n)}${path.slice(dot)}`
    : `${path}-${String(n)}`;
}

/**
 * Gives each exported file its path in the zip, as the layout and names say.
 * Names that would be the same (whatever their case, since some systems
 * can't tell them apart) get `-2`, `-3` after them.
 */
export class FilePaths {
  readonly #taken = new Set<string>();
  readonly #layout: Layout;
  readonly #pattern: string;

  constructor(layout: Layout, pattern: string) {
    this.#layout = layout;
    this.#pattern = pattern;
  }

  next(parts: NameParts): string {
    const folder = [...foldersFor(this.#layout, parts), ''].join('/');
    const name = fileNameOf(this.#pattern, parts);
    for (let n = 1; ; n += 1) {
      const path = numberedPath(`${folder}${name}.jpg`, n);
      if (!this.#taken.has(path.toLowerCase())) {
        this.#taken.add(path.toLowerCase());
        return path;
      }
    }
  }
}
