import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { healthRoutes } from './routes/health.js';
import { apiRoutes } from './routes/api.js';

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', cors());
  app.use('*', logger());

  app.route('/health', healthRoutes);
  app.route('/api', apiRoutes);

  app.get('/', (c) => {
    return c.json({
      name: '@amicus/daemon',
      version: '0.1.0',
      endpoints: ['/health', '/api/status', '/api/tasks', '/api/tokenomics'],
    });
  });

  return app;
}
