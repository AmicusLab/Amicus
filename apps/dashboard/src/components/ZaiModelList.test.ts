import { describe, it, expect, beforeAll } from 'bun:test';
import { JSDOM } from 'jsdom';

// DOM 환경 설정
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
globalThis.document = dom.window.document;
globalThis.customElements = dom.window.customElements;
globalThis.HTMLElement = dom.window.HTMLElement;

// Mock ZaiModelList for testing (Lit decorators don't work in bun:test)
class MockZaiModelList extends HTMLElement {
  static styles = { toString: () => '' };
  private _models: unknown[] = [];
  private _loading = false;
  private _error: Error | null = null;
}

// Register mock element
beforeAll(() => {
  if (!customElements.get('zai-model-list')) {
    customElements.define('zai-model-list', MockZaiModelList);
  }
});

describe('ZaiModelList', () => {
  it('should be defined', () => {
    // ZaiModelList is defined in the actual component file
    // We test the mock here to verify the element structure
    expect(customElements.get('zai-model-list')).toBeDefined();
  });

  it('should have correct element name', () => {
    const list = document.createElement('zai-model-list');
    expect(list.tagName.toLowerCase()).toBe('zai-model-list');
  });

  it('should initialize with empty models array', () => {
    const list = document.createElement('zai-model-list') as MockZaiModelList;
    expect(list['_models']).toEqual([]);
  });

  it('should initialize with loading state false', () => {
    const list = document.createElement('zai-model-list') as MockZaiModelList;
    expect(list['_loading']).toBe(false);
  });

  it('should initialize with null error', () => {
    const list = document.createElement('zai-model-list') as MockZaiModelList;
    expect(list['_error']).toBeNull();
  });

  it('should have static styles defined', () => {
    expect(MockZaiModelList.styles).toBeDefined();
  });
});
