import { randomUUID } from 'node:crypto';
import type { WSMessage, WSMessageType } from '@amicus/types/dashboard';
import { recordHeartbeat } from '../services/SystemMonitor.js';

export interface WSClient {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readyState: number;
}

const WS_OPEN = 1;
const clients = new Map<string, WSClient>();
const clientIndex = new WeakMap<WSClient, string>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function createMessage<T>(type: WSMessageType, payload: T): WSMessage<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
  };
}

export function addClient(ws: WSClient): string {
  const id = randomUUID();
  clients.set(id, ws);
  clientIndex.set(ws, id);
  return id;
}

export function removeClient(ws: WSClient): string | null {
  const id = clientIndex.get(ws);
  if (id) {
    clients.delete(id);
    clientIndex.delete(ws);
  }
  return id ?? null;
}

export function getClientId(ws: WSClient): string | null {
  return clientIndex.get(ws) ?? null;
}

export function getClientCount(): number {
  return clients.size;
}

export function sendMessage<T>(ws: WSClient, type: WSMessageType, payload: T): void {
  if (ws.readyState !== WS_OPEN) return;
  ws.send(JSON.stringify(createMessage(type, payload)));
}

export function broadcast<T>(type: WSMessageType, payload: T): void {
  const data = JSON.stringify(createMessage(type, payload));
  for (const client of clients.values()) {
    if (client.readyState === WS_OPEN) {
      client.send(data);
    }
  }
}

export function sendTo<T>(clientId: string, type: WSMessageType, payload: T): boolean {
  const client = clients.get(clientId);
  if (!client || client.readyState !== WS_OPEN) return false;
  client.send(JSON.stringify(createMessage(type, payload)));
  return true;
}

export function startHeartbeat(intervalMs = 15000): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const timestamp = Date.now();
    recordHeartbeat(timestamp);
    broadcast('heartbeat', { timestamp, clients: getClientCount() });
  }, intervalMs);
}

export function stopHeartbeat(): void {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}
