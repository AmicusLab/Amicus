import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ProviderConfig, ModelInfo } from './types.js';

/**
 * Z.ai Coding Plan Provider Plugin
 *
 * Uses GLM Coding Plan endpoint for coding scenarios.
 * Supports 15 models: 10 text models and 5 vision models.
 *
 * Base URL: https://api.z.ai/api/coding/paas/v4
 * Documentation: https://docs.z.ai/api-reference/introduction
 */
export class ZaiCodingPlanPlugin implements LLMProviderPlugin {
  readonly name = 'z.ai (Coding Plan)';
  readonly id = 'zai-coding-plan';

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
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
      apiKey,
    });
    return provider;
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      // Text Models (10)
      {
        id: 'glm-4.7',
        name: 'GLM-4.7',
        description: 'Flagship model',
        maxTokens: 8192,
        inputCostPer1K: 0.6,
        outputCostPer1K: 2.2,
        complexityRange: { min: 70, max: 100 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'glm-4.7-flash',
        name: 'GLM-4.7 Flash',
        description: 'Free model',
        maxTokens: 8192,
        inputCostPer1K: 0,
        outputCostPer1K: 0,
        complexityRange: { min: 50, max: 80 },
        capabilities: ['text', 'streaming'],
      },
      {
        id: 'glm-4.7-flashx',
        name: 'GLM-4.7 FlashX',
        description: 'Fast model',
        maxTokens: 8192,
        inputCostPer1K: 0.07,
        outputCostPer1K: 0.4,
        complexityRange: { min: 50, max: 80 },
        capabilities: ['text', 'streaming'],
      },
      {
        id: 'glm-4.6',
        name: 'GLM-4.6',
        description: 'Standard model',
        maxTokens: 8192,
        inputCostPer1K: 0.5,
        outputCostPer1K: 1.8,
        complexityRange: { min: 60, max: 90 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'glm-4.5',
        name: 'GLM-4.5',
        description: 'Balanced model',
        maxTokens: 8192,
        inputCostPer1K: 0.3,
        outputCostPer1K: 1.2,
        complexityRange: { min: 50, max: 80 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'glm-4.5-x',
        name: 'GLM-4.5 X',
        description: 'Extended model',
        maxTokens: 8192,
        inputCostPer1K: 0.4,
        outputCostPer1K: 1.5,
        complexityRange: { min: 55, max: 85 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'glm-4.5-air',
        name: 'GLM-4.5 Air',
        description: 'Lightweight',
        maxTokens: 8192,
        inputCostPer1K: 0.1,
        outputCostPer1K: 0.5,
        complexityRange: { min: 30, max: 60 },
        capabilities: ['text', 'streaming'],
      },
      {
        id: 'glm-4.5-airx',
        name: 'GLM-4.5 AirX',
        description: 'Ultra-fast',
        maxTokens: 8192,
        inputCostPer1K: 0.05,
        outputCostPer1K: 0.3,
        complexityRange: { min: 25, max: 55 },
        capabilities: ['text', 'streaming'],
      },
      {
        id: 'glm-4.5-flash',
        name: 'GLM-4.5 Flash',
        description: 'Fast balanced',
        maxTokens: 8192,
        inputCostPer1K: 0.08,
        outputCostPer1K: 0.4,
        complexityRange: { min: 40, max: 70 },
        capabilities: ['text', 'streaming'],
      },
      {
        id: 'glm-4-32b-0414-128k',
        name: 'GLM-4 32B 128K',
        description: '32B model',
        maxTokens: 128000,
        inputCostPer1K: 0.2,
        outputCostPer1K: 0.8,
        complexityRange: { min: 45, max: 75 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      // Vision Models (5)
      {
        id: 'glm-4.6v',
        name: 'GLM-4.6V',
        description: 'Vision standard',
        maxTokens: 8192,
        inputCostPer1K: 0.6,
        outputCostPer1K: 2.2,
        complexityRange: { min: 60, max: 90 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'glm-4.6v-flash',
        name: 'GLM-4.6V Flash',
        description: 'Vision fast',
        maxTokens: 8192,
        inputCostPer1K: 0,
        outputCostPer1K: 0,
        complexityRange: { min: 50, max: 80 },
        capabilities: ['text', 'vision', 'streaming'],
      },
      {
        id: 'glm-4.6v-flashx',
        name: 'GLM-4.6V FlashX',
        description: 'Vision ultra',
        maxTokens: 8192,
        inputCostPer1K: 0.07,
        outputCostPer1K: 0.4,
        complexityRange: { min: 50, max: 80 },
        capabilities: ['text', 'vision', 'streaming'],
      },
      {
        id: 'glm-4.5v',
        name: 'GLM-4.5V',
        description: 'Vision balanced',
        maxTokens: 8192,
        inputCostPer1K: 0.3,
        outputCostPer1K: 1.2,
        complexityRange: { min: 50, max: 80 },
        capabilities: ['text', 'vision', 'streaming'],
      },
      {
        id: 'autoglm-phone-multilingual',
        name: 'AutoGLM Phone Multilingual',
        description: 'Phone agent',
        maxTokens: 8192,
        inputCostPer1K: 0.4,
        outputCostPer1K: 1.5,
        complexityRange: { min: 55, max: 85 },
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
