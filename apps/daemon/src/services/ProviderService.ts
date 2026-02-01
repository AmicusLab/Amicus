import {
  ProviderRegistry,
  llmProviderConfig,
  type ProviderConfigEntry,
  type LLMProviderConfig,
} from '@amicus/core';
import type { LLMProviderStatus, APIKeyValidationResult } from '@amicus/types/dashboard';
import { configManager, secretStore } from './ConfigService.js';

class ProviderService {
  private registry: ProviderRegistry;
  private initialized = false;

  constructor() {
    this.registry = new ProviderRegistry();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadProvidersFromConfig();
      console.log(`[ProviderService] Loaded ${this.registry.getLoadedProviders().length} provider(s)`);
      this.initialized = true;
    } catch (error) {
      console.error('[ProviderService] Failed to initialize:', error);
    }
  }

  async reload(): Promise<void> {
    // Reload configuration and re-load plugins.
    this.registry.unloadAll();
    await this.loadProvidersFromConfig();
    this.initialized = true;
  }

  getAdminProviderView(): Array<{
    id: string;
    enabled: boolean;
    loaded: boolean;
    available: boolean;
    modelCount: number;
    error?: string;
  }> {
    const cfg = configManager.getConfig();
    const config: LLMProviderConfig = cfg.llm.providers.length > 0
      ? {
          providers: cfg.llm.providers.map((p) => ({
            id: p.id,
            enabled: p.enabled,
            package: p.package,
            ...(p.envKey ? { envKey: p.envKey } : {}),
          })),
          defaultModel: cfg.llm.defaultModel,
          dailyBudget: cfg.llm.dailyBudget,
          budgetAlertThreshold: cfg.llm.budgetAlertThreshold,
        }
      : llmProviderConfig;

    const state = this.registry.getState();
    return config.providers.map((p) => {
      const loaded = state.loadedProviders.includes(p.id);
      const available = state.availableProviders.includes(p.id);
      const failed = state.failedProviders.find((fp) => fp.providerId === p.id);
      return {
        id: p.id,
        enabled: p.enabled,
        loaded,
        available,
        modelCount: this.registry.getModelsByProvider(p.id).length,
        ...(failed?.message ? { error: failed.message } : {}),
      };
    });
  }

  private async loadProvidersFromConfig(): Promise<void> {
    const cfg = configManager.getConfig();
    const providerCfg: LLMProviderConfig = cfg.llm.providers.length > 0
      ? {
          providers: cfg.llm.providers.map((p) => ({
            id: p.id,
            enabled: p.enabled,
            package: p.package,
            ...(p.envKey ? { envKey: p.envKey } : {}),
          })),
          defaultModel: cfg.llm.defaultModel,
          dailyBudget: cfg.llm.dailyBudget,
          budgetAlertThreshold: cfg.llm.budgetAlertThreshold,
        }
      : llmProviderConfig;

    // Apply persisted secrets into process.env for provider SDKs.
    for (const p of providerCfg.providers) {
      const envKey = p.envKey ?? `${p.id.toUpperCase()}_API_KEY`;
      if (!process.env[envKey]) {
        const secret = secretStore.get(envKey);
        if (secret) {
          process.env[envKey] = secret;
        }
      }
    }

    await this.registry.loadFromConfig(providerCfg);
  }

  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  getProviderStatuses(): LLMProviderStatus[] {
    const cfg = configManager.getConfig();
    const config: LLMProviderConfig = cfg.llm.providers.length > 0
      ? {
          providers: cfg.llm.providers.map((p) => ({
            id: p.id,
            enabled: p.enabled,
            package: p.package,
            ...(p.envKey ? { envKey: p.envKey } : {}),
          })),
          defaultModel: cfg.llm.defaultModel,
          dailyBudget: cfg.llm.dailyBudget,
          budgetAlertThreshold: cfg.llm.budgetAlertThreshold,
        }
      : llmProviderConfig;
    const state = this.registry.getState();
    
    const statuses: LLMProviderStatus[] = config.providers.map((providerConfig: ProviderConfigEntry) => {
      const isAvailable = state.availableProviders.includes(providerConfig.id);
      const failedProvider = state.failedProviders.find(fp => fp.providerId === providerConfig.id);
      const models = this.registry.getModelsByProvider(providerConfig.id);
      
      const status: LLMProviderStatus = {
        id: providerConfig.id,
        name: providerConfig.id.charAt(0).toUpperCase() + providerConfig.id.slice(1),
        enabled: providerConfig.enabled,
        available: isAvailable,
        modelCount: models.length,
      };
      
      if (failedProvider?.message) {
        status.error = failedProvider.message;
      }
      
      return status;
    });
    
    return statuses;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Validate API key for a specific provider
   * @param providerId Provider ID (e.g., 'zai')
   * @param apiKey API key to validate
   * @returns Validation result
   */
  async validateApiKey(providerId: string, apiKey: string): Promise<APIKeyValidationResult> {
    const cfg = configManager.getConfig();
    const provider = cfg.llm.providers.find((p) => p.id === providerId);
    
    if (!provider) {
      return {
        valid: false,
        providerId,
        error: `Unknown provider: ${providerId}`,
      };
    }

    // For z.ai, make a test request to validate the API key
    if (providerId === 'zai') {
      return this.validateZaiApiKey(apiKey);
    }

    // For other providers, basic check (non-empty)
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        valid: false,
        providerId,
        error: 'API key is empty',
      };
    }

    return {
      valid: true,
      providerId,
    };
  }

  /**
   * Validate z.ai API key by making a test request
   */
  private async validateZaiApiKey(apiKey: string): Promise<APIKeyValidationResult> {
    const baseURL = 'https://api.z.ai/v1';
    
    try {
      const response = await fetch(`${baseURL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200) {
        return {
          valid: true,
          providerId: 'zai',
        };
      } else if (response.status === 401) {
        return {
          valid: false,
          providerId: 'zai',
          error: 'Invalid API key',
          details: {
            statusCode: response.status,
            message: 'Authentication failed',
          },
        };
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          valid: false,
          providerId: 'zai',
          error: `API request failed: ${errorText}`,
          details: {
            statusCode: response.status,
            message: errorText,
          },
        };
      }
    } catch (error) {
      return {
        valid: false,
        providerId: 'zai',
        error: `Connection error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Test connection to a provider
   * @param providerId Provider ID
   * @returns Connection test result
   */
  async testConnection(providerId: string): Promise<APIKeyValidationResult> {
    const cfg = configManager.getConfig();
    const provider = cfg.llm.providers.find((p) => p.id === providerId);
    
    if (!provider) {
      return {
        valid: false,
        providerId,
        error: `Unknown provider: ${providerId}`,
      };
    }

    const envKey = provider.envKey ?? `${provider.id.toUpperCase()}_API_KEY`;
    const apiKey = process.env[envKey] ?? secretStore.get(envKey);

    if (!apiKey) {
      return {
        valid: false,
        providerId,
        error: 'API key not configured',
      };
    }

    return this.validateApiKey(providerId, apiKey);
  }
}

export const providerService = new ProviderService();
