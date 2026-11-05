import { app, utilityProcess } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePort } from './free-port.ts';
import { waitForService } from './wait-for-service.ts';

/** The running service: where it listens, and how to stop it. */
export interface Service {
  readonly origin: string;
  /** Stops it as Ctrl+C would, letting requests in progress (saves among them) finish. */
  stop(): Promise<void>;
}

/**
 * Where the service starts from. From source, its own entry point, run as it
 * is (Electron's Node.js strips the types); packaged, the bundle and the
 * built UI that `scripts/package.ts` puts beside the app's own (U84).
 */
function serviceFiles(): { readonly main: string; readonly ui?: string } {
  if (!app.isPackaged) {
    return {
      main: fileURLToPath(
        new URL('../../backend/src/main.ts', import.meta.url),
      ),
    };
  }
  const root = app.getAppPath();
  return {
    main: path.join(root, 'service.mjs'),
    ui: path.join(root, 'web'),
  };
}

/**
 * Starts the service on the FilmFile folder `folder` in its own process, on a
 * free port of 127.0.0.1 (or FILMFILE_PORT's) and with this process's other
 * settings, and resolves once it answers. The service checks the folder and
 * stops, saying why, if it isn't a FilmFile folder (D63).
 */
export async function startService(folder: string): Promise<Service> {
  // A port given is used as it is, so the packaged app can be checked from outside.
  const given = Number(process.env.FILMFILE_PORT ?? '');
  const port = Number.isInteger(given) && given > 0 ? given : await freePort();
  const { main, ui } = serviceFiles();
  const service = utilityProcess.fork(main, [], {
    env: {
      ...process.env,
      FILMFILE_FOLDER: folder,
      FILMFILE_PORT: String(port),
      ...(ui === undefined ? {} : { FILMFILE_UI: ui }),
    },
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
