/**
 * SessionService tests
 * Phase 2 of TDD: Red - Write failing tests first
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { SessionService } from '../src/services/SessionService';
import type { ChatSession } from '@amicus/types';
import { SESSION_LIMITS } from '@amicus/types';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('SessionService', () => {
  let db: Database;
  let service: SessionService;
  const testDataDir = join(process.cwd(), '.test-sessions');
  const testDbPath = join(testDataDir, 'test-sessions.db');

  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDataDir)) {
      mkdirSync(testDataDir, { recursive: true });
    }
    
    // Create fresh database for each test
    db = new Database(testDbPath);
    service = new SessionService(db, testDataDir);
  });

  afterEach(() => {
    // Clean up
    db.close();
    if (existsSync(testDataDir)) {
      rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('create', () => {
    test('creates a new session with auto-generated ID', async () => {
      const session = await service.create({ title: 'New Chat' });
      
      expect(session.id).toBeDefined();
      expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(session.title).toBe('New Chat');
      expect(session.messageCount).toBe(0);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    test('creates session with empty title if not provided', async () => {
      const session = await service.create({});
      expect(session.title).toBe('New Chat');
    });

    test('throws error when max sessions limit reached', async () => {
      // Create max sessions
      for (let i = 0; i < SESSION_LIMITS.MAX_SESSIONS; i++) {
        await service.create({ title: `Session ${i}` });
      }
      
      // Next should fail
      await expect(service.create({ title: 'Overflow' })).rejects.toThrow('Maximum sessions limit reached');
    });
  });

  describe('get', () => {
    test('returns session by ID', async () => {
      const created = await service.create({ title: 'Test' });
      const session = await service.get(created.id);
      
      expect(session).not.toBeNull();
      expect(session?.id).toBe(created.id);
      expect(session?.title).toBe('Test');
    });

    test('returns null for non-existent session', async () => {
      const session = await service.get('550e8400-e29b-41d4-a716-446655440000');
      expect(session).toBeNull();
    });

    test('throws error for invalid UUID format', async () => {
      await expect(service.get('invalid-uuid')).rejects.toThrow('Invalid session ID');
    });
  });

  describe('list', () => {
    test('returns all sessions sorted by updatedAt desc', async () => {
      const s1 = await service.create({ title: 'Session 1' });
      await new Promise(r => setTimeout(r, 10)); // Small delay for timestamp difference
      const s2 = await service.create({ title: 'Session 2' });
      await new Promise(r => setTimeout(r, 10));
      const s3 = await service.create({ title: 'Session 3' });

      const sessions = await service.list();
      
      expect(sessions).toHaveLength(3);
      expect(sessions[0].id).toBe(s3.id); // Most recent first
      expect(sessions[1].id).toBe(s2.id);
      expect(sessions[2].id).toBe(s1.id);
    });

    test('returns empty array when no sessions', async () => {
      const sessions = await service.list();
      expect(sessions).toHaveLength(0);
    });

    test('supports pagination with limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ title: `Session ${i}` });
      }

      const page1 = await service.list({ limit: 2, offset: 0 });
      const page2 = await service.list({ limit: 2, offset: 2 });
      
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });
  });

  describe('update', () => {
    test('updates session title', async () => {
      const created = await service.create({ title: 'Original' });
      // Small delay to ensure different timestamp
      await new Promise(r => setTimeout(r, 5));
      const updated = await service.update(created.id, { title: 'Updated' });
      
      expect(updated.title).toBe('Updated');
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.updatedAt).getTime());
    });

    test('throws error for non-existent session', async () => {
      await expect(
        service.update('550e8400-e29b-41d4-a716-446655440000', { title: 'New' })
      ).rejects.toThrow('Session not found');
    });
  });

  describe('delete (soft)', () => {
    test('moves session to .trash directory', async () => {
      const created = await service.create({ title: 'To Delete' });
      await service.delete(created.id);
      
      // Should not be in main list
      const session = await service.get(created.id);
      expect(session).toBeNull();
      
      // Should be in trash
      const trashed = await service.getFromTrash(created.id);
      expect(trashed).not.toBeNull();
    });

    test('throws error for non-existent session', async () => {
      await expect(
        service.delete('550e8400-e29b-41d4-a716-446655440000')
      ).rejects.toThrow('Session not found');
    });
  });

  describe('restore', () => {
    test('restores session from trash', async () => {
      const created = await service.create({ title: 'To Restore' });
      await service.delete(created.id);
      
      const restored = await service.restore(created.id);
      expect(restored.id).toBe(created.id);
      
      // Should be back in main list
      const session = await service.get(created.id);
      expect(session).not.toBeNull();
    });

    test('throws error if not in trash', async () => {
      await expect(
        service.restore('550e8400-e29b-41d4-a716-446655440000')
      ).rejects.toThrow('Session not found in trash');
    });
  });

  describe('messageCount', () => {
    test('increments message count', async () => {
      const created = await service.create({ title: 'Test' });
      expect(created.messageCount).toBe(0);
      
      await service.incrementMessageCount(created.id);
      const session = await service.get(created.id);
      expect(session?.messageCount).toBe(1);
    });

    test('throws error when max messages reached', async () => {
      const created = await service.create({ title: 'Test' });
      
      // Manually set messageCount to max
      db.run('UPDATE sessions SET messageCount = ? WHERE id = ?', [
        SESSION_LIMITS.MAX_MESSAGES_PER_SESSION,
        created.id
      ]);
      
      await expect(service.incrementMessageCount(created.id)).rejects.toThrow('Maximum messages per session reached');
    });
  });

  describe('path sanitization', () => {
    test('rejects path traversal attempts', async () => {
      const session = await service.create({ title: 'Test' });
      
      // Try to access with path traversal (should be blocked at get)
      const maliciousId = '../../../etc/passwd';
      await expect(service.get(maliciousId)).rejects.toThrow('Invalid session ID');
    });
  });
});
