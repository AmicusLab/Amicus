import { serve } from '@hono/node-server';
import { createApp, setupWebSocket } from './server.js';
import { setupEventBroadcasting, setupTokenomicsBroadcasting } from './ws/events.js';
import { startEngine } from './services/EngineService.js';
import { mcpService } from './services/MCPService.js';
import { configManager, initializeConfig } from './services/ConfigService.js';
import { getPairingState } from './admin/pairing.js';

let server: ReturnType<typeof serve> | undefined;

async function main(): Promise<void> {
  await initializeConfig();
  const cfg = configManager.getConfig();
  const PORT = Number(process.env.PORT) || cfg.daemon.port;

  const pairing = getPairingState();
  if (pairing) {
    console.log(`[Admin] Pairing code: ${pairing.code} (expires: ${new Date(pairing.expiresAtMs).toISOString()})`);
  }

  const app = createApp();
  const { injectWebSocket } = setupWebSocket(app);

  setupEventBroadcasting();
  const stopTokenomicsBroadcasting = setupTokenomicsBroadcasting();

  startEngine().catch((error: unknown) => {
    console.error('[Daemon] Failed to start engine:', error);
  });

  server = serve({ fetch: app.fetch, port: PORT });
  injectWebSocket(server);

  const shutdown = async (signal: string) => {
    console.log(`[Daemon] ${signal} received, shutting down gracefully...`);
    stopTokenomicsBroadcasting();
    await mcpService.shutdown();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  console.log(`[Daemon] Server running at http://localhost:${PORT}`);
  console.log(`[Daemon] WebSocket available at ws://localhost:${PORT}/ws`);
  console.log(`[Daemon] Health check: http://localhost:${PORT}/health`);
}

void main().catch((error: unknown) => {
  console.error('[Daemon] Fatal startup error:', error);
  process.exit(1);
});

export { server };
