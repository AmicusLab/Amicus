import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ZaiPlugin } from '../zai.js';

describe('ZaiPlugin', () => {
  let plugin: ZaiPlugin;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.ZAI_API_KEY;
    plugin = new ZaiPlugin({}, 'ZAI_API_KEY');
  });

  afterEach(() => {
    if (originalApiKey) {
      process.env.ZAI_API_KEY = originalApiKey;
    } else {
      delete process.env.ZAI_API_KEY;
    }
  });

  describe('Plugin metadata', () => {
    it('should have correct name', () => {
      expect(plugin.name).toBe('z.ai');
    });

    it('should have correct id', () => {
      expect(plugin.id).toBe('zai');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is set', () => {
      process.env.ZAI_API_KEY = 'test-api-key';
      expect(plugin.isAvailable()).toBe(true);
    });

    it('should return false when API key is not set', () => {
      delete process.env.ZAI_API_KEY;
      expect(plugin.isAvailable()).toBe(false);
    });
  });

  describe('getModels', () => {
    it('should return 15 models', () => {
      const models = plugin.getModels();
      expect(models).toHaveLength(15);
    });

    it('should include all text models', () => {
      const models = plugin.getModels();
      const textModelIds = [
        'glm-4.7',
        'glm-4.7-flash',
        'glm-4.7-flashx',
        'glm-4.6',
        'glm-4.5',
        'glm-4.5-x',
        'glm-4.5-air',
        'glm-4.5-airx',
        'glm-4.5-flash',
        'glm-4-32b-0414-128k',
      ];
      textModelIds.forEach((id) => {
        expect(models.find((m) => m.id === id)).toBeDefined();
      });
    });

    it('should include all vision models', () => {
      const models = plugin.getModels();
      const visionModelIds = [
        'glm-4.6v',
        'glm-4.6v-flash',
        'glm-4.6v-flashx',
        'glm-4.5v',
        'autoglm-phone-multilingual',
      ];
      visionModelIds.forEach((id) => {
        expect(models.find((m) => m.id === id)).toBeDefined();
      });
    });

    it('should have correct model properties for glm-4.7', () => {
      const models = plugin.getModels();
      const model = models.find((m) => m.id === 'glm-4.7');
      expect(model).toBeDefined();
      expect(model?.name).toBe('GLM-4.7');
      expect(model?.description).toBe('Flagship model');
      expect(model?.maxTokens).toBe(8192);
      expect(model?.inputCostPer1K).toBe(0.6);
      expect(model?.outputCostPer1K).toBe(2.2);
      expect(model?.complexityRange).toEqual({ min: 70, max: 100 });
      expect(model?.capabilities).toEqual(['text', 'tools', 'streaming']);
    });

    it('should have correct model properties for glm-4.7-flash (free model)', () => {
      const models = plugin.getModels();
      const model = models.find((m) => m.id === 'glm-4.7-flash');
      expect(model).toBeDefined();
      expect(model?.name).toBe('GLM-4.7 Flash');
      expect(model?.description).toBe('Free model');
      expect(model?.inputCostPer1K).toBe(0);
      expect(model?.outputCostPer1K).toBe(0);
    });

    it('should have correct model properties for glm-4.6v (vision)', () => {
      const models = plugin.getModels();
      const model = models.find((m) => m.id === 'glm-4.6v');
      expect(model).toBeDefined();
      expect(model?.name).toBe('GLM-4.6V');
      expect(model?.description).toBe('Vision standard');
      expect(model?.capabilities).toContain('vision');
    });

    it('should have 10 text models with text capability', () => {
      const models = plugin.getModels();
      const textModels = models.filter((m) => m.id.startsWith('glm-4') && !m.id.includes('v'));
      expect(textModels).toHaveLength(10);
      textModels.forEach((m) => {
        expect(m.capabilities).toContain('text');
      });
    });

    it('should have 5 vision models with vision capability', () => {
      const models = plugin.getModels();
      const visionModels = models.filter((m) => m.id.includes('v') || m.id.includes('autoglm'));
      expect(visionModels).toHaveLength(5);
      visionModels.forEach((m) => {
        expect(m.capabilities).toContain('vision');
      });
    });

    it('should have all models with valid complexity ranges', () => {
      const models = plugin.getModels();
      models.forEach((model) => {
        expect(model.complexityRange.min).toBeGreaterThanOrEqual(0);
        expect(model.complexityRange.max).toBeLessThanOrEqual(100);
        expect(model.complexityRange.min).toBeLessThanOrEqual(model.complexityRange.max);
      });
    });

    it('should have all models with positive costs or zero for free models', () => {
      const models = plugin.getModels();
      models.forEach((model) => {
        expect(model.inputCostPer1K).toBeGreaterThanOrEqual(0);
        expect(model.outputCostPer1K).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have all models with maxTokens', () => {
      const models = plugin.getModels();
      models.forEach((model) => {
        expect(model.maxTokens).toBeGreaterThan(0);
      });
    });

    it('should have all models with capabilities', () => {
      const models = plugin.getModels();
      models.forEach((model) => {
        expect(model.capabilities).toBeDefined();
        expect(model.capabilities.length).toBeGreaterThan(0);
      });
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly for glm-4.7', () => {
      const models = plugin.getModels();
      const model = models.find((m) => m.id === 'glm-4.7');
      expect(model).toBeDefined();
      const cost = plugin.calculateCost('glm-4.7', 1000, 1000);
      const expectedCost = (1000 / 1000) * 0.6 + (1000 / 1000) * 2.2;
      expect(cost).toBeCloseTo(expectedCost);
    });

    it('should calculate cost correctly for glm-4.7-flash (free)', () => {
      const models = plugin.getModels();
      const model = models.find((m) => m.id === 'glm-4.7-flash');
      expect(model).toBeDefined();
      const cost = plugin.calculateCost('glm-4.7-flash', 1000, 1000);
      expect(cost).toBeCloseTo(0);
    });

    it('should return 0 for unknown model', () => {
      const cost = plugin.calculateCost('unknown-model', 1000, 1000);
      expect(cost).toBe(0);
    });

    it('should calculate cost correctly for different token amounts', () => {
      const cost = plugin.calculateCost('glm-4.7', 500, 250);
      const expectedCost = (500 / 1000) * 0.6 + (250 / 1000) * 2.2;
      expect(cost).toBeCloseTo(expectedCost);
    });
  });

  describe('createProvider', () => {
    it('should create provider with API key from environment', () => {
      process.env.ZAI_API_KEY = 'test-api-key';
      expect(() => plugin.createProvider()).not.toThrow();
    });

    it('should create provider with API key from config', () => {
      process.env.ZAI_API_KEY = 'env-api-key';
      expect(() => plugin.createProvider({ apiKey: 'config-api-key' })).not.toThrow();
    });

    it('should throw error when API key is not set', () => {
      delete process.env.ZAI_API_KEY;
      expect(() => plugin.createProvider()).toThrow('ZAI_API_KEY not set');
    });

    it('should throw error when API key is empty', () => {
      process.env.ZAI_API_KEY = '';
      expect(() => plugin.createProvider()).toThrow('ZAI_API_KEY not set');
    });
  });
});
