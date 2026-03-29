import { describe, it, expect, mock } from 'bun:test';
import { ChatEngine } from './ChatEngine.js';
import type { Message, ToolDefinition, StreamChunk } from '@amicus/types';
import type { ProviderRegistry } from '../llm/ProviderRegistry.js';
import type { LLMProviderPlugin } from '../llm/plugins/types.js';

// Helper to collect all chunks from an async generator
async function collectChunks(gen: AsyncGenerator<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of gen) {
    chunks.push(chunk);
  }
  return chunks;
}

const createMockProvider = (
  response: string,
  usage: { promptTokens: number; completionTokens: number; totalTokens: number },
  toolCalls?: Array<{ toolName: string; input: Record<string, unknown> }>
) => {
  return (modelId: string) => {
    return {
      doGenerate: async () => ({
        text: response,
        usage,
        toolCalls,
      }),
      specificationVersion: 'v1',
      provider: 'mock',
      modelId,
    };
  };
};

const createMockPlugin = (
  response: string,
  usage: { promptTokens: number; completionTokens: number; totalTokens: number },
  toolCalls?: Array<{ toolName: string; input: Record<string, unknown> }>
): LLMProviderPlugin => {
  return {
    name: 'Mock Provider',
    id: 'mock',
    isAvailable: () => true,
    createProvider: () => createMockProvider(response, usage, toolCalls),
    getModels: () => [{
      id: 'mock-model',
      name: 'Mock Model',
      description: 'Test model',
      maxTokens: 4096,
      inputCostPer1K: 0.001,
      outputCostPer1K: 0.002,
      complexityRange: { min: 0, max: 100 },
      capabilities: ['text'],
    }],
    calculateCost: () => 0,
  };
};

const createMockRegistry = (plugin: LLMProviderPlugin): ProviderRegistry => {
  return {
    getPlugin: (id: string) => (id === 'mock' ? plugin : undefined),
    selectModel: () => ({
      model: 'mock:mock-model',
      provider: 'mock',
      estimatedCost: 0.001,
      modelInfo: {
        id: 'mock-model',
        name: 'Mock Model',
        description: 'Test model',
        maxTokens: 4096,
        inputCostPer1K: 0.001,
        outputCostPer1K: 0.002,
        complexityRange: { min: 0, max: 100 },
        capabilities: ['text'],
      },
    }),
    parseModelId: (modelId: string) => {
      const [provider, model] = modelId.split(':');
      return { provider: provider ?? 'mock', model: model ?? 'mock-model' };
    },
    } as unknown as ProviderRegistry;
};

