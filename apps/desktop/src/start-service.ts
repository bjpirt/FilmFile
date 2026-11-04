import { utilityProcess } from 'electron';
import { fileURLToPath } from 'node:url';
import { freePort } from './free-port.ts';
import { waitForService } from './wait-for-service.ts';

/** The running service: where it listens, and how to stop it. */
export interface Service {
  readonly origin: string;
  /** Stops it as Ctrl+C would, letting requests in progress (saves among them) finish. */
  stop(): Promise<void>;
}

// The service's own entry point, run as it is: Electron's Node.js strips the types.
const serviceMain = fileURLToPath(
  new URL('../../backend/src/main.ts', import.meta.url),
);

/**
 * Starts the service in its own process on a free port of 127.0.0.1, with
 * this process's settings (the archive among them), and resolves once it
 * answers.
 */
export async function startService(): Promise<Service> {
  const port = await freePort();
  const service = utilityProcess.fork(serviceMain, [], {
    env: { ...process.env, FILMFILE_PORT: String(port) },
    serviceName: 'FilmFile service',
    stdio: 'inherit',
  });
  const exited = new Promise<number>((resolve) => {
    service.once('exit', resolve);
  });
  const origin = `http://127.0.0.1:${String(port)}`;
  const stop = async () => {
    service.kill();
    await exited;
  };

  try {
    await Promise.race([
      waitForService(origin),
      exited.then((code) => {
        throw new Error(
          `The FilmFile service stopped as it started (exit code ${String(code)}).`,
        );
      }),
    ]);
  } catch (error) {
    await stop();
    throw error;
  }
  return { origin, stop };
}
