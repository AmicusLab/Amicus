import { Hono } from 'hono';
import { getSystemHealth } from '../services/SystemMonitor.js';

export const healthRoutes = new Hono();

healthRoutes.get('/', (c) => {
  return c.json({ status: 'ok' });
});

healthRoutes.get('/detailed', (c) => {
  return c.json(getSystemHealth());
});
