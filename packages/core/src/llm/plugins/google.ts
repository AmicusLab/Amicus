/**
 * Google Provider Plugin
 * 
 * Gemini 모델을 위한 Google 제공사 플러그인
 */

import { google } from '@ai-sdk/google';
import type { LLMProviderPlugin, ModelInfo, ProviderConfig } from './types.js';

export class GooglePlugin implements LLMProviderPlugin {
  readonly name = 'Google';
  readonly id = 'google';

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
      throw new Error('Google API key not found');
    }

    return google('gemini-1.5-pro-latest');
  }
  
  getModels(): ModelInfo[] {
    return [
      {
        id: 'gemini-1.5-pro-latest',
        name: 'Gemini 1.5 Pro',
        description: 'Google의 최신 프로 모델, 긴 컨텍스트',
        maxTokens: 8192,
        inputCostPer1K: 0.00125,
        outputCostPer1K: 0.005,
        complexityRange: { min: 40, max: 100 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'gemini-1.5-flash-latest',
        name: 'Gemini 1.5 Flash',
        description: '빠른 응답, 비용 효율적',
        maxTokens: 4096,
        inputCostPer1K: 0.000075,
        outputCostPer1K: 0.0003,
        complexityRange: { min: 0, max: 60 },
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
