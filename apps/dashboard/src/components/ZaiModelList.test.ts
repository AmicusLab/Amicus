import { describe, it, expect } from 'bun:test';
import { ZaiModelList } from './ZaiModelList.js';

describe('ZaiModelList', () => {
  it('should be defined', () => {
    expect(ZaiModelList).toBeDefined();
  });

  it('should have correct element name', () => {
    const list = new ZaiModelList();
    expect(list.tagName.toLowerCase()).toBe('zai-model-list');
  });

  it('should initialize with empty models array', () => {
    const list = new ZaiModelList();
    expect(list['_models']).toEqual([]);
  });

  it('should initialize with loading state false', () => {
    const list = new ZaiModelList();
    expect(list['_loading']).toBe(false);
  });

  it('should initialize with null error', () => {
    const list = new ZaiModelList();
    expect(list['_error']).toBeNull();
  });

  it('should have static styles defined', () => {
    expect(ZaiModelList.styles).toBeDefined();
  });
});
