import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ModelInfo, ProviderConfig } from './types.js';

/**
 * MiniMax Provider Plugin
 *
 * MiniMax provides Chinese language models with strong performance.
 * Uses OpenAI-compatible API endpoint.
 *
 * Base URL: https://api.minimax.chat/v1
 * Documentation: https://www.minimaxi.com/document/guides/chat-model/V2
 */
export class MiniMaxPlugin implements LLMProviderPlugin {
  readonly name = 'MiniMax';
  readonly id = 'minimax';

  constructor(
    private module: Record<string, unknown>,
    private apiKeyEnv: string
  ) {}

  createProvider(config?: ProviderConfig): unknown {
    const apiKey = config?.apiKey ?? process.env[this.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`${this.apiKeyEnv} not set`);
    }
    const provider = createOpenAI({
      baseURL: 'https://api.minimax.chat/v1',
      apiKey,
    });
    return provider;
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'abab6.5s-chat',
        name: 'abab6.5s Chat',
        description: 'MiniMax flagship model with strong reasoning',
        maxTokens: 8192,
        inputCostPer1K: 0.03,
        outputCostPer1K: 0.03,
        complexityRange: { min: 70, max: 95 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'abab6.5g-chat',
        name: 'abab6.5g Chat',
        description: 'MiniMax general purpose model',
        maxTokens: 8192,
        inputCostPer1K: 0.015,
        outputCostPer1K: 0.015,
        complexityRange: { min: 50, max: 80 },
        capabilities: ['text', 'streaming'],
      },
      {
        id: 'abab6.5t-chat',
        name: 'abab6.5t Chat',
        description: 'MiniMax fast model for simple tasks',
        maxTokens: 8192,
        inputCostPer1K: 0.005,
        outputCostPer1K: 0.005,
        complexityRange: { min: 30, max: 60 },
        capabilities: ['text', 'streaming'],
      },
      {
        id: 'abab5.5-chat',
        name: 'abab5.5 Chat',
        description: 'MiniMax legacy model',
        maxTokens: 8192,
        inputCostPer1K: 0.015,
        outputCostPer1K: 0.015,
        complexityRange: { min: 40, max: 70 },
        capabilities: ['text', 'streaming'],
      },
    ];
  }

  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.getModels().find((m) => m.id === modelId);
    if (!model) return 0;
    return (
      (inputTokens / 1000) * model.inputCostPer1K +
      (outputTokens / 1000) * model.outputCostPer1K
    );
  }
}
