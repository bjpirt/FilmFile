import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface LocalConfig {
  readonly archivePath: string;
  readonly cachePath: string;
  readonly port: number;
  readonly uiPath: string;
  readonly uiOrigin?: string;
}

interface System {
  readonly platform: NodeJS.Platform;
  readonly home: string;
}

const defaultPort = 4310;

// Where `pnpm build` puts the web UI.
const builtUi = fileURLToPath(new URL('../../../web/dist', import.meta.url));

/** Reads the service's settings from environment variables. */
export function readLocalConfig(
  env: NodeJS.ProcessEnv,
  system: System = { platform: process.platform, home: homedir() },
): LocalConfig {
  const archivePath = env.FILMFILE_ARCHIVE;
  if (archivePath === undefined || archivePath === '') {
    throw new Error(
      'Set FILMFILE_ARCHIVE to the folder that holds the archive.',
    );
  }
  return {
    archivePath,
    cachePath: env.FILMFILE_CACHE ?? defaultCachePath(env, system),
    port: Number(env.FILMFILE_PORT ?? defaultPort),
    uiPath: env.FILMFILE_UI ?? builtUi,
    // Where the UI runs when it isn't served by the backend, e.g. Vite in development.
    ...(env.FILMFILE_UI_ORIGIN === undefined
      ? {}
      : { uiOrigin: env.FILMFILE_UI_ORIGIN }),
  };
}

// Caches live in the OS cache folder, never in the archive.
function defaultCachePath(
  env: NodeJS.ProcessEnv,
  { platform, home }: System,
): string {
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'FilmFile');
  }
  return path.join(env.XDG_CACHE_HOME ?? path.join(home, '.cache'), 'filmfile');
}
