import { describe, it, expect } from 'bun:test';
import { OpenRouterPlugin } from '../openrouter.js';

describe('OpenRouterPlugin', () => {
  const mockModule = {};
  const testEnvKey = 'OPENROUTER_API_KEY';

  it('should return provider factory', () => {
    const plugin = new OpenRouterPlugin(mockModule, testEnvKey);
    const provider = plugin.createProvider({ apiKey: 'test-key' });
    expect(provider).toBeDefined();
    expect(typeof provider).toBe('function');
  });

  it('should provide model information', () => {
    const plugin = new OpenRouterPlugin(mockModule, testEnvKey);
    const models = plugin.getModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty('id');
    expect(models[0]).toHaveProperty('name');
    expect(models[0]).toHaveProperty('description');
    expect(models[0]).toHaveProperty('maxTokens');
    expect(models[0]).toHaveProperty('inputCostPer1K');
    expect(models[0]).toHaveProperty('outputCostPer1K');
    expect(models[0]).toHaveProperty('complexityRange');
    expect(models[0]).toHaveProperty('capabilities');
  });

  it('should calculate cost correctly', () => {
    const plugin = new OpenRouterPlugin(mockModule, testEnvKey);
    const cost = plugin.calculateCost('anthropic/claude-3.5-sonnet', 1000, 500);
    expect(cost).toBeGreaterThan(0);
  });

  it('should return 0 cost for unknown model', () => {
    const plugin = new OpenRouterPlugin(mockModule, testEnvKey);
    const cost = plugin.calculateCost('unknown-model', 1000, 500);
    expect(cost).toBe(0);
  });

  it('should check availability', () => {
    const plugin = new OpenRouterPlugin(mockModule, testEnvKey);
    // No env var set, should be false
    expect(plugin.isAvailable()).toBe(false);
  });
});
