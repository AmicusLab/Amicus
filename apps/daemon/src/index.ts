import { serve } from '@hono/node-server';
import { createApp, setupWebSocket } from './server.js';
import { setupEventBroadcasting, setupTokenomicsBroadcasting } from './ws/events.js';
import { startEngine } from './services/EngineService.js';
import { mcpService } from './services/MCPService.js';

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();
const { injectWebSocket } = setupWebSocket(app);

setupEventBroadcasting();
const stopTokenomicsBroadcasting = setupTokenomicsBroadcasting();

startEngine().catch((error: unknown) => {
  console.error('[Daemon] Failed to start engine:', error);
});

const server = serve({ fetch: app.fetch, port: PORT });
injectWebSocket(server);

process.on('SIGTERM', async () => {
  console.log('[Daemon] SIGTERM received, shutting down gracefully...');
  stopTokenomicsBroadcasting();
  await mcpService.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Daemon] SIGINT received, shutting down gracefully...');
  stopTokenomicsBroadcasting();
  await mcpService.shutdown();
  process.exit(0);
});

console.log(`[Daemon] Server running at http://localhost:${PORT}`);
console.log(`[Daemon] WebSocket available at ws://localhost:${PORT}/ws`);
console.log(`[Daemon] Health check: http://localhost:${PORT}/health`);

export { server };
