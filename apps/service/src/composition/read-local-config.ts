export interface LocalConfig {
  readonly port: number;
}

const defaultPort = 4310;

/** Reads the service's settings from environment variables. */
export function readLocalConfig(env: NodeJS.ProcessEnv): LocalConfig {
  return { port: Number(env.FILMFILE_PORT ?? defaultPort) };
}
