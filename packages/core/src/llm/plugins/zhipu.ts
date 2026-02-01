import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ProviderConfig, ModelInfo } from './types.js';

/**
 * Zhipu AI (智谱AI) Provider Plugin
 *
 * Uses OpenAI-compatible API via @ai-sdk/openai with custom baseURL.
 * Supports GLM-4 series models optimized for Chinese language tasks.
 *
 * Base URL: https://open.bigmodel.cn/api/paas/v4
 * Documentation: https://bigmodel.cn/dev/howuse/glm-4
 */
export class ZhipuPlugin implements LLMProviderPlugin {
  readonly name = 'Zhipu AI';
  readonly id = 'zhipu';

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
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey,
    });
    return provider('glm-4-plus');
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'glm-4-plus',
        name: 'GLM-4 Plus',
        description: 'Complex tasks, Chinese optimized',
        maxTokens: 8192,
        inputCostPer1K: 0.0007,
        outputCostPer1K: 0.0007,
        complexityRange: { min: 70, max: 100 },
        capabilities: ['text', 'vision', 'tools'],
      },
      {
        id: 'glm-4-flash',
        name: 'GLM-4 Flash',
        description: 'Ultra-low cost, Chinese optimized',
        maxTokens: 8192,
        inputCostPer1K: 0.00007,
        outputCostPer1K: 0.00007,
        complexityRange: { min: 0, max: 30 },
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
