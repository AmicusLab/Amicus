import type { LLMProviderConfig } from '../llm/plugins/types.js';

/**
 * LLM Provider Configuration Template
 *
 * This file defines all available LLM providers and their settings.
 * Providers can be enabled/disabled individually.
 *
 * To use a provider:
 * 1. Set enabled: true
 * 2. Add the corresponding API key to your .env file
 * 3. The provider will be automatically loaded on startup
 */
export const llmProviderConfig: LLMProviderConfig = {
  providers: [
    // Official Vercel AI SDK providers (enabled by default)
    {
      id: 'anthropic',
      enabled: true,
      package: '@ai-sdk/anthropic',
      envKey: 'ANTHROPIC_API_KEY',
    },
    {
      id: 'openai',
      enabled: true,
      package: '@ai-sdk/openai',
      envKey: 'OPENAI_API_KEY',
    },
    {
      id: 'google',
      enabled: true,
      package: '@ai-sdk/google',
      envKey: 'GOOGLE_API_KEY',
    },
    {
      id: 'groq',
      enabled: true,
      package: '@ai-sdk/groq',
      envKey: 'GROQ_API_KEY',
    },

    // Community/Compatible providers (disabled by default)
    {
      id: 'zai',
      enabled: false,
      package: '@ai-sdk/openai', // Uses OpenAI-compatible API
      envKey: 'ZAI_API_KEY',
      baseURL: 'https://api.z.ai/v1',
    },
    {
      id: 'moonshot',
      enabled: false,
      package: '@ai-sdk/openai', // Uses OpenAI-compatible API
      envKey: 'MOONSHOT_API_KEY',
    },
  ],

  // Default model for routing (format: provider:model)
  defaultModel: 'anthropic:claude-3-5-sonnet-20241022',

  // Daily budget in USD
  dailyBudget: 10.0,

  // Budget alert threshold (0.0 - 1.0)
  budgetAlertThreshold: 0.8,
};

/**
 * Helper function to get enabled providers
 */
export function getEnabledProviders(config: LLMProviderConfig = llmProviderConfig) {
  return config.providers.filter(p => p.enabled);
}

/**
 * Helper function to get provider by ID
 */
export function getProviderConfig(id: string, config: LLMProviderConfig = llmProviderConfig) {
  return config.providers.find(p => p.id === id);
}
