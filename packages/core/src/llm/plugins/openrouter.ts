import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ModelInfo, ProviderConfig } from './types.js';

/**
 * OpenRouter Provider Plugin
 *
 * OpenRouter is a unified API for accessing 100+ LLM models from various providers.
 * Provides single API key access to Anthropic, OpenAI, Google, Meta, Mistral, and more.
 * Uses OpenAI-compatible API endpoint.
 *
 * Base URL: https://openrouter.ai/api/v1
 * Documentation: https://openrouter.ai/docs/api-reference
 */
export class OpenRouterPlugin implements LLMProviderPlugin {
  readonly name = 'OpenRouter';
  readonly id = 'openrouter';

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
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    });
    return provider; // ✅ Return factory, not instance!
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        description: 'Anthropic flagship model',
        maxTokens: 8192,
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.015,
        complexityRange: { min: 70, max: 95 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'openai/gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'OpenAI flagship model',
        maxTokens: 4096,
        inputCostPer1K: 0.01,
        outputCostPer1K: 0.03,
        complexityRange: { min: 75, max: 100 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'meta-llama/llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B',
        description: 'Meta open-source flagship',
        maxTokens: 4096,
        inputCostPer1K: 0.00059,
        outputCostPer1K: 0.00079,
        complexityRange: { min: 50, max: 80 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'google/gemini-pro-1.5',
        name: 'Gemini Pro 1.5',
        description: 'Google multimodal model',
        maxTokens: 8192,
        inputCostPer1K: 0.00125,
        outputCostPer1K: 0.005,
        complexityRange: { min: 60, max: 85 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'mistralai/mixtral-8x7b-instruct',
        name: 'Mixtral 8x7B',
        description: 'Mistral MoE model',
        maxTokens: 32768,
        inputCostPer1K: 0.00027,
        outputCostPer1K: 0.00027,
        complexityRange: { min: 40, max: 70 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'openai/gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'OpenAI fast/cost-efficient',
        maxTokens: 4096,
        inputCostPer1K: 0.0005,
        outputCostPer1K: 0.0015,
        complexityRange: { min: 30, max: 60 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'anthropic/claude-3-haiku',
        name: 'Claude 3 Haiku',
        description: 'Anthropic fast model',
        maxTokens: 4096,
        inputCostPer1K: 0.00025,
        outputCostPer1K: 0.00125,
        complexityRange: { min: 35, max: 65 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'meta-llama/llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B',
        description: 'Meta lightweight model',
        maxTokens: 4096,
        inputCostPer1K: 0.00007,
        outputCostPer1K: 0.00007,
        complexityRange: { min: 25, max: 50 },
        capabilities: ['text', 'tools', 'streaming'],
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
