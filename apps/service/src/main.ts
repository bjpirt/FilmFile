import { serve } from '@hono/node-server';
import { composeLocal } from './composition/compose-local.ts';
import { readLocalConfig } from './composition/read-local-config.ts';

const config = readLocalConfig(process.env);

const server = serve(
  { fetch: composeLocal().fetch, hostname: '127.0.0.1', port: config.port },
  (info) => {
    console.log(
      `FilmFile service listening on http://127.0.0.1:${String(info.port)}`,
    );
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
