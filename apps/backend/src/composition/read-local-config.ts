import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface LocalConfig {
  /** The FilmFile folder: everything FilmFile keeps (D57). */
  readonly folderPath: string;
  /** The library, the folder's `Library/` (D63). */
  readonly archivePath: string;
  readonly cachePath: string;
  readonly port: number;
  readonly uiPath: string;
  readonly uiOrigin?: string;
  /** The AWS credentials file whose `[filmfile]` profile holds the keys that publish a site (D111). */
  readonly awsCredentialsFile: string;
  /**
   * Where Cloudflare R2 is, for every account, in place of its own address:
   * for testing only, against a local fake (FF-234). Read only from the
   * environment, never from a request.
   */
  readonly r2Endpoint?: string;
}

interface System {
  readonly platform: NodeJS.Platform;
  readonly home: string;
}

const defaultPort = 4310;

/** The library's folder inside the FilmFile folder (D63). */
export const libraryName = 'Library';

// Where `pnpm build` puts the web UI.
const builtUi = fileURLToPath(new URL('../../../web/dist', import.meta.url));

/** Reads the service's settings from environment variables. */
export function readLocalConfig(
  env: NodeJS.ProcessEnv,
  system: System = { platform: process.platform, home: homedir() },
): LocalConfig {
  const folderPath = env.FILMFILE_FOLDER;
  if (folderPath === undefined || folderPath === '') {
    throw new Error('Set FILMFILE_FOLDER to your FilmFile folder.');
  }
  if (!path.isAbsolute(folderPath)) {
    throw new Error('FILMFILE_FOLDER must be an absolute path.');
  }
  return {
    folderPath,
    archivePath: path.join(folderPath, libraryName),
    cachePath: env.FILMFILE_CACHE ?? defaultCachePath(env, system),
    port: Number(env.FILMFILE_PORT ?? defaultPort),
    uiPath: env.FILMFILE_UI ?? builtUi,
    awsCredentialsFile:
      env.AWS_SHARED_CREDENTIALS_FILE ??
      path.join(system.home, '.aws', 'credentials'),
    ...(env.FILMFILE_R2_ENDPOINT === undefined
      ? {}
      : { r2Endpoint: env.FILMFILE_R2_ENDPOINT }),
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
