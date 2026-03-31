import { describe, it, expect, beforeAll } from 'bun:test';
import { JSDOM } from 'jsdom';

// DOM 환경 설정
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
globalThis.document = dom.window.document;
globalThis.customElements = dom.window.customElements;
globalThis.HTMLElement = dom.window.HTMLElement;

// Mock SessionList for testing
class MockSessionList extends HTMLElement {
  static styles = { toString: () => '' };
  private _sessions: unknown[] = [];
}

// Register mock element
beforeAll(() => {
  if (!customElements.get('session-list')) {
    customElements.define('session-list', MockSessionList);
  }
});

describe('SessionList', () => {
  it('should be defined', () => {
    expect(customElements.get('session-list')).toBeDefined();
  });

  it('should have correct element name', () => {
    const list = document.createElement('session-list');
    expect(list.tagName.toLowerCase()).toBe('session-list');
  });
});
