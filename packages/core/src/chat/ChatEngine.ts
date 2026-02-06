import { generateText, jsonSchema } from 'ai';
import type { Message, ChatConfig, ChatResult } from '@amicus/types';
import type { ProviderRegistry } from '../llm/ProviderRegistry.js';
import type { ToolRegistry } from '../tools/types.js';

const DEFAULT_SYSTEM_PROMPT = 'You are Amicus, a local-first AI assistant.';

export interface ChatEngineOptions {
  providerRegistry: ProviderRegistry;
  toolRegistry?: ToolRegistry;
}

export class ChatEngine {
  private providerRegistry: ProviderRegistry;
  private toolRegistry?: ToolRegistry;

  constructor(options: ChatEngineOptions) {
    this.providerRegistry = options.providerRegistry;
    if (options.toolRegistry) {
      this.toolRegistry = options.toolRegistry;
    }
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

    if (this.toolRegistry) {
      const toolDefs = this.toolRegistry.getDefinitions();
      if (toolDefs.length > 0) {
        const toolsConfig: Record<string, {
          description: string;
          parameters: ReturnType<typeof jsonSchema>;
        }> = {};

        for (const toolDef of toolDefs) {
          toolsConfig[toolDef.name] = {
            description: toolDef.description,
            parameters: jsonSchema(toolDef.input_schema),
          };
        }

        generateConfig.tools = toolsConfig;
      }
    }

    const result = await generateText(generateConfig);

    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCalls = result.toolCalls.map((tc: {
        toolCallId: string;
        toolName: string;
        args: Record<string, unknown>;
      }) => ({
        id: tc.toolCallId,
        name: tc.toolName,
        arguments: tc.args ?? {}
      }));

      messages.push({
        role: 'assistant',
        content: result.text || '',
        tool_calls: toolCalls
      });

      for (const call of toolCalls) {
        const tool = this.toolRegistry?.get(call.name);
        if (!tool) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: `Error: Unknown tool '${call.name}'`
          });
          continue;
        }

        try {
          const toolResult = await tool.execute(call.arguments);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: toolResult
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: `Error executing tool: ${errorMessage}`
          });
        }
      }

      return this.chat(messages, config);
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
