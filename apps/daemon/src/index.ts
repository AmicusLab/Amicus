import { createApp } from './server.js';
import { setupEventBroadcasting } from './ws/events.js';
import { addClient, removeClient, broadcast } from './ws/WebSocketManager.js';

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

setupEventBroadcasting();

interface WSData {
  id: string;
}

const server = Bun.serve<WSData | undefined>({
  port: PORT,
  fetch: app.fetch,
  websocket: {
    open(ws) {
      const clientId = addClient(ws);
      console.log(`[WS] Client connected: ${clientId}`);
      broadcast('connect', { clientId });
    },
    close(ws) {
      const wsData = ws.data as WSData | undefined;
      console.log(`[WS] Client disconnected: ${wsData?.id}`);
      removeClient(ws);
    },
    message(ws, message) {
      const wsData = ws.data as WSData | undefined;
      const data = typeof message === 'string' ? message : message.toString();
      console.log(`[WS] Message from ${wsData?.id}:`, data);
      
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'heartbeat') {
          ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    },
  },
});

console.log(`[Daemon] Server running at http://localhost:${PORT}`);
console.log(`[Daemon] WebSocket available at ws://localhost:${PORT}`);
console.log(`[Daemon] Health check: http://localhost:${PORT}/health`);

export { server };
