import { describe, it, expect, beforeEach } from 'bun:test';
import { MiniMaxPlugin } from '../minimax.js';

describe('MiniMaxPlugin', () => {
  beforeEach(() => {
    delete process.env.MINIMAX_API_KEY;
  });

  describe('Factory Return', () => {
    it('should return provider factory, not model instance', () => {
      const plugin = new MiniMaxPlugin({}, 'TEST_API_KEY');
      process.env.TEST_API_KEY = 'test-key';
      const provider = plugin.createProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
      expect(typeof provider).toBe('function');
      delete process.env.TEST_API_KEY;
    });

    it('should throw error when no API key provided', () => {
      const plugin = new MiniMaxPlugin({}, 'TEST_API_KEY');
      expect(() => plugin.createProvider({})).toThrow('TEST_API_KEY not set');
    });
  });

  describe('Model List', () => {
    it('should provide MiniMax model list', () => {
      const plugin = new MiniMaxPlugin({}, 'TEST_API_KEY');
      const models = plugin.getModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('name');
      expect(models[0]).toHaveProperty('complexityRange');
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate cost correctly', () => {
      const plugin = new MiniMaxPlugin({}, 'TEST_API_KEY');
      const cost = plugin.calculateCost('abab6.5s-chat', 1000, 1000);
      expect(cost).toBeGreaterThan(0);
    });
  });
});
