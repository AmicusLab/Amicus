/**
 * SessionList component tests
 * Phase 4 of TDD: Red - Write failing tests first
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { SessionList } from './SessionList.js';
import type { ChatSession } from '@amicus/types';

describe('SessionList', () => {
  describe('component definition', () => {
    it('should be defined', () => {
      expect(SessionList).toBeDefined();
    });

    it('should have correct element name', () => {
      const list = new SessionList();
      expect(list.tagName.toLowerCase()).toBe('session-list');
    });
  });

  describe('initial state', () => {
    it('should initialize with empty sessions', () => {
      const list = new SessionList();
      expect(list['sessions']).toEqual([]);
    });

    it('should initialize with no selected session', () => {
      const list = new SessionList();
      expect(list['selectedId']).toBeNull();
    });

    it('should initialize with loading false', () => {
      const list = new SessionList();
      expect(list['loading']).toBe(false);
    });
  });

  describe('session management', () => {
    it('should store sessions array', () => {
      const list = new SessionList();
      const sessions: ChatSession[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Test Session',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          messageCount: 5,
        },
      ];
      list['sessions'] = sessions;
      expect(list['sessions']).toHaveLength(1);
      expect(list['sessions'][0]?.title).toBe('Test Session');
    });

    it('should track selected session ID', () => {
      const list = new SessionList();
      list['selectedId'] = '550e8400-e29b-41d4-a716-446655440000';
      expect(list['selectedId']).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should handle empty sessions list', () => {
      const list = new SessionList();
      list['sessions'] = [];
      expect(list['sessions']).toHaveLength(0);
    });

    it('should handle multiple sessions', () => {
      const list = new SessionList();
      const sessions: ChatSession[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Session 1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          messageCount: 5,
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          title: 'Session 2',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          messageCount: 3,
        },
      ];
      list['sessions'] = sessions;
      expect(list['sessions']).toHaveLength(2);
    });
  });

  describe('render helpers', () => {
    it('should format message count', () => {
      const list = new SessionList();
      const result = list['formatMessageCount'](5);
      expect(result).toBe('5 messages');
    });

    it('should format single message correctly', () => {
      const list = new SessionList();
      const result = list['formatMessageCount'](1);
      expect(result).toBe('1 message');
    });

    it('should format zero messages', () => {
      const list = new SessionList();
      const result = list['formatMessageCount'](0);
      expect(result).toBe('0 messages');
    });

    it('should format date for display', () => {
      const list = new SessionList();
      const result = list['formatDate']('2024-01-15T10:30:00.000Z');
      expect(result).toBeTruthy();
    });

    it('should check if session is selected', () => {
      const list = new SessionList();
      list['selectedId'] = '550e8400-e29b-41d4-a716-446655440000';
      
      expect(list['isSelected']('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(list['isSelected']('660e8400-e29b-41d4-a716-446655440001')).toBe(false);
    });
  });

  describe('event dispatching', () => {
    it('should have select method that dispatches event', () => {
      const list = new SessionList();
      const session: ChatSession = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        messageCount: 5,
      };
      
      // Mock dispatchEvent
      let dispatchedEvent: CustomEvent | null = null;
      list.dispatchEvent = ((event: CustomEvent) => {
        dispatchedEvent = event;
        return true;
      }) as typeof list.dispatchEvent;
      
      list['handleSelect'](session);
      
      expect(dispatchedEvent).not.toBeNull();
      expect(dispatchedEvent?.type).toBe('session-selected');
      expect(dispatchedEvent?.detail.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should have delete method that dispatches event', () => {
      const list = new SessionList();
      const session: ChatSession = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        messageCount: 5,
      };
      
      let dispatchedEvent: CustomEvent | null = null;
      list.dispatchEvent = ((event: CustomEvent) => {
        dispatchedEvent = event;
        return true;
      }) as typeof list.dispatchEvent;
      
      list['handleDelete'](session);
      
      expect(dispatchedEvent).not.toBeNull();
      expect(dispatchedEvent?.type).toBe('session-delete');
      expect(dispatchedEvent?.detail.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should have create method that dispatches event', () => {
      const list = new SessionList();
      
      let dispatchedEvent: CustomEvent | null = null;
      list.dispatchEvent = ((event: CustomEvent) => {
        dispatchedEvent = event;
        return true;
      }) as typeof list.dispatchEvent;
      
      list['handleCreate']();
      
      expect(dispatchedEvent).not.toBeNull();
      expect(dispatchedEvent?.type).toBe('session-create');
    });
  });

  describe('render output', () => {
    it('should render empty state when no sessions', () => {
      const list = new SessionList();
      list['sessions'] = [];
      list.requestUpdate();
      const result = list.render();
      expect(result).toBeDefined();
    });

    it('should render session list when sessions exist', () => {
      const list = new SessionList();
      list['sessions'] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Test Session',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          messageCount: 5,
        },
      ];
      list.requestUpdate();
      const result = list.render();
      expect(result).toBeDefined();
    });
  });
});
