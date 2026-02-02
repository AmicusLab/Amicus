/**
 * Anthropic Provider Plugin
 * 
 * Claude 모델을 위한 Anthropic 제공사 플러그인
 */

import { anthropic } from '@ai-sdk/anthropic';
import type { LLMProviderPlugin, ModelInfo, ProviderConfig } from './types.js';

export class AnthropicPlugin implements LLMProviderPlugin {
  readonly name = 'Anthropic';
  readonly id = 'anthropic';

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
      throw new Error('Anthropic API key not found');
    }

    return anthropic;
  }
  
  getModels(): ModelInfo[] {
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Anthropic의 최신 모델, 뛰어난 추론 능력',
        maxTokens: 8192,
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.015,
        complexityRange: { min: 40, max: 100 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: '빠른 응답, 비용 효율적',
        maxTokens: 4096,
        inputCostPer1K: 0.001,
        outputCostPer1K: 0.005,
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
