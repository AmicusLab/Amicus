import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, stopTestServer, getTestURL } from './test-utils';

describe('Daemon WebSocket', () => {
  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  it('should connect to WebSocket', async () => {
    const ws = new WebSocket(getTestURL('/ws', 3001).replace('http', 'ws'));
    
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        resolve();
      };
      ws.onerror = (error) => reject(error);
      
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    ws.close();
  });

  it('should receive connect and heartbeat messages', async () => {
    const ws = new WebSocket(getTestURL('/ws', 3001).replace('http', 'ws'));
    
    const messages: unknown[] = [];
    
    await new Promise<void>((resolve, reject) => {
      ws.onmessage = (event) => {
        messages.push(JSON.parse(event.data as string));
        if (messages.length >= 2) {
          resolve();
        }
      };
      ws.onerror = (error) => reject(error);
      
      setTimeout(() => reject(new Error('Message timeout')), 5000);
    });

    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0]).toHaveProperty('type', 'connect');
    expect(messages[1]).toHaveProperty('type', 'heartbeat');

    ws.close();
  });

  it('should echo heartbeat message', async () => {
    const ws = new WebSocket(getTestURL('/ws', 3001).replace('http', 'ws'));
    
    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve();
    });

    let messageCount = 0;
    const heartbeatMessage = JSON.stringify({ type: 'heartbeat', timestamp: Date.now() });
    ws.send(heartbeatMessage);

    const response = await new Promise<unknown>((resolve, reject) => {
      ws.onmessage = (event) => {
        messageCount++;
        const data = JSON.parse(event.data as string);
        if (messageCount > 1 && data.type === 'heartbeat') {
          resolve(data);
        }
      };
      
      setTimeout(() => reject(new Error('Heartbeat timeout')), 5000);
    });

    expect(response).toHaveProperty('type', 'heartbeat');
    expect(response).toHaveProperty('timestamp');

    ws.close();
  });
});
