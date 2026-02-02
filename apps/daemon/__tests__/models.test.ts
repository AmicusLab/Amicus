import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, stopTestServer, getTestURL } from './test-utils';

describe('Models API', () => {
  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe('GET /api/models/:provider', () => {
    it('should return models for a provider', async () => {
      const response = await fetch(getTestURL('/api/models/zai'));
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('provider', 'zai');
      expect(result.data).toHaveProperty('models');
      expect(result.data).toHaveProperty('count');
      expect(Array.isArray(result.data.models)).toBe(true);
    });

    it('should return empty models for unknown provider', async () => {
      const response = await fetch(getTestURL('/api/models/unknown'));
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('provider', 'unknown');
      expect(result.data.models).toEqual([]);
      expect(result.data.count).toBe(0);
    });
  });

  describe('GET /api/models/:provider/:id', () => {
    it('should return specific model details', async () => {
      const response = await fetch(getTestURL('/api/models/zai/glm-4.7'));
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('model');
      expect(result.data).toHaveProperty('availability');
      expect(result.data.model).toHaveProperty('id');
      expect(result.data.model).toHaveProperty('name');
      expect(result.data.model).toHaveProperty('provider');
    });

    it('should return 404 for non-existent model', async () => {
      const response = await fetch(getTestURL('/api/models/zai/non-existent'));
      expect(response.status).toBe(404);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should return 404 when model does not belong to provider', async () => {
      const response = await fetch(getTestURL('/api/models/anthropic/glm-4.7'));
      expect(response.status).toBe(404);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toHaveProperty('code', 'NOT_FOUND');
    });
  });

  describe('POST /admin/models/:provider/refresh', () => {
    it('should reject without authentication', async () => {
      const response = await fetch(getTestURL('/admin/models/zai/refresh'), {
        method: 'POST',
      });
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated requests for unknown provider', async () => {
      const response = await fetch(getTestURL('/admin/models/unknown/refresh'), {
        method: 'POST',
        headers: {
          'Cookie': 'admin_session=test-token',
        },
      });
      expect(response.status).toBe(401);
    });
  });

  describe('POST /admin/models/:provider/:id/validate', () => {
    it('should reject without authentication', async () => {
      const response = await fetch(getTestURL('/admin/models/zai/glm-4.7/validate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: 'test-key' }),
      });
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated requests for unknown provider', async () => {
      const response = await fetch(getTestURL('/admin/models/unknown/glm-4.7/validate'), {
        method: 'POST',
        headers: {
          'Cookie': 'admin_session=test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: 'test-key' }),
      });
      expect(response.status).toBe(401);
    });

    it('should reject unauthenticated requests for non-existent model', async () => {
      const response = await fetch(getTestURL('/admin/models/zai/non-existent/validate'), {
        method: 'POST',
        headers: {
          'Cookie': 'admin_session=test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: 'test-key' }),
      });
      expect(response.status).toBe(401);
    });
  });
});
