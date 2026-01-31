import { generateText, tool as createTool, type LanguageModelV1 } from 'ai';
import { z } from 'zod';
import type { Task } from '@amicus/types/core';
import type { Tool } from '@amicus/types/mcp';
import type { Economist } from '../llm/Economist.js';
import type { MCPClientLike } from '../routine/RoutineEngine.js';

export interface LLMToolExecutorOptions {
  economist: Economist;
  mcpClient: MCPClientLike;
}

export interface LLMToolExecutionResult {
  text: string;
  toolCalls: Array<{
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
}

export class LLMToolExecutor {
  private economist: Economist;
  private mcpClient: MCPClientLike;

  constructor(options: LLMToolExecutorOptions) {
    this.economist = options.economist;
    this.mcpClient = options.mcpClient;
  }

  async discoverTools(): Promise<Tool[]> {
    return this.mcpClient.discoverTools();
  }

  private jsonSchemaToZod(schema: Record<string, unknown>): z.ZodType<unknown> {
    const type = schema.type as string | undefined;

    switch (type) {
      case 'string':
        return z.string();
      case 'number':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'array': {
        const itemsSchema = schema.items as Record<string, unknown> | undefined;
        if (itemsSchema) {
          return z.array(this.jsonSchemaToZod(itemsSchema) as z.ZodType<unknown>);
        }
        return z.array(z.unknown());
      }
      case 'object': {
        const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
        const required = schema.required as string[] | undefined;
        
        if (!properties) {
          return z.record(z.string(), z.unknown());
        }

        const shape: Record<string, z.ZodType<unknown>> = {};
        for (const [key, propSchema] of Object.entries(properties)) {
          let zodType = this.jsonSchemaToZod(propSchema);
          if (required?.includes(key)) {
            shape[key] = zodType;
          } else {
            shape[key] = zodType.optional();
          }
        }
        return z.object(shape);
      }
      default:
        return z.unknown();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertMCPToolsToAITools(tools: Tool[]): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiTools: Record<string, any> = {};

    for (const tool of tools) {
      const parameters = this.jsonSchemaToZod(tool.inputSchema);
      
      aiTools[tool.name] = createTool({
        description: tool.description,
        // Cast to any to handle Zod version mismatch between zod 4.x and ai package
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parameters: parameters as any,
        execute: async (args: Record<string, unknown>) => {
          const result = await this.mcpClient.invokeTool(tool.name, args);
          return {
            content: result.content,
            isError: result.isError ?? false,
          };
        },
      });
    }

    return aiTools;
  }

  async executeWithTools(task: Task, prompt: string): Promise<LLMToolExecutionResult> {
    const tools = await this.discoverTools();
    
    const routing = this.economist.route(task);
    const providerRegistry = (this.economist as unknown as { 
      providerRegistry: { languageModel: (modelId: string) => LanguageModelV1 } 
    }).providerRegistry;
    
    if (!providerRegistry) {
      throw new Error('No AI providers available');
    }

    const model = providerRegistry.languageModel(routing.model);
    
    if (tools.length === 0) {
      const result = await generateText({ model, prompt });
      
      return {
        text: result.text,
        toolCalls: [],
      };
    }

    const aiTools = this.convertMCPToolsToAITools(tools);
    
    const result = await generateText({
      model,
      prompt,
      tools: aiTools,
      maxSteps: 5,
    });

    const toolCalls: Array<{ toolName: string; args: Record<string, unknown>; result: unknown }> = [];
    
    for (const step of result.steps) {
      if (step.toolResults) {
        for (const toolResult of step.toolResults) {
          toolCalls.push({
            toolName: toolResult.toolName,
            args: toolResult.args as Record<string, unknown>,
            result: toolResult.result,
          });
        }
      }
    }

    return {
      text: result.text,
      toolCalls,
    };
  }
}
