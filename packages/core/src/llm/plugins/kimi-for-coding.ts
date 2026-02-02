import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ProviderConfig, ModelInfo } from './types.js';

/**
 * Kimi for Coding Provider Plugin
 *
 * Uses OpenAI-compatible API via @ai-sdk/openai with custom baseURL.
 * Provides all Kimi models including coding-optimized variants.
 *
 * Base URL: https://api.kimi.com/coding/v1
 * Documentation: https://www.kimi.com/code/docs/en/
 */
export class KimiPlugin implements LLMProviderPlugin {
  readonly name = 'Kimi for Coding';
  readonly id = 'kimi-for-coding';

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
      baseURL: 'https://api.kimi.com/coding/v1',
      apiKey,
    });
    return provider;
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'kimi-for-coding',
        name: 'Kimi for Coding',
        description: 'Specialized coding model with extended 262K context window. Optimized for software development workflows including code generation, refactoring, bug fixing, code review, API integration, test writing, and technical documentation. Supports multi-file context analysis, large codebase understanding, and complex architectural discussions. Ideal for IDE integrations, code assistants, and developer tools.',
        maxTokens: 262144,
        inputCostPer1K: 0.0006,
        outputCostPer1K: 0.003,
        complexityRange: { min: 70, max: 100 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'kimi-for-coding/k2p5',
        name: 'Kimi K2.5 (Coding)',
        description: 'Kimi K2.5 model via coding endpoint. Latest flagship model with 262K context optimized for coding tasks. Provides the same powerful capabilities as kimi-for-coding with explicit K2.5 model selection. Best for users who want to ensure they are using the latest K2.5 architecture.',
        maxTokens: 262144,
        inputCostPer1K: 0.0006,
        outputCostPer1K: 0.003,
        complexityRange: { min: 70, max: 100 },
        capabilities: ['text', 'tools', 'streaming'],
      },
      {
        id: 'kimi-for-coding/kimi-k2-thinking',
        name: 'Kimi K2 Thinking (Coding)',
        description: 'Advanced reasoning model with Chain-of-Thought capabilities via coding endpoint. Excels at complex problem-solving, multi-step reasoning, mathematical computations, logical analysis, and tasks requiring explicit thought processes. Ideal for debugging logic, educational applications, and transparent decision-making systems in coding contexts.',
        maxTokens: 262144,
        inputCostPer1K: 0.0006,
        outputCostPer1K: 0.0025,
        complexityRange: { min: 70, max: 95 },
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
