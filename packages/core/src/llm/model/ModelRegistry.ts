import type { ModelMetadata, ModelAvailability } from '@amicus/types/model';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Model Registry
 *
 * Manages model metadata and availability information from JSON configuration files.
 * Loads models from config/models/{provider}.json and provides selection logic
 * based on task complexity.
 */
export class ModelRegistry {
  private models = new Map<string, ModelMetadata>();
  private availability = new Map<string, ModelAvailability>();
  private modelsByProvider = new Map<string, ModelMetadata[]>();

  /**
   * Load models from configuration file for a specific provider
   * @param provider Provider identifier (e.g., 'zai', 'anthropic')
   */
  loadModels(provider: string): void {
    const configPath = resolve(process.cwd(), 'config/models', `${provider}.json`);
    
    try {
      const content = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content) as {
        provider: string;
        lastUpdated: number;
        models: Array<{
          id: string;
          name: string;
          description: string;
          provider: string;
          contextWindow: number;
          maxOutputTokens: number;
          inputCostPer1M: number;
          outputCostPer1M: number;
          capabilities: string[];
          complexityRange: { min: number; max: number };
        }>;
      };

      // Clear existing models for this provider
      const existing = this.modelsByProvider.get(provider) ?? [];
      for (const model of existing) {
        this.models.delete(model.id);
        this.availability.delete(model.id);
      }

      // Load new models
      const providerModels: ModelMetadata[] = [];
      for (const modelData of config.models) {
        const model: ModelMetadata = {
          id: modelData.id,
          name: modelData.name,
          description: modelData.description,
          provider: modelData.provider,
          contextWindow: modelData.contextWindow,
          maxOutputTokens: modelData.maxOutputTokens,
          inputCostPer1M: modelData.inputCostPer1M,
          outputCostPer1M: modelData.outputCostPer1M,
          capabilities: modelData.capabilities as ModelMetadata['capabilities'],
          complexityRange: modelData.complexityRange,
        };

        this.models.set(model.id, model);
        providerModels.push(model);

        // Initialize availability as healthy by default
        this.availability.set(model.id, {
          id: model.id,
          healthy: true,
          lastChecked: Date.now(),
        });
      }

      this.modelsByProvider.set(provider, providerModels);
    } catch (error) {
      console.warn(`Failed to load models for provider ${provider}:`, error);
      this.modelsByProvider.set(provider, []);
    }
  }

  /**
   * Get a specific model by its ID
   * @param id Model identifier
   * @returns ModelMetadata or undefined if not found
   */
  getModel(id: string): ModelMetadata | undefined {
    return this.models.get(id);
  }

  /**
   * Get all models for a specific provider
   * @param provider Provider identifier
   * @returns Array of ModelMetadata
   */
  getModelsByProvider(provider: string): ModelMetadata[] {
    return this.modelsByProvider.get(provider) ?? [];
  }

  /**
   * Select the optimal model based on task complexity
   * @param complexity Complexity score (0-100)
   * @param provider Optional provider to filter by
   * @returns Selected ModelMetadata or undefined if no suitable model found
   */
  selectOptimalModel(complexity: number, provider?: string): ModelMetadata | undefined {
    let candidates: ModelMetadata[];

    if (provider) {
      candidates = this.getModelsByProvider(provider);
    } else {
      candidates = Array.from(this.models.values());
    }

    if (candidates.length === 0) {
      return undefined;
    }

    // Filter by complexity range
    const suitableModels = candidates.filter(
      (m) => complexity >= m.complexityRange.min && complexity <= m.complexityRange.max
    );

    if (suitableModels.length > 0) {
      // Select cheapest model from suitable ones
      return suitableModels.reduce((best, current) => {
        const bestTotalCost = best.inputCostPer1M + best.outputCostPer1M;
        const currentTotalCost = current.inputCostPer1M + current.outputCostPer1M;
        return currentTotalCost < bestTotalCost ? current : best;
      });
    }

    // If no model matches complexity range, pick closest by midpoint
    return candidates.reduce((closest, current) => {
      const closestMid = (closest.complexityRange.min + closest.complexityRange.max) / 2;
      const currentMid = (current.complexityRange.min + current.complexityRange.max) / 2;
      return Math.abs(currentMid - complexity) < Math.abs(closestMid - complexity)
        ? current
        : closest;
    });
  }

  /**
   * Get availability status for a specific model
   * @param id Model identifier
   * @returns ModelAvailability or undefined if model not found
   */
  getModelAvailability(id: string): ModelAvailability | undefined {
    return this.availability.get(id);
  }

  /**
   * Update availability status for a model
   * @param id Model identifier
   * @param healthy Health status
   */
  updateAvailability(id: string, healthy: boolean): void {
    const existing = this.availability.get(id);
    if (existing) {
      existing.healthy = healthy;
      existing.lastChecked = Date.now();
    }
  }

  /**
   * Get all loaded models
   * @returns Array of all ModelMetadata
   */
  getAllModels(): ModelMetadata[] {
    return Array.from(this.models.values());
  }

  /**
   * Clear all loaded models
   */
  clear(): void {
    this.models.clear();
    this.availability.clear();
    this.modelsByProvider.clear();
  }
}
