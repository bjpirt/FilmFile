import { homedir } from 'node:os';
import path from 'node:path';

export interface LocalConfig {
  readonly archivePath: string;
  readonly cachePath: string;
  readonly port: number;
}

interface System {
  readonly platform: NodeJS.Platform;
  readonly home: string;
}

const defaultPort = 4310;

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
