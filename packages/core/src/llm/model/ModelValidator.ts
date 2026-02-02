export interface ValidationResult {
  valid: boolean;
  tokenCount?: number | undefined;
  error?: string | undefined;
  details?: {
    statusCode?: number;
    message?: string;
  };
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

interface ChatCompletionResponse {
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
}

export class ModelValidator {
  async validateModel(modelId: string, apiKey: string, providerId?: 'zai' | 'zai-coding-plan', baseURL?: string): Promise<ValidationResult> {
    if (!baseURL) {
      return {
        valid: false,
        error: 'baseURL is required for model validation',
      };
    }

    console.log(`[ModelValidator] Using base URL: ${baseURL} for provider: ${providerId}`);
    
    try {
      const apiBaseURL = baseURL;
      const response = await fetch(`${apiBaseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
      });

      if (response.status === 200) {
        const data = await response.json() as ChatCompletionResponse;
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
        const errorData = await response.json().catch(() => null) as {
          error?: {
            message?: string;
            code?: string;
          };
        };

        let detailedError = `API request failed`;
        if (errorData?.error?.code === '1113') {
          detailedError = 'Insufficient balance - please check your account';
        } else if (errorData?.error?.code === '1305') {
          detailedError = 'Rate limit exceeded - please try again later';
        }

        return {
          valid: false,
          error: detailedError,
          details: {
            statusCode: response.status,
            message: errorData?.error?.message || detailedError,
          },
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Connection error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async validateAllModels(provider: string, apiKey: string, baseURL?: string): Promise<ProviderValidationResult> {
    const models = this.getModelsForProvider(provider);
    
    const results: ModelValidationResult[] = [];
    
    for (const modelId of models) {
      const validation = await this.validateModel(modelId, apiKey, provider as 'zai' | 'zai-coding-plan', baseURL);
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
    if (provider === 'zai' || provider === 'zai-coding-plan') {
      return [
        'glm-4.7',
        'glm-4.7-flash',
        'glm-4.7-flashx',
        'glm-4.6',
        'glm-4.5',
        'glm-4.5-x',
        'glm-4.5-air',
        'glm-4.5-airx',
        'glm-4.5-flash',
        'glm-4-32b-0414-128k',
        'glm-4.6v',
        'glm-4.6v-flash',
        'glm-4.6v-flashx',
        'glm-4.5v',
        'autoglm-phone-multilingual',
      ];
    }

    return [];
  }
}

export default ModelValidator;
