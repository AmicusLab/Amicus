/**
 * ChatSession type tests
 * Phase 1 of TDD: Red - Write failing tests first
 */

import { describe, test, expect } from 'bun:test';
import type { ChatSession } from '../src/session';
import { isChatSession, validateSessionId, SESSION_LIMITS } from '../src/session';

describe('ChatSession Type', () => {
  describe('validateSessionId', () => {
    test('accepts valid UUID v4', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      expect(validateSessionId(validUUID)).toBe(true);
    });

    test('rejects invalid UUID format', () => {
      expect(validateSessionId('invalid')).toBe(false);
      expect(validateSessionId('')).toBe(false);
      expect(validateSessionId('550e8400-e29b-41d4-a716')).toBe(false);
      expect(validateSessionId('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
    });

    test('rejects UUID v1 (non-v4)', () => {
      // UUID v1 has different version bits
      const uuidV1 = '550e8400-e29b-11d4-a716-446655440000';
      expect(validateSessionId(uuidV1)).toBe(false);
    });
  });

  describe('isChatSession', () => {
    test('accepts valid ChatSession object', () => {
      const validSession: ChatSession = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Session',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        messageCount: 5,
      };
      expect(isChatSession(validSession)).toBe(true);
    });

    test('rejects missing required fields', () => {
      expect(isChatSession({})).toBe(false);
      expect(isChatSession({ id: '550e8400-e29b-41d4-a716-446655440000' })).toBe(false);
      expect(isChatSession({ title: 'Test' })).toBe(false);
    });

    test('rejects invalid field types', () => {
      expect(isChatSession({
        id: 123, // should be string
        title: 'Test',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        messageCount: 5,
      })).toBe(false);

      expect(isChatSession({
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        messageCount: 'five', // should be number
      })).toBe(false);
    });

    test('rejects null and undefined', () => {
      expect(isChatSession(null)).toBe(false);
      expect(isChatSession(undefined)).toBe(false);
    });
  });

  describe('SESSION_LIMITS', () => {
    test('defines max sessions limit', () => {
      expect(SESSION_LIMITS.MAX_SESSIONS).toBe(1000);
    });

    test('defines max messages per session limit', () => {
      expect(SESSION_LIMITS.MAX_MESSAGES_PER_SESSION).toBe(10000);
    });

    test('defines max session size in bytes', () => {
      expect(SESSION_LIMITS.MAX_SESSION_SIZE_BYTES).toBe(10 * 1024 * 1024); // 10MB
    });
  });
});
