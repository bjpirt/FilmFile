import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// Replaced with the version by package.ts when it bundles the app; never
// defined when run from source. The service reads its own the same way
// (apps/backend's app-version.ts): the app imports nothing of the service's.
declare const FILMFILE_VERSION: string | undefined;

/** FilmFile's version, and whether it's run from source (FF-194). */
export interface AppVersion {
  readonly version: string;
  readonly dev: boolean;
}

/**
 * The version the app was bundled with, or, run from source, the one in the
 * root package.json, the only place it's kept (D125), marked as dev.
 */
export function appVersion(
  bundled: string | undefined = typeof FILMFILE_VERSION === 'string'
    ? FILMFILE_VERSION
    : undefined,
  rootPackage: string = path.resolve(
    import.meta.dirname,
    '../../../package.json',
  ),
): AppVersion {
  if (bundled !== undefined) {
    return { version: bundled, dev: false };
  }
  const { version } = z
    .object({ version: z.string() })
    .parse(JSON.parse(readFileSync(rootPackage, 'utf8')));
  return { version, dev: true };
}
