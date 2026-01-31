import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, stopTestServer, getTestURL } from './test-utils';

describe('Daemon API', () => {
  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe('Health Endpoints', () => {
    it('should return ok status', async () => {
      const response = await fetch(getTestURL('/health'));
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
    });

    it('should return detailed health info', async () => {
      const response = await fetch(getTestURL('/health/detailed'));
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('daemon');
      expect(data).toHaveProperty('resources');
      expect(data.daemon).toHaveProperty('running', true);
      expect(data.daemon).toHaveProperty('pid');
    });
  });

  describe('Status Endpoint', () => {
    it('should return system health', async () => {
      const response = await fetch(getTestURL('/api/status'));
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status');
      expect(result.data).toHaveProperty('daemon');
      expect(result.data).toHaveProperty('resources');
      expect(result.meta).toHaveProperty('requestId');
      expect(result.meta).toHaveProperty('timestamp');
    });
  });

  describe('Tasks Endpoint', () => {
    it('should return tasks list', async () => {
      const response = await fetch(getTestURL('/api/tasks'));
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('scheduled');
      expect(result.data).toHaveProperty('running');
      expect(result.data).toHaveProperty('count');
      expect(Array.isArray(result.data.scheduled)).toBe(true);
      expect(Array.isArray(result.data.running)).toBe(true);
    });
  });

  describe('Tokenomics Endpoint', () => {
    it('should return token usage stats', async () => {
      const response = await fetch(getTestURL('/api/tokenomics'));
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('byModel');
      expect(result.data).toHaveProperty('totalTokens');
      expect(result.data).toHaveProperty('totalCost');
      expect(Array.isArray(result.data.byModel)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent task', async () => {
      const response = await fetch(getTestURL('/api/tasks/non-existent/pause'), {
        method: 'POST',
      });
      expect(response.status).toBe(404);
      
      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
    });
  });
});
