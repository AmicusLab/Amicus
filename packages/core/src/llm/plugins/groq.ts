import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ModelInfo, ProviderConfig } from './types.js';

export class GroqPlugin implements LLMProviderPlugin {
  readonly name = 'Groq';
  readonly id = 'groq';

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
      throw new Error('Groq API key not found');
    }

    const groq = createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey,
    });

    return groq('llama-3.3-70b-versatile');
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        description: 'Groq의 고성능 추론 모델',
        maxTokens: 8192,
        inputCostPer1K: 0.00059,
        outputCostPer1K: 0.00079,
        complexityRange: { min: 30, max: 100 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        description: '빠른 응답, 비용 효율적',
        maxTokens: 4096,
        inputCostPer1K: 0.00024,
        outputCostPer1K: 0.00024,
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
