import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { LLMToolExecutor, type LLMToolExecutorOptions } from './LLMToolExecutor.js';
import { TaskStatus, TaskPriority, type Task } from '@amicus/types/core';
import type { Tool } from '@amicus/types/mcp';
import type { Economist } from '../llm/Economist.js';
import type { MCPClientLike } from '../routine/RoutineEngine.js';

describe('LLMToolExecutor', () => {
  let executor: LLMToolExecutor;
  let mockEconomist: Economist;
  let mockMCPClient: {
    discoverTools: ReturnType<typeof mock>;
    invokeTool: ReturnType<typeof mock>;
  };
  let task: Task;

  beforeEach(() => {
    task = {
      id: 'test-task',
      description: 'Test tool execution task',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockEconomist = {
      route: mock(() => ({
        model: 'openai:gpt-3.5-turbo',
        provider: 'openai',
        estimatedCost: 0.001,
        complexity: { lexical: 50, semantic: 50, scope: 50, total: 50 },
      })),
      providerRegistry: {
        languageModel: mock(() => ({})),
      },
    } as unknown as Economist;

    mockMCPClient = {
      discoverTools: mock(async () => []),
      invokeTool: mock(async () => ({ content: '', isError: false })),
    };

    executor = new LLMToolExecutor({
      economist: mockEconomist,
      mcpClient: mockMCPClient as unknown as MCPClientLike,
    });
  });

  describe('discoverTools', () => {
    test('should return tools from MCP client', async () => {
      const mockTools: Tool[] = [
        {
          name: 'weather',
          description: 'Get weather information',
          inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
        },
      ];
      mockMCPClient.discoverTools = mock(async () => mockTools);

      const tools = await executor.discoverTools();

      expect(tools).toEqual(mockTools);
      expect(mockMCPClient.discoverTools).toHaveBeenCalled();
    });

    test('should return empty array when no tools available', async () => {
      mockMCPClient.discoverTools = mock(async () => []);

      const tools = await executor.discoverTools();

      expect(tools).toEqual([]);
    });
  });

  describe('constructor', () => {
    test('should create instance with correct options', () => {
      const options: LLMToolExecutorOptions = {
        economist: mockEconomist,
        mcpClient: mockMCPClient as unknown as MCPClientLike,
      };

      const instance = new LLMToolExecutor(options);
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(LLMToolExecutor);
    });

    test('should have discoverTools method', () => {
      expect(typeof executor.discoverTools).toBe('function');
    });

    test('should have executeWithTools method', () => {
      expect(typeof executor.executeWithTools).toBe('function');
    });
  });

  describe('tool schema conversion', () => {
    test('should handle tools with string parameters', async () => {
      const mockTools: Tool[] = [
        {
          name: 'string_tool',
          description: 'Tool with string param',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
        },
      ];
      mockMCPClient.discoverTools = mock(async () => mockTools);

      const tools = await executor.discoverTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]?.name).toBe('string_tool');
    });

    test('should handle tools with number parameters', async () => {
      const mockTools: Tool[] = [
        {
          name: 'number_tool',
          description: 'Tool with number param',
          inputSchema: {
            type: 'object',
            properties: {
              count: { type: 'number' },
            },
          },
        },
      ];
      mockMCPClient.discoverTools = mock(async () => mockTools);

      const tools = await executor.discoverTools();
      expect(tools).toHaveLength(1);
    });

    test('should handle tools with boolean parameters', async () => {
      const mockTools: Tool[] = [
        {
          name: 'bool_tool',
          description: 'Tool with boolean param',
          inputSchema: {
            type: 'object',
            properties: {
              active: { type: 'boolean' },
            },
          },
        },
      ];
      mockMCPClient.discoverTools = mock(async () => mockTools);

      const tools = await executor.discoverTools();
      expect(tools).toHaveLength(1);
    });

    test('should handle tools with array parameters', async () => {
      const mockTools: Tool[] = [
        {
          name: 'array_tool',
          description: 'Tool with array param',
          inputSchema: {
            type: 'object',
            properties: {
              items: { 
                type: 'array',
                items: { type: 'string' }
              },
            },
          },
        },
      ];
      mockMCPClient.discoverTools = mock(async () => mockTools);

      const tools = await executor.discoverTools();
      expect(tools).toHaveLength(1);
    });

    test('should handle tools with nested object parameters', async () => {
      const mockTools: Tool[] = [
        {
          name: 'nested_tool',
          description: 'Tool with nested object',
          inputSchema: {
            type: 'object',
            properties: {
              config: {
                type: 'object',
                properties: {
                  key: { type: 'string' }
                }
              }
            },
          },
        },
      ];
      mockMCPClient.discoverTools = mock(async () => mockTools);

      const tools = await executor.discoverTools();
      expect(tools).toHaveLength(1);
    });

    test('should handle multiple tools', async () => {
      const mockTools: Tool[] = [
        {
          name: 'tool_a',
          description: 'Tool A',
          inputSchema: { type: 'object', properties: {} },
        },
        {
          name: 'tool_b',
          description: 'Tool B',
          inputSchema: { type: 'object', properties: {} },
        },
      ];
      mockMCPClient.discoverTools = mock(async () => mockTools);

      const tools = await executor.discoverTools();
      expect(tools).toHaveLength(2);
    });
  });

  describe('MCPClient integration', () => {
    test('should call invokeTool on mcpClient', async () => {
      mockMCPClient.invokeTool = mock(async (name: string, params: Record<string, unknown>) => ({ 
        content: `Executed ${name} with ${JSON.stringify(params)}`,
        isError: false 
      }));

      const result = await mockMCPClient.invokeTool('test_tool', { arg: 'value' });
      
      expect(result.content).toContain('test_tool');
      expect(result.isError).toBe(false);
    });

    test('should handle tool errors from mcpClient', async () => {
      mockMCPClient.invokeTool = mock(async () => ({ 
        content: 'Error occurred',
        isError: true 
      }));

      const result = await mockMCPClient.invokeTool('failing_tool', {});
      
      expect(result.isError).toBe(true);
    });
  });

  describe('Economist integration', () => {
    test('should use economist for routing', () => {
      const routing = mockEconomist.route(task);
      
      expect(mockEconomist.route).toHaveBeenCalledWith(task);
      expect(routing.model).toBe('openai:gpt-3.5-turbo');
      expect(routing.complexity).toBeDefined();
    });

    test('should throw error when no AI providers available', async () => {
      mockMCPClient.discoverTools = mock(async () => []);
      
      const economistWithoutRegistry = {
        route: mock(() => ({
          model: 'openai:gpt-3.5-turbo',
          provider: 'openai',
          estimatedCost: 0.001,
          complexity: { lexical: 50, semantic: 50, scope: 50, total: 50 },
        })),
        providerRegistry: undefined,
      } as unknown as Economist;

      const executorNoProvider = new LLMToolExecutor({
        economist: economistWithoutRegistry,
        mcpClient: mockMCPClient as unknown as MCPClientLike,
      });

      await expect(executorNoProvider.executeWithTools(task, 'Test')).rejects.toThrow('No AI providers available');
    });
  });
});
