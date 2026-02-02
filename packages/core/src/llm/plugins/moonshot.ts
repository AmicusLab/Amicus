import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ModelInfo, ProviderConfig } from './types.js';

/**
 * Moonshot Provider Plugin
 *
 * Moonshot AI (月之暗面) provides Kimi models optimized for Chinese language tasks.
 * Uses OpenAI-compatible API endpoint.
 *
 * Base URL: https://api.moonshot.cn/v1
 * Documentation: https://platform.moonshot.cn/docs/api-reference
 */
export class MoonshotPlugin implements LLMProviderPlugin {
  readonly name = 'Moonshot';
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
    return provider;
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'moonshot-v1-8k',
        name: 'Moonshot v1 8K',
        description: 'Kimi model with 8K context window',
        maxTokens: 8192,
        inputCostPer1K: 0.012,
        outputCostPer1K: 0.012,
        complexityRange: { min: 40, max: 70 },
        capabilities: ['text', 'streaming'],
      },
      {
        id: 'moonshot-v1-32k',
        name: 'Moonshot v1 32K',
        description: 'Kimi model with 32K context window',
        maxTokens: 32768,
        inputCostPer1K: 0.024,
        outputCostPer1K: 0.024,
        complexityRange: { min: 50, max: 80 },
        capabilities: ['text', 'streaming'],
      },
      {
        id: 'moonshot-v1-128k',
        name: 'Moonshot v1 128K',
        description: 'Kimi model with 128K context window',
        maxTokens: 131072,
        inputCostPer1K: 0.06,
        outputCostPer1K: 0.06,
        complexityRange: { min: 60, max: 90 },
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