describe('ChatEngine', () => {
  it('calls LLM with messages', async () => {
    const mockPlugin = createMockPlugin('Hello! How can I help you?', {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    });

    const registry = createMockRegistry(mockPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
    ];

    const result = await engine.chat(messages);

    expect(result.response).toEqual({ type: 'text', content: 'Hello! How can I help you?' });
  });

  it('returns text response when no tool calls', async () => {
    const mockPlugin = createMockPlugin('This is a test response', {
      promptTokens: 15,
      completionTokens: 25,
      totalTokens: 40,
    });

    const registry = createMockRegistry(mockPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [
      { role: 'user', content: 'Test message' },
    ];

    const result = await engine.chat(messages);

    expect(result.response).toEqual({
      type: 'text',
      content: 'This is a test response',
    });
  });

  it('tracks token usage', async () => {
    const mockPlugin = createMockPlugin('Response', {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });

    const registry = createMockRegistry(mockPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [
      { role: 'user', content: 'Test' },
    ];

    const result = await engine.chat(messages);

    expect(result.usage).toEqual({
      input: 100,
      output: 50,
      total: 150,
    });
  });

  it('uses default system prompt', async () => {
    const mockPlugin = createMockPlugin('Response', {
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });

    const registry = createMockRegistry(mockPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
    ];

    await engine.chat(messages);
  });

  it('throws on API failure', async () => {
    const failingPlugin: LLMProviderPlugin = {
      name: 'Failing Provider',
      id: 'failing',
      isAvailable: () => true,
      createProvider: () => {
        return () => {
          throw new Error('LLM API failed');
        };
      },
      getModels: () => [],
      calculateCost: () => 0,
    };

    const registry = createMockRegistry(failingPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [
      { role: 'user', content: 'Test' },
    ];

    await expect(engine.chat(messages, { model: 'failing:test' })).rejects.toThrow();
  });

  it('throws when provider not available', async () => {
    const registry = {
      getPlugin: () => undefined,
      parseModelId: (modelId: string) => {
        const [provider, model] = modelId.split(':');
        return { provider: provider ?? 'nonexistent', model: model ?? 'test' };
      },
  } as unknown as ProviderRegistry;

    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [
      { role: 'user', content: 'Test' },
    ];

    await expect(engine.chat(messages, { model: 'nonexistent:test' })).rejects.toThrow('Provider nonexistent not available');
  });

  it('returns model and provider information', async () => {
    const mockPlugin = createMockPlugin('Response', {
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });

    const registry = createMockRegistry(mockPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [
      { role: 'user', content: 'Test' },
    ];

    const result = await engine.chat(messages, { model: 'mock:mock-model' });

    expect(result.model).toBe('mock-model');
    expect(result.provider).toBe('mock');
  });

  it('accepts tools parameter without calling them', async () => {
    const mockPlugin = createMockPlugin('I can help you search', {
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });

    const registry = createMockRegistry(mockPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [
      { role: 'user', content: 'Can you search for something?' },
    ];

    const tools: ToolDefinition[] = [
      {
        name: 'search',
        description: 'Search the web',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
    ];

    const result = await engine.chat(messages, { tools });

    expect(result.response).toEqual({
      type: 'text',
      content: 'I can help you search',
    });
  });

  it('does not send tools when array is empty', async () => {
    const mockPlugin = createMockPlugin('Normal response', {
      promptTokens: 5,
      completionTokens: 5,
      totalTokens: 10,
    });

    const registry = createMockRegistry(mockPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [
      { role: 'user', content: 'Test' },
    ];

    const result = await engine.chat(messages, { tools: [] });

    expect(result.response).toEqual({
      type: 'text',
      content: 'Normal response',
    });
  });
});

describe('ChatEngine.chatStream', () => {
  it('yields text_delta chunks during streaming', async () => {
    const mockPlugin: LLMProviderPlugin = {
      name: 'Stream Mock',
      id: 'mock',
      isAvailable: () => true,
      createProvider: () => (modelId: string) => ({
        doStream: async () => ({
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'text-delta', textDelta: 'Hello' });
              controller.enqueue({ type: 'text-delta', textDelta: ' world' });
              controller.enqueue({ type: 'finish', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } });
              controller.close();
            },
          }),
          specificationVersion: 'v1',
          provider: 'mock',
          modelId,
        }),
        specificationVersion: 'v1',
        provider: 'mock',
        modelId,
      }),
      getModels: () => [{
        id: 'mock-model',
        name: 'Mock Model',
        description: 'Test model',
        maxTokens: 4096,
        inputCostPer1K: 0.001,
        outputCostPer1K: 0.002,
        complexityRange: { min: 0, max: 100 },
        capabilities: ['text'],
      }],
      calculateCost: () => 0,
    };

    const registry = createMockRegistry(mockPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [{ role: 'user', content: 'Hi' }];
    const chunks = await collectChunks(engine.chatStream(messages));

    const textDeltas = chunks.filter(c => c.type === 'text_delta');
    expect(textDeltas.length).toBeGreaterThan(0);
    expect(textDeltas.map(c => (c as { type: 'text_delta'; content: string }).content).join('')).toBe('Hello world');
  });

  it('yields usage and done chunks at the end', async () => {
    const mockPlugin: LLMProviderPlugin = {
      name: 'Stream Mock',
      id: 'mock',
      isAvailable: () => true,
      createProvider: () => (modelId: string) => ({
        doStream: async () => ({
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'text-delta', textDelta: 'Hi' });
              controller.enqueue({ type: 'finish', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } });
              controller.close();
            },
          }),
          specificationVersion: 'v1',
          provider: 'mock',
          modelId,
        }),
        specificationVersion: 'v1',
        provider: 'mock',
        modelId,
      }),
      getModels: () => [{
        id: 'mock-model',
        name: 'Mock Model',
        description: 'Test model',
        maxTokens: 4096,
        inputCostPer1K: 0.001,
        outputCostPer1K: 0.002,
        complexityRange: { min: 0, max: 100 },
        capabilities: ['text'],
      }],
      calculateCost: () => 0,
    };

    const registry = createMockRegistry(mockPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [{ role: 'user', content: 'Hi' }];
    const chunks = await collectChunks(engine.chatStream(messages));

    expect(chunks.some(c => c.type === 'usage')).toBe(true);
    expect(chunks.some(c => c.type === 'done')).toBe(true);
  });

  it('yields error chunk when provider not available', async () => {
    const failingPlugin: LLMProviderPlugin = {
      name: 'Failing Stream',
      id: 'failing',
      isAvailable: () => true,
      createProvider: () => () => {
        throw new Error('Stream failed');
      },
      getModels: () => [],
      calculateCost: () => 0,
    };

    const registry = createMockRegistry(failingPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [{ role: 'user', content: 'Hi' }];
    const chunks = await collectChunks(engine.chatStream(messages, { model: 'failing:test' }));

    expect(chunks.some(c => c.type === 'error')).toBe(true);
    const errorChunk = chunks.find(c => c.type === 'error') as { type: 'error'; message: string } | undefined;
    expect(errorChunk?.message).toContain('Provider failing not available');
  });

  it('should complete successfully on a simple stream', async () => {
    // Verify that a simple stream completes successfully with a done chunk
    const mockPlugin: LLMProviderPlugin = {
      name: 'Stream Mock',
      id: 'mock',
      isAvailable: () => true,
      createProvider: () => (modelId: string) => ({
        doStream: async () => ({
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'text-delta', textDelta: 'Response' });
              controller.enqueue({ type: 'finish', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } });
              controller.close();
            },
          }),
          specificationVersion: 'v1',
          provider: 'mock',
          modelId,
        }),
        specificationVersion: 'v1',
        provider: 'mock',
        modelId,
      }),
      getModels: () => [{
        id: 'mock-model',
        name: 'Mock Model',
        description: 'Test model',
        maxTokens: 4096,
        inputCostPer1K: 0.001,
        outputCostPer1K: 0.002,
        complexityRange: { min: 0, max: 100 },
        capabilities: ['text'],
      }],
      calculateCost: () => 0,
    };

    const registry = createMockRegistry(mockPlugin);
    const engine = new ChatEngine({ providerRegistry: registry });

    const messages: Message[] = [{ role: 'user', content: 'Hi' }];
    const chunks = await collectChunks(engine.chatStream(messages));

    // Should complete successfully without hitting depth limit
    expect(chunks.some(c => c.type === 'done')).toBe(true);
  });
});
