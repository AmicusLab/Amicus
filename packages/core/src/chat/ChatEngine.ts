import { generateText, jsonSchema } from 'ai';
import type { Message, ChatConfig, ChatResult, ToolDefinition } from '@amicus/types';
import type { ProviderRegistry } from '../llm/ProviderRegistry.js';

const DEFAULT_SYSTEM_PROMPT = 'You are Amicus, a local-first AI assistant.';

export interface ChatEngineOptions {
  providerRegistry: ProviderRegistry;
}

export class ChatEngine {
  private providerRegistry: ProviderRegistry;

  constructor(options: ChatEngineOptions) {
    this.providerRegistry = options.providerRegistry;
  }

  async chat(messages: Message[], config?: ChatConfig): Promise<ChatResult> {
    const systemPrompt = config?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    let modelId: string;
    let providerId: string;

    if (config?.model) {
      const parsed = this.providerRegistry.parseModelId(config.model);
      providerId = parsed.provider;
      modelId = parsed.model;
    } else {
      const routingResult = this.providerRegistry.selectModel(50);
      providerId = routingResult.provider;
      modelId = routingResult.modelInfo.id;
    }

    const plugin = this.providerRegistry.getPlugin(providerId);
    if (!plugin) {
      throw new Error(`Provider ${providerId} not available`);
    }

    const provider = plugin.createProvider({});
    if (typeof provider !== 'function') {
      throw new Error(`Invalid provider factory for ${providerId}`);
    }

    const model = provider(modelId);

    const generateConfig: Parameters<typeof generateText>[0] = {
      model,
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    };

    if (config?.maxTokens !== undefined) {
      generateConfig.maxTokens = config.maxTokens;
    }
    if (config?.temperature !== undefined) {
      generateConfig.temperature = config.temperature;
    }
    if (config?.topP !== undefined) {
      generateConfig.topP = config.topP;
    }

    if (config?.tools && config.tools.length > 0) {
      const toolsConfig: Record<string, {
        description: string;
        parameters: ReturnType<typeof jsonSchema>;
      }> = {};

      for (const tool of config.tools) {
        toolsConfig[tool.name] = {
          description: tool.description,
          parameters: jsonSchema(tool.parameters),
        };
      }

      generateConfig.tools = toolsConfig;
    }

    const result = await generateText(generateConfig);

    if (result.toolCalls && result.toolCalls.length > 0) {
      const firstToolCall = result.toolCalls[0] as {
        toolCallId: string;
        toolName: string;
        args: Record<string, unknown>;
      };

      return {
        response: {
          type: 'tool_call',
          toolCall: {
            toolCallId: firstToolCall.toolCallId,
            tool: firstToolCall.toolName,
            args: firstToolCall.args ?? {},
          },
        },
        usage: {
          input: result.usage.promptTokens,
          output: result.usage.completionTokens,
          total: result.usage.totalTokens,
        },
        model: modelId,
        provider: providerId,
      };
    }

    return {
      response: {
        type: 'text',
        content: result.text,
      },
      usage: {
        input: result.usage.promptTokens,
        output: result.usage.completionTokens,
        total: result.usage.totalTokens,
      },
      model: modelId,
      provider: providerId,
    };
  }
}
