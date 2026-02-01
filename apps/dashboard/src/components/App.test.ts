import { describe, it, expect } from 'bun:test';
import { AmicusApp } from '../components/App.js';

describe('AmicusApp', () => {
  it('should be defined', () => {
    expect(AmicusApp).toBeDefined();
  });

  it('should have correct element name', () => {
    const app = new AmicusApp();
    expect(app.tagName.toLowerCase()).toBe('amicus-app');
  });
});
