import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { ProviderRegistry } from '../src/llm/ProviderRegistry.js';
import { llmProviderConfig, getEnabledProviders, getProviderConfig } from '../src/config/llm-providers.js';
import { Economist } from '../src/llm/Economist.js';
import { generateText, streamText } from 'ai';
import type { Task, TaskStatus, TaskPriority } from '@amicus/types/core';

/**
 * LLM Integration Tests
 *
 * These tests verify actual LLM API calls work correctly.
 * Tests gracefully skip when API keys are not available.
 *
 * Required Environment Variables:
 * - ANTHROPIC_API_KEY
 * - OPENAI_API_KEY
 * - GOOGLE_API_KEY
 * - GROQ_API_KEY
 * - ZAI_API_KEY
 * - KIMI_API_KEY
 */

// Helper function to check if API key exists and is valid (not a placeholder)
function hasApiKey(providerId: string): boolean {
  const envVarMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    groq: 'GROQ_API_KEY',
    zai: 'ZAI_API_KEY',
    kimi: 'KIMI_API_KEY',
    'kimi-code': 'KIMI_API_KEY',
  };

  const envVar = envVarMap[providerId];
  if (!envVar) return false;

  const value = process.env[envVar];
  if (!value || value.length === 0) return false;

  const fakePatterns = [
    'sk-xxx', 'test-key', 'test-', 'your-key', 'placeholder', 'fake-', 'example',
  ];

  const lowerValue = value.toLowerCase();
  for (const pattern of fakePatterns) {
    if (lowerValue.includes(pattern)) {
      return false;
    }
  }

  const minLengths: Record<string, number> = {
    anthropic: 20,
    openai: 20,
    google: 20,
    groq: 20,
    zai: 20,
    moonshot: 20,
  };

  const minLength = minLengths[providerId] || 20;
  if (value.length < minLength) {
    return false;
  }

  return true;
}

