import { serve } from '@hono/node-server';
import { createApp, setupWebSocket } from './server.js';
import { setupEventBroadcasting } from './ws/events.js';
import { startEngine } from './services/EngineService.js';

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();
const { injectWebSocket } = setupWebSocket(app);

setupEventBroadcasting();
startEngine();

const server = serve({ fetch: app.fetch, port: PORT });
injectWebSocket(server);

console.log(`[Daemon] Server running at http://localhost:${PORT}`);
console.log(`[Daemon] WebSocket available at ws://localhost:${PORT}/ws`);
console.log(`[Daemon] Health check: http://localhost:${PORT}/health`);

export { server };
