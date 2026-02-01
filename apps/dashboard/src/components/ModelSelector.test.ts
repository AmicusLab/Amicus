import { describe, it, expect } from 'bun:test';
import { ModelSelector } from '../components/ModelSelector.js';

describe('ModelSelector', () => {
  it('should be defined', () => {
    expect(ModelSelector).toBeDefined();
  });

  it('should have correct element name', () => {
    const selector = new ModelSelector();
    expect(selector.tagName.toLowerCase()).toBe('model-selector');
  });
});
