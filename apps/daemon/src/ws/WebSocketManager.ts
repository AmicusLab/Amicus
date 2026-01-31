import type { ServerWebSocket } from 'bun';
import type { WSMessage, WSMessageType } from '@amicus/types/dashboard';

interface WSData {
  id: string;
}

type WSClient = ServerWebSocket<WSData>;
type AnyWSClient = ServerWebSocket<WSData | undefined>;

const clients = new Map<string, WSClient>();
let clientIdCounter = 0;

export function addClient(ws: AnyWSClient): string {
  const id = `client-${++clientIdCounter}`;
  (ws as WSClient).data = { id };
  clients.set(id, ws as WSClient);
  return id;
}

export function removeClient(ws: AnyWSClient): void {
  const data = ws.data as WSData | undefined;
  if (data?.id) {
    clients.delete(data.id);
  }
}

export function getClientCount(): number {
  return clients.size;
}

export function broadcast<T>(type: WSMessageType, payload: T): void {
  const message: WSMessage<T> = {
    type,
    payload,
    timestamp: Date.now(),
  };
  
  const data = JSON.stringify(message);
  for (const client of clients.values()) {
    client.send(data);
  }
}

export function sendTo<T>(clientId: string, type: WSMessageType, payload: T): boolean {
  const client = clients.get(clientId);
  if (!client) return false;
  
  const message: WSMessage<T> = {
    type,
    payload,
    timestamp: Date.now(),
  };
  
  client.send(JSON.stringify(message));
  return true;
}
