import { serve } from '@hono/node-server';
import { composeLocal, localStartup } from './composition/compose-local.ts';
import { prepareFolder } from './composition/prepare-folder.ts';
import { readLocalConfig } from './composition/read-local-config.ts';

// A missing setting or a folder that isn't a FilmFile folder stops the
// service with a message (exit code 1), not a stack trace.
async function readConfig() {
  try {
    const config = readLocalConfig(process.env);
    await prepareFolder(config.folderPath);
    return config;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

const config = await readConfig();

const server = serve(
  {
    fetch: composeLocal(config).fetch,
    hostname: '127.0.0.1',
    port: config.port,
  },
  (info) => {
    console.log(
      `FilmFile service listening on http://127.0.0.1:${String(info.port)}`,
    );
    // Once, in the background: the service answers requests meanwhile (FF-109).
    void localStartup(config, console.log);
  },
);

// Finish in-flight requests, then exit, when stopped with Ctrl+C or by a service manager.
function stop(): void {
  server.close(() => {
    process.exit(0);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
