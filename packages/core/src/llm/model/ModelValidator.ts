export interface ValidationResult {
  valid: boolean;
  tokenCount?: number | undefined;
  error?: string | undefined;
}

export interface ModelValidationResult extends ValidationResult {
  modelId: string;
}

export interface ProviderValidationResult {
  provider: string;
  results: ModelValidationResult[];
  validCount: number;
  invalidCount: number;
}

interface TokenizerResponse {
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
}

export class ModelValidator {
  private readonly baseURL = 'https://api.z.ai/api/paas/v4';

  async validateModel(modelId: string, apiKey: string): Promise<ValidationResult> {
    try {
      const response = await fetch(`${this.baseURL}/tokenizer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      if (response.status === 200) {
        const data = await response.json() as TokenizerResponse;
        const tokenCount = data.usage?.prompt_tokens ?? data.usage?.total_tokens;

        if (tokenCount !== undefined) {
          return {
            valid: true,
            tokenCount: tokenCount,
          };
        }

        return {
          valid: true,
          tokenCount: undefined,
        };
      } else if (response.status === 401) {
        return {
          valid: false,
          error: 'Invalid API key',
        };
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          valid: false,
          error: `API request failed: ${errorText}`,
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Connection error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async validateAllModels(provider: string, apiKey: string): Promise<ProviderValidationResult> {
    const models = this.getModelsForProvider(provider);
    
    const results: ModelValidationResult[] = [];
    
    for (const modelId of models) {
      const validation = await this.validateModel(modelId, apiKey);
      results.push({
        modelId,
        ...validation,
      });
    }

    const validCount = results.filter(r => r.valid).length;
    const invalidCount = results.length - validCount;

    return {
      provider,
      results,
      validCount,
      invalidCount,
    };
  }

  private getModelsForProvider(provider: string): string[] {
    if (provider === 'zai') {
      return [
        'glm-4.7',
        'glm-4.5',
        'glm-4.1',
        'glm-4',
        'glm-4v',
        'glm-3-turbo',
      ];
    }

    return [];
  }
}

export default ModelValidator;
