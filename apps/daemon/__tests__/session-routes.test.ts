/**
 * Session API endpoint tests
 * Phase 3 of TDD: Red - Write failing tests first
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { Database } from 'bun:sqlite';
import { sessionRoutes } from '../src/routes/sessions';
import { SessionService } from '../src/services/SessionService';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('Session API', () => {
  let app: Hono;
  let db: Database;
  let service: SessionService;
  const testDataDir = join(process.cwd(), '.test-api-sessions');
  const testDbPath = join(testDataDir, 'test-api.db');

  beforeEach(async () => {
    // Create test directory
    if (!existsSync(testDataDir)) {
      mkdirSync(testDataDir, { recursive: true });
    }
    
    // Create fresh database
    db = new Database(testDbPath);
    service = new SessionService(db, testDataDir);
    
    // Create Hono app with session routes
    app = new Hono();
    app.route('/api/chat/sessions', sessionRoutes(service));
  });

  afterEach(() => {
    db.close();
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('GET /api/chat/sessions', () => {
    test('returns empty array when no sessions', async () => {
      const res = await app.request('/api/chat/sessions');
      expect(res.status).toBe(200);
      
      const data = await res.json();
      expect(data).toEqual([]);
    });

    test('returns list of sessions', async () => {
      await service.create({ title: 'Session 1' });
      await service.create({ title: 'Session 2' });

      const res = await app.request('/api/chat/sessions');
      expect(res.status).toBe(200);
      
      const data = await res.json() as Array<{ title: string }>;
      expect(data).toHaveLength(2);
      expect(data[0].title).toBe('Session 2'); // Most recent first
    });

    test('supports pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ title: `Session ${i}` });
      }

      const res = await app.request('/api/chat/sessions?limit=2&offset=0');
      expect(res.status).toBe(200);
      
      const data = await res.json() as unknown[];
      expect(data).toHaveLength(2);
    });
  });

  describe('POST /api/chat/sessions', () => {
    test('creates a new session', async () => {
      const res = await app.request('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Session' }),
      });
      
      expect(res.status).toBe(201);
      
      const data = await res.json() as { id: string; title: string };
      expect(data.id).toBeDefined();
      expect(data.title).toBe('New Session');
    });

    test('creates session with default title', async () => {
      const res = await app.request('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      
      expect(res.status).toBe(201);
      
      const data = await res.json() as { title: string };
      expect(data.title).toBe('New Chat');
    });

    test('returns error response on failure', async () => {
      // Create max sessions to trigger error
      for (let i = 0; i < 1000; i++) {
        await service.create({ title: `Session ${i}` });
      }

      const res = await app.request('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Overflow' }),
      });
      
      expect(res.status).toBe(403);
      
      const data = await res.json() as { error: string; code: string };
      expect(data.error).toBeDefined();
      expect(data.code).toBe('MAX_SESSIONS_EXCEEDED');
    });
  });

  describe('GET /api/chat/sessions/:id', () => {
    test('returns session by ID', async () => {
      const created = await service.create({ title: 'Test' });
      
      const res = await app.request(`/api/chat/sessions/${created.id}`);
      expect(res.status).toBe(200);
      
      const data = await res.json() as { id: string; title: string };
      expect(data.id).toBe(created.id);
      expect(data.title).toBe('Test');
    });

    test('returns 404 for non-existent session', async () => {
      const res = await app.request('/api/chat/sessions/550e8400-e29b-41d4-a716-446655440000');
      expect(res.status).toBe(404);
      
      const data = await res.json() as { error: string; code: string };
      expect(data.code).toBe('SESSION_NOT_FOUND');
    });

    test('returns 400 for invalid UUID', async () => {
      const res = await app.request('/api/chat/sessions/invalid-uuid');
      expect(res.status).toBe(400);
      
      const data = await res.json() as { error: string; code: string };
      expect(data.code).toBe('INVALID_SESSION_ID');
    });
  });

  describe('DELETE /api/chat/sessions/:id', () => {
    test('soft deletes session', async () => {
      const created = await service.create({ title: 'To Delete' });
      
      const res = await app.request(`/api/chat/sessions/${created.id}`, {
        method: 'DELETE',
      });
      
      expect(res.status).toBe(200);
      
      // Verify session is no longer accessible
      const getRes = await app.request(`/api/chat/sessions/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    test('returns 404 for non-existent session', async () => {
      const res = await app.request('/api/chat/sessions/550e8400-e29b-41d4-a716-446655440000', {
        method: 'DELETE',
      });
      
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/chat/sessions/:id/restore', () => {
    test('restores deleted session', async () => {
      const created = await service.create({ title: 'To Restore' });
      
      // Delete first
      await app.request(`/api/chat/sessions/${created.id}`, { method: 'DELETE' });
      
      // Restore
      const res = await app.request(`/api/chat/sessions/${created.id}/restore`, {
        method: 'POST',
      });
      
      expect(res.status).toBe(200);
      
      const data = await res.json() as { id: string };
      expect(data.id).toBe(created.id);
      
      // Verify accessible again
      const getRes = await app.request(`/api/chat/sessions/${created.id}`);
      expect(getRes.status).toBe(200);
    });

    test('returns 404 if session not in trash', async () => {
      const created = await service.create({ title: 'Active' });
      
      const res = await app.request(`/api/chat/sessions/${created.id}/restore`, {
        method: 'POST',
      });
      
      expect(res.status).toBe(404);
    });
  });
});
