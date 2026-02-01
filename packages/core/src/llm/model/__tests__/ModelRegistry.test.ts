import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ModelRegistry } from '../ModelRegistry';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('ModelRegistry', () => {
  const testConfigDir = resolve(process.cwd(), 'config/models');
  const testProvider = 'test-provider';
  const testConfigPath = resolve(testConfigDir, `${testProvider}.json`);

  // Sample model data for testing
  const testModels = {
    provider: testProvider,
    lastUpdated: Date.now(),
    models: [
      {
        id: 'test-model-1',
        name: 'Test Model 1',
        description: 'Simple model for low complexity tasks',
        provider: testProvider,
        contextWindow: 4096,
        maxOutputTokens: 1024,
        inputCostPer1M: 0.5,
        outputCostPer1M: 1.0,
        capabilities: ['text', 'streaming'],
        complexityRange: { min: 0, max: 30 },
      },
      {
        id: 'test-model-2',
        name: 'Test Model 2',
        description: 'Medium complexity model',
        provider: testProvider,
        contextWindow: 8192,
        maxOutputTokens: 2048,
        inputCostPer1M: 2.0,
        outputCostPer1M: 4.0,
        capabilities: ['text', 'tools', 'streaming'],
        complexityRange: { min: 30, max: 70 },
      },
      {
        id: 'test-model-3',
        name: 'Test Model 3',
        description: 'High complexity model',
        provider: testProvider,
        contextWindow: 128000,
        maxOutputTokens: 4096,
        inputCostPer1M: 10.0,
        outputCostPer1M: 20.0,
        capabilities: ['text', 'tools', 'streaming', 'vision'],
        complexityRange: { min: 70, max: 100 },
      },
    ],
  };

  beforeEach(() => {
    // Ensure config directory exists
    if (!existsSync(testConfigDir)) {
      mkdirSync(testConfigDir, { recursive: true });
    }
    // Write test config
    writeFileSync(testConfigPath, JSON.stringify(testModels, null, 2));
  });

  afterEach(() => {
    // Clean up test config
    if (existsSync(testConfigPath)) {
      rmSync(testConfigPath);
    }
  });

  describe('loadModels', () => {
    it('should load models from JSON config file', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);

      const models = registry.getAllModels();
      expect(models).toHaveLength(3);
      expect(models.map(m => m.id)).toContain('test-model-1');
      expect(models.map(m => m.id)).toContain('test-model-2');
      expect(models.map(m => m.id)).toContain('test-model-3');
    });

    it('should handle non-existent provider gracefully', () => {
      const registry = new ModelRegistry();
      registry.loadModels('non-existent');

      const models = registry.getAllModels();
      expect(models).toHaveLength(0);
    });

    it('should clear existing models when reloading', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);

      // Modify test config
      const modifiedModels = {
        ...testModels,
        models: [testModels.models[0]],
      };
      writeFileSync(testConfigPath, JSON.stringify(modifiedModels, null, 2));

      // Reload
      registry.loadModels(testProvider);

      const models = registry.getAllModels();
      expect(models).toHaveLength(1);
      expect(models[0]!.id).toBe('test-model-1');
    });
  });

  describe('getModel', () => {
    it('should return model by ID', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);

      const model = registry.getModel('test-model-1');
      expect(model).toBeDefined();
      expect(model?.id).toBe('test-model-1');
      expect(model?.name).toBe('Test Model 1');
    });

    it('should return undefined for non-existent model', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);

      const model = registry.getModel('non-existent');
      expect(model).toBeUndefined();
    });
  });

  describe('getModelsByProvider', () => {
    it('should return all models for a provider', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);

      const models = registry.getModelsByProvider(testProvider);
      expect(models).toHaveLength(3);
    });

    it('should return empty array for non-existent provider', () => {
      const registry = new ModelRegistry();
      const models = registry.getModelsByProvider('non-existent');
      expect(models).toEqual([]);
    });
  });

  describe('selectOptimalModel', () => {
    beforeEach(() => {
      // Add another provider with cheaper models
      const cheapProvider = 'cheap-provider';
      const cheapModels = {
        provider: cheapProvider,
        lastUpdated: Date.now(),
        models: [
          {
            id: 'cheap-model',
            name: 'Cheap Model',
            description: 'Very cheap model',
            provider: cheapProvider,
            contextWindow: 4096,
            maxOutputTokens: 1024,
            inputCostPer1M: 0.1,
            outputCostPer1M: 0.2,
            capabilities: ['text'],
            complexityRange: { min: 0, max: 30 },
          },
        ],
      };
      writeFileSync(
        resolve(testConfigDir, `${cheapProvider}.json`),
        JSON.stringify(cheapModels, null, 2)
      );
    });

    afterEach(() => {
      const cheapConfigPath = resolve(testConfigDir, 'cheap-provider.json');
      if (existsSync(cheapConfigPath)) {
        rmSync(cheapConfigPath);
      }
    });

    it('should select cheapest model within complexity range', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);
      registry.loadModels('cheap-provider');

      const model = registry.selectOptimalModel(15);
      expect(model).toBeDefined();
      expect(model?.id).toBe('cheap-model'); // Cheapest option
    });

    it('should filter by provider when specified', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);
      registry.loadModels('cheap-provider');

      const model = registry.selectOptimalModel(15, testProvider);
      expect(model).toBeDefined();
      expect(model?.id).toBe('test-model-1'); // Only from test-provider
    });

    it('should select model with closest complexity range when no exact match', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);

      // Complexity 85 - should pick test-model-3 (70-100) over test-model-2 (30-70)
      const model = registry.selectOptimalModel(85);
      expect(model).toBeDefined();
      expect(model?.id).toBe('test-model-3');
    });

    it('should return undefined when no models loaded', () => {
      const registry = new ModelRegistry();
      const model = registry.selectOptimalModel(50);
      expect(model).toBeUndefined();
    });
  });

  describe('getModelAvailability', () => {
    it('should return availability for loaded model', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);

      const availability = registry.getModelAvailability('test-model-1');
      expect(availability).toBeDefined();
      expect(availability?.id).toBe('test-model-1');
      expect(availability?.healthy).toBe(true);
      expect(availability?.lastChecked).toBeGreaterThan(0);
    });

    it('should return undefined for non-existent model', () => {
      const registry = new ModelRegistry();
      const availability = registry.getModelAvailability('non-existent');
      expect(availability).toBeUndefined();
    });
  });

  describe('updateAvailability', () => {
    it('should update model health status', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);

      registry.updateAvailability('test-model-1', false);

      const availability = registry.getModelAvailability('test-model-1');
      expect(availability?.healthy).toBe(false);
    });

    it('should update lastChecked timestamp', async () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);

      const before = registry.getModelAvailability('test-model-1')?.lastChecked ?? 0;
      await new Promise(resolve => setTimeout(resolve, 10));
      
      registry.updateAvailability('test-model-1', true);
      
      const after = registry.getModelAvailability('test-model-1')?.lastChecked ?? 0;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('getAllModels', () => {
    it('should return all loaded models', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);

      const models = registry.getAllModels();
      expect(models).toHaveLength(3);
    });

    it('should return empty array when no models loaded', () => {
      const registry = new ModelRegistry();
      const models = registry.getAllModels();
      expect(models).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all models', () => {
      const registry = new ModelRegistry();
      registry.loadModels(testProvider);
      expect(registry.getAllModels()).toHaveLength(3);

      registry.clear();
      expect(registry.getAllModels()).toHaveLength(0);
      expect(registry.getModelsByProvider(testProvider)).toEqual([]);
    });
  });
});
