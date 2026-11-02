import { Hono } from 'hono';
import { rollRoutes } from './routes/rolls.ts';

export function createApp(config: {
  readonly archivePath: string;
  readonly cachePath: string;
}): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ status: 'ok' }));
  app.route('/api/rolls', rollRoutes(config));

  return app;
}