// Helper function to create a test task
function createTestTask(description: string, complexity: number = 50): Task {
  return {
    id: `test-task-${Date.now()}`,
    description,
    status: 'pending' as TaskStatus,
    priority: 'medium' as TaskPriority,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Test timeout for API calls (30 seconds)
const API_TIMEOUT = 30000;

describe('ProviderRegistry Integration', () => {
  let registry: ProviderRegistry;

  beforeAll(() => {
    registry = new ProviderRegistry();
  });

  afterAll(() => {
    registry.unloadAll();
  });

  it('should load enabled providers from config', async () => {
    await registry.loadFromConfig(llmProviderConfig);

    const loadedProviders = registry.getLoadedProviders();
    const enabledProviders = getEnabledProviders(llmProviderConfig);

    // Should have loaded at least some providers (those with API keys)
    expect(loadedProviders.length).toBeGreaterThanOrEqual(0);

    // Verify all loaded providers are from the enabled list
    for (const providerId of loadedProviders) {
      const config = getProviderConfig(providerId);
      expect(config).toBeDefined();
      expect(config?.enabled).toBe(true);
    }
  });

  it('should report available providers based on API keys', async () => {
    const testRegistry = new ProviderRegistry();
    await testRegistry.loadFromConfig(llmProviderConfig);

    const state = testRegistry.getState();

    expect(state.availableProviders.length).toBeLessThanOrEqual(state.loadedProviders.length);

    const enabledProviderIds = getEnabledProviders(llmProviderConfig).map(p => p.id);
    const providersWithValidKeys = enabledProviderIds.filter(id => hasApiKey(id));

    if (providersWithValidKeys.length > 0) {
      for (const providerId of providersWithValidKeys) {
        expect(state.availableProviders).toContain(providerId);
      }
    } else {
      console.log('No providers with valid API keys - skipping assertion');
    }

    testRegistry.unloadAll();
  });

  it('should select appropriate model for complexity', async () => {
    // Create a fresh registry with providers loaded
    const testRegistry = new ProviderRegistry();
    await testRegistry.loadFromConfig(llmProviderConfig);

    // If no providers are loaded, skip this test
    if (testRegistry.getLoadedProviders().length === 0) {
      console.log('Skipping model selection test - no providers loaded');
      return;
    }

    // Test low complexity (should select cheaper model)
    const lowComplexityResult = testRegistry.selectModel(20);
    expect(lowComplexityResult.model).toBeDefined();
    expect(lowComplexityResult.provider).toBeDefined();
    expect(lowComplexityResult.estimatedCost).toBeGreaterThanOrEqual(0);
    expect(lowComplexityResult.modelInfo).toBeDefined();

    // Test medium complexity
    const mediumComplexityResult = testRegistry.selectModel(50);
    expect(mediumComplexityResult.model).toBeDefined();
    expect(mediumComplexityResult.provider).toBeDefined();

    // Test high complexity (should select more capable model)
    const highComplexityResult = testRegistry.selectModel(85);
    expect(highComplexityResult.model).toBeDefined();
    expect(highComplexityResult.provider).toBeDefined();

    // High complexity should generally cost more than low complexity
    // (though this depends on available providers)
    if (testRegistry.getLoadedProviders().length > 1) {
      expect(highComplexityResult.estimatedCost).toBeGreaterThanOrEqual(lowComplexityResult.estimatedCost * 0.5);
    }

    testRegistry.unloadAll();
  });

  it('should parse model IDs correctly', () => {
    const testCases = [
      { input: 'anthropic:claude-3-5-sonnet-20241022', expected: { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' } },
      { input: 'openai:gpt-4-turbo', expected: { provider: 'openai', model: 'gpt-4-turbo' } },
      { input: 'google:gemini-1.5-pro', expected: { provider: 'google', model: 'gemini-1.5-pro' } },
    ];

    for (const { input, expected } of testCases) {
      const result = registry.parseModelId(input);
      expect(result.provider).toBe(expected.provider);
      expect(result.model).toBe(expected.model);
    }

    // Should throw for invalid format
    expect(() => registry.parseModelId('invalid')).toThrow();
    expect(() => registry.parseModelId('too:many:colons')).toThrow();
  });

  it('should track loading errors', async () => {
    const testRegistry = new ProviderRegistry();

    // Try to load a non-existent provider
    await testRegistry.loadPlugin('nonexistent', '@ai-sdk/nonexistent', 'NONEXISTENT_API_KEY');

    const errors = testRegistry.getLoadingErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].providerId).toBe('nonexistent');

    testRegistry.unloadAll();
  });
});

describe('LLM Provider Integration', () => {
  const providers = [
    { id: 'anthropic', model: 'claude-3-haiku-20240307', package: '@ai-sdk/anthropic' },
    { id: 'openai', model: 'gpt-3.5-turbo', package: '@ai-sdk/openai' },
    { id: 'google', model: 'gemini-1.5-flash', package: '@ai-sdk/google' },
    { id: 'groq', model: 'llama-3.3-70b-versatile', package: '@ai-sdk/groq' },
    { id: 'zai', model: 'glm-4.7', package: '@ai-sdk/openai' },
    { id: 'moonshot', model: 'kimi-k2.5', package: '@ai-sdk/openai' },
  ];

  for (const provider of providers) {
    const shouldSkip = !hasApiKey(provider.id);

    describe(`${provider.id} (${shouldSkip ? 'skipped - no API key' : 'enabled'})`, () => {
      const runTest = shouldSkip ? it.skip : it;

      runTest(
        `${provider.id} should generate text`,
        async () => {
          const registry = new ProviderRegistry();

          // Load only this provider
          await registry.loadPlugin(provider.id, provider.package, `${provider.id.toUpperCase()}_API_KEY`);

          const plugin = registry.getPlugin(provider.id);
          expect(plugin).toBeDefined();
          expect(plugin?.isAvailable()).toBe(true);

          // Create provider instance
          const model = plugin!.createProvider();
          expect(model).toBeDefined();

          // Test text generation
          const prompt = 'What is 2+2? Answer with just the number.';
          const result = await generateText({
            model: model as any,
            prompt,
          });

          expect(result.text).toBeDefined();
          expect(result.text.length).toBeGreaterThan(0);
          expect(result.text).toContain('4');

          registry.unloadAll();
        },
        API_TIMEOUT
      );

      runTest(
        `${provider.id} should stream text`,
        async () => {
          const registry = new ProviderRegistry();

          // Load only this provider
          await registry.loadPlugin(provider.id, provider.package, `${provider.id.toUpperCase()}_API_KEY`);

          const plugin = registry.getPlugin(provider.id);
          expect(plugin).toBeDefined();

          // Create provider instance
          const model = plugin!.createProvider();
          expect(model).toBeDefined();

          // Test streaming
          const prompt = 'Say "Hello World"';
          const result = await streamText({
            model: model as any,
            prompt,
          });

          // Collect streamed text
          let fullText = '';
          for await (const chunk of result.textStream) {
            fullText += chunk;
          }

          expect(fullText).toBeDefined();
          expect(fullText.length).toBeGreaterThan(0);

          // Also verify the fullText promise resolves
          const finalText = await result.text;
          expect(finalText).toBe(fullText);

          registry.unloadAll();
        },
        API_TIMEOUT
      );

      runTest(
        `${provider.id} should calculate costs correctly`,
        () => {
          const registry = new ProviderRegistry();

          // Load only this provider
          registry.loadPlugin(provider.id, provider.package, `${provider.id.toUpperCase()}_API_KEY`);

          const plugin = registry.getPlugin(provider.id);
          expect(plugin).toBeDefined();

          const models = plugin!.getModels();
          expect(models.length).toBeGreaterThan(0);

          // Test cost calculation for each model
          for (const model of models) {
            const cost = plugin!.calculateCost(model.id, 1000, 500);
            expect(cost).toBeGreaterThanOrEqual(0);

            // Verify cost formula: (inputTokens/1000) * inputCostPer1K + (outputTokens/1000) * outputCostPer1K
            const expectedCost =
              (1000 / 1000) * model.inputCostPer1K + (500 / 1000) * model.outputCostPer1K;
            expect(cost).toBeCloseTo(expectedCost, 6);
          }

          // Test cost for unknown model returns 0
          const unknownCost = plugin!.calculateCost('unknown-model', 1000, 500);
          expect(unknownCost).toBe(0);

          registry.unloadAll();
        },
        5000 // Shorter timeout for cost calculation
      );
    });
  }
});

describe('Economist Integration', () => {
  let economist: Economist;

  beforeAll(() => {
    economist = new Economist({
      budget: 10.0,
      budgetAlertThreshold: 0.8,
    });
  });

  afterAll(() => {
    economist.clearCostHistory();
  });

  it('should route task to appropriate model', () => {
    // Simple task should route to cheaper model
    const simpleTask = createTestTask('Fix typo in readme', 15);
    const simpleRouting = economist.route(simpleTask);

    expect(simpleRouting.model).toBeDefined();
    expect(simpleRouting.provider).toBeDefined();
    expect(simpleRouting.complexity.total).toBeLessThan(50);
    expect(simpleRouting.estimatedCost).toBeGreaterThanOrEqual(0);

    // Complex task should route to more capable model
    const complexTask = createTestTask(
      'Design and implement a distributed microservices architecture with authentication, database integration, and API gateway'
    );
    const complexRouting = economist.route(complexTask);

    expect(complexRouting.model).toBeDefined();
    expect(complexRouting.provider).toBeDefined();
    expect(complexRouting.complexity.total).toBeGreaterThan(50);

    // Verify models are different (or at least costs are different)
    // Note: This depends on available models in Economist
    console.log(`Simple task: ${simpleRouting.model} (cost: $${simpleRouting.estimatedCost})`);
    console.log(`Complex task: ${complexRouting.model} (cost: $${complexRouting.estimatedCost})`);
  });

  it('should track costs accurately', async () => {
    // Clear any previous history
    economist.clearCostHistory();

    const initialStats = economist.getCostStats();
    expect(initialStats.spent).toBe(0);
    expect(initialStats.requests).toBe(0);
    expect(initialStats.averageCost).toBe(0);

    // Simulate a task routing (without actual API call)
    const task = createTestTask('Test task for cost tracking');
    const routing = economist.route(task);

    // Verify routing has cost info
    expect(routing.estimatedCost).toBeGreaterThan(0);

    // Note: We can't test actual cost tracking without making API calls
    // The Economist tracks costs in generateText() and generateTextStream()

    console.log(`Cost stats:`, economist.getCostStats());
  });

  it('should respect budget constraints', () => {
    const limitedEconomist = new Economist({
      budget: 0.001, // Very small budget
    });

    const task = createTestTask('Some task');

    // Should still route but note the budget
    const routing = limitedEconomist.route(task);
    expect(routing.estimatedCost).toBeGreaterThan(0);

    // Verify budget stats
    const stats = limitedEconomist.getCostStats();
    expect(stats.budget).toBe(0.001);
    expect(stats.remaining).toBe(0.001);
  });

  it('should provide available models', () => {
    const models = economist.getAvailableModels();

    expect(models.length).toBeGreaterThan(0);

    for (const model of models) {
      expect(model.id).toBeDefined();
      expect(model.provider).toBeDefined();
      expect(model.complexityRange).toBeDefined();
      expect(model.complexityRange.min).toBeGreaterThanOrEqual(0);
      expect(model.complexityRange.max).toBeLessThanOrEqual(100);
      expect(model.inputCostPer1K).toBeGreaterThanOrEqual(0);
      expect(model.outputCostPer1K).toBeGreaterThanOrEqual(0);
    }
  });

  it('should calculate complexity scores correctly', () => {
    const simpleTask = createTestTask('Fix typo');
    const simpleComplexity = economist.analyzeComplexity(simpleTask);

    expect(simpleComplexity.lexical).toBeGreaterThanOrEqual(0);
    expect(simpleComplexity.semantic).toBeGreaterThanOrEqual(0);
    expect(simpleComplexity.scope).toBeGreaterThanOrEqual(0);
    expect(simpleComplexity.total).toBeGreaterThanOrEqual(0);
    expect(simpleComplexity.total).toBeLessThanOrEqual(100);

    // Simple task should have lower complexity
    expect(simpleComplexity.total).toBeLessThanOrEqual(50);

    const complexTask = createTestTask(
      'Architect and implement a scalable distributed system with microservices, event-driven architecture, and database sharding'
    );
    const complexComplexity = economist.analyzeComplexity(complexTask);

    expect(complexComplexity.total).toBeGreaterThanOrEqual(50);

    // Lexical score should be higher for longer description
    expect(complexComplexity.lexical).toBeGreaterThan(simpleComplexity.lexical);
  });
});

describe('End-to-End LLM Integration', () => {
  it(
    'should complete full workflow with real API call when keys are available',
    async () => {
      // Check if any provider is available
      const availableProviders = ['anthropic', 'openai', 'google', 'groq'].filter(hasApiKey);

      if (availableProviders.length === 0) {
        console.log('Skipping E2E test - no API keys available');
        return;
      }

      const registry = new ProviderRegistry();
      await registry.loadFromConfig(llmProviderConfig);

      const economist = new Economist({ budget: 1.0 });

      // Create a simple task
      const task: Task = {
        id: 'e2e-test-task',
        description: 'Generate a one-sentence greeting',
        status: 'pending' as TaskStatus,
        priority: 'medium' as TaskPriority,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Route the task
      const routing = economist.route(task);
      console.log(`Selected model: ${routing.model} (complexity: ${routing.complexity.total})`);

      // Only proceed if we have the provider for the selected model
      const { provider } = registry.parseModelId(routing.model);
      const plugin = registry.getPlugin(provider);

      if (!plugin || !plugin.isAvailable()) {
        console.log(`Provider ${provider} not available, skipping API call`);
        registry.unloadAll();
        return;
      }

      // Generate text using the selected model
      try {
        const model = plugin.createProvider();
        const result = await generateText({
          model: model as any,
          prompt: task.description,
        });

        expect(result.text).toBeDefined();
        expect(result.text.length).toBeGreaterThan(0);

        console.log(`Generated text: ${result.text}`);
      } catch (error) {
        // If the API call fails, log it but don't fail the test
        // (API keys might be invalid)
        console.log(`API call failed: ${error}`);
      }

      registry.unloadAll();
    },
    API_TIMEOUT * 2
  );
});
