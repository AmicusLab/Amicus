/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test';
import type { Message } from '@amicus/types';
import { ConversationManager } from './ConversationManager.js';

const msg = (n: number): Message => ({ role: 'user', content: `m${n}` });

describe('ConversationManager', () => {
  it('addMessage stores message', () => {
    const cm = new ConversationManager();
    cm.addMessage('s1', { role: 'user', content: 'hello' });

    expect(cm.getHistory('s1')).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('getHistory returns messages in order', () => {
    const cm = new ConversationManager();
    cm.addMessage('s1', msg(1));
    cm.addMessage('s1', msg(2));
    cm.addMessage('s1', msg(3));

    expect(cm.getHistory('s1').map(m => m.content)).toEqual(['m1', 'm2', 'm3']);
  });

  it('truncates to max 20 messages', () => {
    const cm = new ConversationManager();

    for (let i = 0; i < 25; i++) {
      cm.addMessage('s1', msg(i));
    }

    const history = cm.getHistory('s1');
    expect(history).toHaveLength(20);
    expect(history[0]?.content).toBe('m5');
    expect(history[19]?.content).toBe('m24');
  });

  it('clear removes all messages for session', () => {
    const cm = new ConversationManager();
    cm.addMessage('s1', msg(1));
    cm.addMessage('s1', msg(2));

    cm.clear('s1');

    expect(cm.getHistory('s1')).toEqual([]);
  });
});
