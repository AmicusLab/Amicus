import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ModelValidator } from '../ModelValidator.js';

describe('ModelValidator', () => {
  let validator: ModelValidator;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    validator = new ModelValidator();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('validateModel', () => {
    it('should return valid=true with tokenCount when API returns 200', async () => {
      const mockResponse = {
        status: 200,
        json: mock(() => Promise.resolve({
          usage: {
            prompt_tokens: 10,
            total_tokens: 10,
          },
        })),
      } as unknown as Response;

      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as unknown as typeof fetch;

      const result = await validator.validateModel('glm-4.7', 'test-api-key');

      expect(result.valid).toBe(true);
      expect(result.tokenCount).toBe(10);
      expect(result.error).toBeUndefined();
    });

    it('should return valid=true without tokenCount when usage is missing', async () => {
      const mockResponse = {
        status: 200,
        json: mock(() => Promise.resolve({})),
      } as unknown as Response;

      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as unknown as typeof fetch;

      const result = await validator.validateModel('glm-4.7', 'test-api-key');

      expect(result.valid).toBe(true);
      expect(result.tokenCount).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should use total_tokens when prompt_tokens is missing', async () => {
      const mockResponse = {
        status: 200,
        json: mock(() => Promise.resolve({
          usage: {
            total_tokens: 25,
          },
        })),
      } as unknown as Response;

      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as unknown as typeof fetch;

      const result = await validator.validateModel('glm-4.7', 'test-api-key');

      expect(result.valid).toBe(true);
      expect(result.tokenCount).toBe(25);
    });

    it('should return valid=false with error when API returns 401', async () => {
      const mockResponse = {
        status: 401,
        text: mock(() => Promise.resolve('Unauthorized')),
      } as unknown as Response;

      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as unknown as typeof fetch;

      const result = await validator.validateModel('glm-4.7', 'invalid-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
      expect(result.tokenCount).toBeUndefined();
    });

    it('should return valid=false with error message when API returns other error status', async () => {
      const mockResponse = {
        status: 500,
        text: mock(() => Promise.resolve('Internal Server Error')),
      } as unknown as Response;

      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as unknown as typeof fetch;

      const result = await validator.validateModel('glm-4.7', 'test-api-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('API request failed: Internal Server Error');
    });

    it('should return valid=false with error when fetch throws', async () => {
      globalThis.fetch = mock(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch;

      const result = await validator.validateModel('glm-4.7', 'test-api-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Connection error: Network error');
    });

    it('should call the correct API endpoint with proper headers', async () => {
      const mockFetch = mock(() => Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ usage: { prompt_tokens: 5 } }),
      } as Response));

      globalThis.fetch = mockFetch as unknown as typeof fetch;

      await validator.validateModel('glm-4.7', 'test-api-key');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0];
      const url = call[0] as string;
      const options = call[1] as RequestInit;
      
      expect(url).toBe('https://api.z.ai/api/paas/v4/tokenizer');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Authorization': 'Bearer test-api-key',
        'Content-Type': 'application/json',
      });
      
      const body = JSON.parse(options.body as string);
      expect(body.model).toBe('glm-4.7');
      expect(body.messages).toEqual([{ role: 'user', content: 'test' }]);
    });
  });

  describe('validateAllModels', () => {
    it('should validate all models for zai provider', async () => {
      const mockResponse = {
        status: 200,
        json: mock(() => Promise.resolve({
          usage: { prompt_tokens: 10 },
        })),
      } as unknown as Response;

      globalThis.fetch = mock(() => Promise.resolve(mockResponse)) as unknown as typeof fetch;

      const result = await validator.validateAllModels('zai', 'test-api-key');

      expect(result.provider).toBe('zai');
      expect(result.results.length).toBe(6);
      expect(result.validCount).toBe(6);
      expect(result.invalidCount).toBe(0);
      
      const modelIds = result.results.map(r => r.modelId);
      expect(modelIds).toContain('glm-4.7');
      expect(modelIds).toContain('glm-4.5');
      expect(modelIds).toContain('glm-4.1');
      expect(modelIds).toContain('glm-4');
      expect(modelIds).toContain('glm-4v');
      expect(modelIds).toContain('glm-3-turbo');
    });

    it('should count valid and invalid models correctly', async () => {
      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        const status = callCount <= 3 ? 200 : 401;
        return Promise.resolve({
          status,
          json: () => Promise.resolve({ usage: { prompt_tokens: 10 } }),
          text: () => Promise.resolve('Unauthorized'),
        } as Response);
      }) as unknown as typeof fetch;

      const result = await validator.validateAllModels('zai', 'test-api-key');

      expect(result.validCount).toBe(3);
      expect(result.invalidCount).toBe(3);
    });

    it('should return empty results for unknown provider', async () => {
      globalThis.fetch = mock(() => Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ usage: { prompt_tokens: 10 } }),
      } as Response)) as unknown as typeof fetch;

      const result = await validator.validateAllModels('unknown', 'test-api-key');

      expect(result.provider).toBe('unknown');
      expect(result.results).toEqual([]);
      expect(result.validCount).toBe(0);
      expect(result.invalidCount).toBe(0);
    });
  });
});
