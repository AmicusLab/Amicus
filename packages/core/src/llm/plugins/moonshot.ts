import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ProviderConfig, ModelInfo } from './types.js';

/**
 * Moonshot (Kimi) Provider Plugin
 *
 * Uses OpenAI-compatible API via @ai-sdk/openai with custom baseURL.
 * Supports Kimi K2.5 with ultra-long context window (256K tokens).
 *
 * Base URL: https://api.moonshot.cn/v1
 * Documentation: https://platform.moonshot.ai/docs
 */
export class MoonshotPlugin implements LLMProviderPlugin {
  readonly name = 'Moonshot (Kimi)';
  readonly id = 'moonshot';

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
      baseURL: 'https://api.moonshot.cn/v1',
      apiKey,
    });
    return provider('kimi-k2.5');
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'kimi-k2.5',
        name: 'Kimi K2.5',
        description: 'Long context (256K), multimodal',
        maxTokens: 256000,
        inputCostPer1K: 0.0006,
        outputCostPer1K: 0.003,
        complexityRange: { min: 70, max: 100 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
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
