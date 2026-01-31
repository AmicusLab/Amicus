import type { WSMessage, WSMessageType } from '@amicus/types/dashboard';

type MessageHandler = (message: WSMessage) => void;

let socket: WebSocket | null = null;
const handlers = new Map<WSMessageType | '*', Set<MessageHandler>>();

export function connect(url = `ws://${window.location.host}`): WebSocket {
  if (socket?.readyState === WebSocket.OPEN) {
    return socket;
  }
  
  socket = new WebSocket(url);
  
  socket.onopen = () => {
    console.log('[WS] Connected');
    notifyHandlers({ type: 'connect', payload: null, timestamp: Date.now() });
  };
  
  socket.onclose = () => {
    console.log('[WS] Disconnected');
    notifyHandlers({ type: 'disconnect', payload: null, timestamp: Date.now() });
    setTimeout(() => connect(url), 3000);
  };
  
  socket.onmessage = (event) => {
    try {
      const message: WSMessage = JSON.parse(event.data);
      notifyHandlers(message);
    } catch (e) {
      console.error('[WS] Parse error:', e);
    }
  };
  
  socket.onerror = (error) => {
    console.error('[WS] Error:', error);
    notifyHandlers({ type: 'error', payload: { error }, timestamp: Date.now() });
  };
  
  return socket;
}

export function disconnect(): void {
  socket?.close();
  socket = null;
}

export function send(type: WSMessageType, payload: unknown): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
  }
}

export function subscribe(type: WSMessageType | '*', handler: MessageHandler): () => void {
  if (!handlers.has(type)) {
    handlers.set(type, new Set());
  }
  handlers.get(type)!.add(handler);
  
  return () => {
    handlers.get(type)?.delete(handler);
  };
}

function notifyHandlers(message: WSMessage): void {
  handlers.get(message.type)?.forEach(h => h(message));
  handlers.get('*')?.forEach(h => h(message));
}
