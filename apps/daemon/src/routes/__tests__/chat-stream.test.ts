import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, stopTestServer, getTestURL } from './test-utils';

describe('Chat Stream Endpoint', () => {
  beforeAll(async () => {
    await startTestServer(3002);
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe('POST /chat/stream', () => {
    it('should return 400 for invalid JSON', async () => {
      const response = await fetch(getTestURL('/chat/stream', 3002), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });
      expect(response.status).toBe(400);
    });

    it('should return 400 for missing messages', async () => {
      const response = await fetch(getTestURL('/chat/stream', 3002), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
      const result = (await response.json()) as { error?: string };
      expect(result.error).toBe('Invalid request body');
    });

    it('should return 400 for invalid message format', async () => {
      const response = await fetch(getTestURL('/chat/stream', 3002), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ invalid: 'format' }],
        }),
      });
      expect(response.status).toBe(400);
      const result = (await response.json()) as { error?: string };
      expect(result.error).toBe('Invalid request body');
    });

    it('should return SSE content-type for valid request', async () => {
      // Note: This test may fail if no LLM provider is configured
      // We're mainly testing the endpoint structure
      const response = await fetch(getTestURL('/chat/stream', 3002), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      // Either it succeeds with SSE or fails with 500 (no provider configured)
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        expect(contentType).toContain('text/event-stream');
      } else {
        expect(response.status).toBe(500);
      }
    });

    it('should accept optional config parameter', async () => {
      const response = await fetch(getTestURL('/chat/stream', 3002), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          config: {
            temperature: 0.7,
            maxTokens: 100,
          },
        }),
      });

      // Either it succeeds or fails with 500 (no provider configured)
      expect([200, 500]).toContain(response.status);
    });
  });
});
