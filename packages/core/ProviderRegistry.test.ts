import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { ProviderRegistry } from './src/llm/ProviderRegistry.js';
import type { LLMProviderConfig } from './src/llm/plugins/types.js';

const testConfig: LLMProviderConfig = {
  providers: [
    { id: 'anthropic', enabled: true, package: '@ai-sdk/anthropic' },
    { id: 'openai', enabled: true, package: '@ai-sdk/openai' },
  ],
  defaultModel: 'anthropic:claude-3-5-sonnet-20241022',
  dailyBudget: 10.0,
  budgetAlertThreshold: 0.8,
};

let globalRegistry: ProviderRegistry;

describe('ProviderRegistry', () => {
  beforeAll(() => {
    globalRegistry = new ProviderRegistry();
    
    process.env.ANTHROPIC_API_KEY = 'test-key-anthropic';
    process.env.OPENAI_API_KEY = 'test-key-openai';
  });

  beforeEach(async () => {
    globalRegistry = new ProviderRegistry();
    await globalRegistry.loadFromConfig(testConfig);
  });

  describe('loadFromConfig', () => {
    it('should load enabled providers from config', async () => {
      await globalRegistry.loadFromConfig(testConfig);

      const loadedProviders = globalRegistry.getLoadedProviders();
      expect(loadedProviders).toContain('anthropic');
      expect(loadedProviders).toContain('openai');
    });

    it('should skip disabled providers', async () => {
      await globalRegistry.loadFromConfig(testConfig);

      const loadedProviders = globalRegistry.getLoadedProviders();
      expect(loadedProviders).not.toContain('groq');
      expect(loadedProviders).not.toContain('zai');
      expect(loadedProviders).not.toContain('kimi');
    });
  });

  describe('getAllModels', () => {
    it('should return all available models', async () => {
      await globalRegistry.loadFromConfig(testConfig);

      const models = globalRegistry.getAllModels();
      expect(models.length).toBeGreaterThan(0);
      
      const anthropicModels = models.filter(m => m.providerId === 'anthropic');
      expect(anthropicModels.length).toBeGreaterThan(0);
      
      const openaiModels = models.filter(m => m.providerId === 'openai');
      expect(openaiModels.length).toBeGreaterThan(0);
    });

    it('should include providerId in model info', async () => {
      await globalRegistry.loadFromConfig(testConfig);

      const models = globalRegistry.getAllModels();
      models.forEach(model => {
        expect(model).toHaveProperty('providerId');
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('complexityRange');
      });
    });
  });

  describe('selectModel', () => {
    it('should select model based on complexity', () => {
      const result = globalRegistry.selectModel(50);

      expect(result).toBeDefined();
      expect(result.model).toMatch(/^(anthropic|openai):/);
      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.modelInfo).toBeDefined();
    });

    it('should respect preferred provider', () => {
      const result = globalRegistry.selectModel(50, 'anthropic');

      expect(result.provider).toBe('anthropic');
    });

    it('should throw error when no providers loaded', async () => {
      const emptyRegistry = new ProviderRegistry();
      expect(() => emptyRegistry.selectModel(50)).toThrow('No providers loaded');
    });
  });

  describe('getState', () => {
    it('should return registry state', async () => {
      await globalRegistry.loadFromConfig(testConfig);

      const state = globalRegistry.getState();

      expect(state.loadedProviders).toBeInstanceOf(Array);
      expect(state.availableProviders).toBeInstanceOf(Array);
      expect(state.allModels).toBeInstanceOf(Array);
    });

    it('should include failed providers if any', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      
      const errorRegistry = new ProviderRegistry();
      await errorRegistry.loadFromConfig({
        providers: [
          { id: 'anthropic', enabled: true, package: '@ai-sdk/anthropic' },
        ],
      });

      const state = errorRegistry.getState();
      expect(state.failedProviders.length).toBeGreaterThan(0);
    });
  });
});
