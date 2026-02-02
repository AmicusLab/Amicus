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
        id: 'claude-opus-4-5-20251101',
        name: 'Claude Opus 4.5',
        description: 'Premium model combining maximum intelligence with practical performance',
        maxTokens: 200000,
        inputCostPer1K: 0.005,
        outputCostPer1K: 0.025,
        complexityRange: { min: 80, max: 100 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'claude-sonnet-4-5-20250929',
        name: 'Claude Sonnet 4.5',
        description: 'Smart model for complex agents and coding tasks',
        maxTokens: 200000,
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.015,
        complexityRange: { min: 70, max: 95 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'claude-haiku-4-5-20251001',
        name: 'Claude Haiku 4.5',
        description: 'Fastest model with near-frontier intelligence',
        maxTokens: 200000,
        inputCostPer1K: 0.001,
        outputCostPer1K: 0.005,
        complexityRange: { min: 40, max: 70 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      // Claude 4.x Models (Legacy)
      {
        id: 'claude-opus-4-1-20250805',
        name: 'Claude Opus 4.1',
        description: 'High-intelligence model with extended thinking and priority tier',
        maxTokens: 32000,
        inputCostPer1K: 0.015,
        outputCostPer1K: 0.075,
        complexityRange: { min: 80, max: 100 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        description: 'Balanced model with 1M token context window (beta)',
        maxTokens: 64000,
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.015,
        complexityRange: { min: 60, max: 90 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'claude-3-7-sonnet-20250219',
        name: 'Claude Sonnet 3.7',
        description: 'Legacy Sonnet model with 128K output (beta)',
        maxTokens: 128000,
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.015,
        complexityRange: { min: 50, max: 85 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        description: 'Legacy Opus model with extended thinking',
        maxTokens: 32000,
        inputCostPer1K: 0.015,
        outputCostPer1K: 0.075,
        complexityRange: { min: 80, max: 100 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude Haiku 3',
        description: 'Legacy Haiku model without extended thinking',
        maxTokens: 4096,
        inputCostPer1K: 0.00025,
        outputCostPer1K: 0.00125,
        complexityRange: { min: 25, max: 55 },
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
