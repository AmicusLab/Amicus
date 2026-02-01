import { describe, it, expect } from 'bun:test';
import { ControlCenter } from '../components/ControlCenter.js';

describe('ControlCenter', () => {
  it('should be defined', () => {
    expect(ControlCenter).toBeDefined();
  });

  it('should have correct element name', () => {
    const control = new ControlCenter();
    expect(control.tagName.toLowerCase()).toBe('control-center');
  });
});
