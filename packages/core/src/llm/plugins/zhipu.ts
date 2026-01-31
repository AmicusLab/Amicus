import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ModelInfo, ProviderConfig } from './types.js';

export class ZhipuPlugin implements LLMProviderPlugin {
  readonly name = 'Zhipu AI';
  readonly id = 'zhipu';

  private apiKey: string | undefined;

  constructor(_module: unknown, envKey: string) {
    this.apiKey = process.env[envKey];
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  createProvider(config: ProviderConfig): unknown {
    const apiKey = config.apiKey ?? this.apiKey;
    if (!apiKey) {
      throw new Error('Zhipu API key not found');
    }

    const zhipu = createOpenAI({
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey,
    });

    return zhipu('glm-4');
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'glm-4',
        name: 'GLM-4',
        description: 'Zhipu의 최신 대형 언어 모델, 중국어 특화',
        maxTokens: 8192,
        inputCostPer1K: 0.01,
        outputCostPer1K: 0.01,
        complexityRange: { min: 40, max: 100 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'glm-4-flash',
        name: 'GLM-4 Flash',
        description: '빠른 응답, 경량화된 모델',
        maxTokens: 4096,
        inputCostPer1K: 0.001,
        outputCostPer1K: 0.001,
        complexityRange: { min: 0, max: 60 },
        capabilities: ['text', 'streaming'],
      },
    ];
  }

  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.getModels().find(m => m.id === modelId);
    if (!model) return 0;

    return (inputTokens * model.inputCostPer1K + outputTokens * model.outputCostPer1K) / 1000;
  }
}
