import { generateText } from 'ai';
import type { Message, ChatConfig, ChatResult } from '@amicus/types';
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

    const result = await generateText(generateConfig);

    return {
      response: result.text,
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
