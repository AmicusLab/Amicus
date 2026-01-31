import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ModelInfo, ProviderConfig } from './types.js';

export class MoonshotPlugin implements LLMProviderPlugin {
  readonly name = 'Moonshot (Kimi)';
  readonly id = 'moonshot';

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
      throw new Error('Moonshot API key not found');
    }

    const moonshot = createOpenAI({
      baseURL: 'https://api.moonshot.cn/v1',
      apiKey,
    });

    return moonshot('kimi-k2-5');
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'kimi-k2-5',
        name: 'Kimi K2.5',
        description: 'Moonshot의 최신 모델, 장문 컨텍스트 지원',
        maxTokens: 8192,
        inputCostPer1K: 0.005,
        outputCostPer1K: 0.015,
        complexityRange: { min: 40, max: 100 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'kimi-k2-5-flash',
        name: 'Kimi K2.5 Flash',
        description: '빠른 응답, 비용 효율적',
        maxTokens: 4096,
        inputCostPer1K: 0.001,
        outputCostPer1K: 0.003,
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
