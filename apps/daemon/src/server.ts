import { Buffer } from 'node:buffer';
import { createNodeWebSocket } from '@hono/node-ws';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { healthRoutes } from './routes/health.js';
import { apiRoutes } from './routes/api.js';
import { providerRoutes } from './routes/providers.js';
import {
  addClient,
  removeClient,
  getClientCount,
  getClientId,
  sendMessage,
  broadcast,
  startHeartbeat,
  type WSClient,
} from './ws/WebSocketManager.js';

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', cors());
  app.use('*', logger());

  app.route('/health', healthRoutes);
  app.route('/api', apiRoutes);
  app.route('/api', providerRoutes);

  app.get('/', (c) => {
    return c.json({
      name: '@amicus/daemon',
      version: '0.1.0',
      endpoints: ['/health', '/api/status', '/api/tasks', '/api/tokenomics', '/api/llm-providers', '/api/mcp-servers'],
    });
  });

  return app;
}

function toTextMessage(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString();
  if (data instanceof Uint8Array) return Buffer.from(data).toString();
  if (Array.isArray(data)) {
    const buffers = data.map((chunk) => {
      if (typeof chunk === 'string') return Buffer.from(chunk);
      if (chunk instanceof ArrayBuffer) return Buffer.from(chunk);
      if (chunk instanceof Uint8Array) return Buffer.from(chunk);
      return Buffer.from(String(chunk));
    });
    return Buffer.concat(buffers).toString();
  }
  return null;
}

type IncomingMessage = {
  type: string;
  payload?: unknown;
  timestamp: number;
  correlationId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseWSMessage(data: string): IncomingMessage | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (!isRecord(parsed)) return null;
    if (typeof parsed.type !== 'string') return null;
    if (typeof parsed.timestamp !== 'number') return null;
    const message: IncomingMessage = {
      type: parsed.type,
      payload: parsed.payload,
      timestamp: parsed.timestamp,
    };
    if (typeof parsed.correlationId === 'string') {
      message.correlationId = parsed.correlationId;
    }
    return message;
  } catch {
    return null;
  }
}

type WSMessageEvent = { data: unknown };
type WSOpenEvent = unknown;
type WSCloseEvent = unknown;
type WSErrorEvent = unknown;

export function setupWebSocket(app: Hono) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get(
    '/ws',
    upgradeWebSocket(() => {
      return {
        onOpen: (_event: WSOpenEvent, ws: WSClient) => {
          const clientId = addClient(ws);
          broadcast('connect', { clientId, clients: getClientCount() });
          sendMessage(ws, 'heartbeat', { timestamp: Date.now(), clients: getClientCount() });
        },
        onMessage: (event: WSMessageEvent, ws: WSClient) => {
          const raw = toTextMessage(event.data);
          if (!raw) {
            sendMessage(ws, 'error', { message: 'Unsupported message format' });
            return;
          }

          const parsed = parseWSMessage(raw);
          if (!parsed) {
            sendMessage(ws, 'error', { message: 'Invalid JSON' });
            return;
          }

          if (parsed.type === 'heartbeat') {
            sendMessage(ws, 'heartbeat', { timestamp: Date.now(), clients: getClientCount() });
          }
        },
        onClose: (_event: WSCloseEvent, ws: WSClient) => {
          const clientId = removeClient(ws) ?? getClientId(ws);
          if (clientId) {
            broadcast('disconnect', { clientId, clients: getClientCount() });
          }
        },
        onError: (_event: WSErrorEvent, ws: WSClient) => {
          sendMessage(ws, 'error', { message: 'WebSocket error' });
        },
      };
    })
  );

  startHeartbeat();
  return { injectWebSocket };
}
