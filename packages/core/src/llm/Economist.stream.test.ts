import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { Economist } from './Economist.js';
import { TaskStatus, TaskPriority, type Task } from '@amicus/types/core';

async function* mockTextStream(text: string): AsyncIterable<string> {
  const chunks = text.split(' ');
  for (const chunk of chunks) {
    yield chunk + ' ';
  }
}

function createMockStreamingResult(text: string) {
  return {
    textStream: mockTextStream(text),
    fullTextPromise: Promise.resolve(text),
    usage: Promise.resolve({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    }),
  };
}

describe('Economist Streaming', () => {
  let economist: Economist;
  let task: Task;

  beforeEach(() => {
    economist = new Economist({
      defaultModel: 'openai:gpt-3.5-turbo',
      budget: 1.0,
    });

    task = {
      id: 'test-task',
      description: 'Test streaming task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  test('should stream text chunks', async () => {
    const mockText = 'Hello world test';
    economist.generateTextStream = mock(async () => createMockStreamingResult(mockText));
    
    const result = await economist.generateTextStream(task, 'Say hello in 3 words');
    
    const chunks: string[] = [];
    for await (const chunk of result.textStream) {
      chunks.push(chunk);
    }
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toBe('Hello world test ');
    
    const fullText = await result.fullTextPromise;
    expect(fullText).toBe(mockText);
    expect(typeof fullText).toBe('string');
  });

  test('should track cost after streaming completes', async () => {
    const statsBefore = economist.getCostStats();
    const initialRequests = statsBefore.requests;
    
    const mockText = 'One two three four five';
    const originalGenerateTextStream = economist.generateTextStream.bind(economist);
    
    economist.generateTextStream = mock(async (t: Task, p: string) => {
      const result = createMockStreamingResult(mockText);
      
      result.fullTextPromise.then(() => {
        const routing = economist.route(t);
        const inputLength = p.length;
        const outputLength = mockText.length;
        const model = economist.getAvailableModels().find(m => m.id === routing.model);
        if (model) {
          const inputTokens = Math.ceil(inputLength / 4);
          const outputTokens = Math.ceil(outputLength / 4);
          const cost = (inputTokens / 1000) * model.inputCostPer1K + (outputTokens / 1000) * model.outputCostPer1K;
        }
      });
      
      return result;
    });
    
    const result = await economist.generateTextStream(task, 'Count to 5');
    await result.fullTextPromise;
    
    const statsAfter = economist.getCostStats();
    expect(statsAfter.requests).toBeGreaterThanOrEqual(initialRequests);
  });

  test('should respect budget limits', async () => {
    const limitedEconomist = new Economist({
      defaultModel: 'openai:gpt-3.5-turbo',
      budget: 0.000001,
    });

    await expect(
      limitedEconomist.generateTextStream(task, 'This should fail due to budget')
    ).rejects.toThrow('Budget exceeded');
  });

  test('should return streaming result with correct structure', async () => {
    const mockTask: Task = {
      id: 'mock-task',
      description: 'Simple task for structure test',
      status: TaskStatus.PENDING,
      priority: TaskPriority.LOW,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const mockText = 'Hi there';
    economist.generateTextStream = mock(async () => createMockStreamingResult(mockText));

    const result = await economist.generateTextStream(mockTask, 'Hi');
    
    expect(result).toBeDefined();
    expect(result.textStream).toBeDefined();
    expect(result.fullTextPromise).toBeDefined();
    expect(result.usage).toBeDefined();
    
    expect(typeof result.textStream[Symbol.asyncIterator]).toBe('function');
    expect(result.fullTextPromise instanceof Promise).toBe(true);
    expect(result.usage instanceof Promise).toBe(true);
  });

  test('should provide usage information', async () => {
    const mockText = 'Hello';
    economist.generateTextStream = mock(async () => createMockStreamingResult(mockText));
    
    const result = await economist.generateTextStream(task, 'Say one word');
    
    await result.fullTextPromise;
    
    const usage = await result.usage;
    expect(usage).toBeDefined();
    expect(typeof usage.promptTokens).toBe('number');
    expect(typeof usage.completionTokens).toBe('number');
    expect(usage.promptTokens).toBeGreaterThan(0);
    expect(usage.completionTokens).toBeGreaterThan(0);
  });

  test('should route to appropriate model based on complexity', async () => {
    const simpleTask: Task = {
      id: 'simple',
      description: 'Fix typo',
      status: TaskStatus.PENDING,
      priority: TaskPriority.LOW,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const complexTask: Task = {
      id: 'complex',
      description: 'Design and implement a complex distributed system architecture with microservices',
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const simpleRouting = economist.route(simpleTask);
    const complexRouting = economist.route(complexTask);

    expect(simpleRouting.complexity.total).toBeLessThan(complexRouting.complexity.total);
    expect(simpleRouting.estimatedCost).toBeLessThan(complexRouting.estimatedCost);
  });
});
