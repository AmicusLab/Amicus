import { ProviderRegistry, llmProviderConfig, type ProviderConfigEntry } from '@amicus/core';
import type { LLMProviderStatus } from '@amicus/types/dashboard';

class ProviderService {
  private registry: ProviderRegistry;
  private initialized = false;

  constructor() {
    this.registry = new ProviderRegistry();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.registry.loadFromConfig(llmProviderConfig);
      console.log(`[ProviderService] Loaded ${this.registry.getLoadedProviders().length} provider(s)`);
      this.initialized = true;
    } catch (error) {
      console.error('[ProviderService] Failed to initialize:', error);
    }
  }

  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  getProviderStatuses(): LLMProviderStatus[] {
    const config = llmProviderConfig;
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
}

export const providerService = new ProviderService();
