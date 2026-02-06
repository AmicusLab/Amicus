import { Hono } from 'hono';
import type { ChatConfig, Message, MessageRole } from '@amicus/types/chat';
import type { TokenUsage } from '@amicus/types/dashboard';
import { providerService } from '../services/ProviderService.js';
import { configManager } from '../services/ConfigService.js';

type ChatRequestBody = {
  messages: Message[];
  config?: ChatConfig;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMessageRole(value: unknown): value is MessageRole {
  return value === 'user' || value === 'assistant' || value === 'system';
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value)) return false;
  return isMessageRole(value.role) && typeof value.content === 'string';
}

function parseChatRequestBody(value: unknown): ChatRequestBody | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.messages)) return null;
  if (!value.messages.every(isMessage)) return null;

  const config = value.config;
  if (config !== undefined && !isRecord(config)) return null;

  return {
    messages: value.messages,
    ...(config !== undefined ? { config: config as ChatConfig } : {}),
  };
}

class ChatEngine {
  async chat(input: ChatRequestBody): Promise<{ response: string; usage: TokenUsage }> {
    if (!providerService.isInitialized()) {
      await providerService.initialize();
    }

    const registry = providerService.getRegistry();
    const cfg = configManager.getConfig();

    const configuredModel = input.config?.model?.trim();
    const defaultModel = (cfg.llm.defaultModel ?? undefined)?.trim();

    let modelId: string | undefined = configuredModel || defaultModel;
    if (!modelId) {
      const allModels = registry.getAllModels();
      if (allModels.length === 0) {
        throw new Error('No providers/models available');
      }
      modelId = `${allModels[0]!.providerId}:${allModels[0]!.id}`;
    }

    const { provider, model } = registry.parseModelId(modelId);
    const plugin = registry.getPlugin(provider);
    if (!plugin) {
      throw new Error(`Provider not loaded: ${provider}`);
    }

    const providerFactory = plugin.createProvider({}) as (modelId: string) => unknown;

    const { generateText } = await import('ai');

    const messages: Message[] = input.config?.systemPrompt
      ? [{ role: 'system', content: input.config.systemPrompt }, ...input.messages]
      : input.messages;

    const result = await generateText({
      model: providerFactory(model) as never,
      messages,
      ...(typeof input.config?.maxTokens === 'number' ? { maxTokens: input.config.maxTokens } : {}),
      ...(typeof input.config?.temperature === 'number' ? { temperature: input.config.temperature } : {}),
      ...(typeof input.config?.topP === 'number' ? { topP: input.config.topP } : {}),
    });

    return {
      response: result.text,
      usage: {
        input: result.usage.promptTokens,
        output: result.usage.completionTokens,
        total: result.usage.totalTokens,
      },
    };
  }
}

export const chatRoutes = new Hono();

const chatEngine = new ChatEngine();

chatRoutes.post('/', async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const body = parseChatRequestBody(rawBody);
  if (!body) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  try {
    const result = await chatEngine.chat(body);
    return c.json(result);
  } catch (error) {
    console.error('[Chat] LLM API call failed:', error);
    return c.json({ error: 'LLM API call failed' }, 500);
  }
});
