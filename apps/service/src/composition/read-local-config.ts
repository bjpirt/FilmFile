export interface LocalConfig {
  readonly archivePath: string;
  readonly port: number;
}

const defaultPort = 4310;

/** Reads the service's settings from environment variables. */
export function readLocalConfig(env: NodeJS.ProcessEnv): LocalConfig {
  const archivePath = env.FILMFILE_ARCHIVE;
  if (archivePath === undefined || archivePath === '') {
    throw new Error(
      'Set FILMFILE_ARCHIVE to the folder that holds the archive.',
    );
  }
  return { archivePath, port: Number(env.FILMFILE_PORT ?? defaultPort) };
}
