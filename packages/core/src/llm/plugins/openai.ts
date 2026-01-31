/**
 * OpenAI Provider Plugin
 * 
 * GPT 모델을 위한 OpenAI 제공사 플러그인
 */

import { openai } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ModelInfo, ProviderConfig } from './types.js';

export class OpenAIPlugin implements LLMProviderPlugin {
  readonly name = 'OpenAI';
  readonly id = 'openai';

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
      throw new Error('OpenAI API key not found');
    }

    return openai('gpt-4o');
  }
  
  getModels(): ModelInfo[] {
    return [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'OpenAI의 최신 멀티모달 모델',
        maxTokens: 8192,
        inputCostPer1K: 0.005,
        outputCostPer1K: 0.015,
        complexityRange: { min: 50, max: 100 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: '경량화된 GPT-4o, 빠르고 저렴',
        maxTokens: 4096,
        inputCostPer1K: 0.00015,
        outputCostPer1K: 0.0006,
        complexityRange: { min: 0, max: 70 },
        capabilities: ['text', 'vision', 'streaming'],
      },
    ];
  }
  
  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.getModels().find(m => m.id === modelId);
    if (!model) return 0;
    
    return (inputTokens * model.inputCostPer1K + outputTokens * model.outputCostPer1K) / 1000;
  }
}
