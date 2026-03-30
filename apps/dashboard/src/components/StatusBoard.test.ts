import { describe, it, expect, beforeAll } from 'bun:test';
import { JSDOM } from 'jsdom';

// DOM 환경 설정
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
globalThis.document = dom.window.document;
globalThis.customElements = dom.window.customElements;
globalThis.HTMLElement = dom.window.HTMLElement;

// Mock StatusBoard for testing
class MockStatusBoard extends HTMLElement {
  static styles = { toString: () => '' };
  private _status = 'idle';
}

// Register mock element
beforeAll(() => {
  if (!customElements.get('status-board')) {
    customElements.define('status-board', MockStatusBoard);
  }
});

describe('StatusBoard', () => {
  it('should be defined', () => {
    expect(customElements.get('status-board')).toBeDefined();
  });

  it('should have correct element name', () => {
    const board = document.createElement('status-board');
    expect(board.tagName.toLowerCase()).toBe('status-board');
  });
});
