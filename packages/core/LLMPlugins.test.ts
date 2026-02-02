import { describe, it, expect } from 'bun:test';

describe('LLM Plugins - Basic Functionality', () => {
  describe('Anthropic Plugin', () => {
    it('should have correct provider name and id', async () => {
      const plugin = new (await import('./src/llm/plugins/anthropic.js')).AnthropicPlugin({}, 'ANTHROPIC_API_KEY');
      
      expect(plugin.name).toBe('Anthropic');
      expect(plugin.id).toBe('anthropic');
    });
    
    it('should return correct models', async () => {
      const plugin = new (await import('./src/llm/plugins/anthropic.js')).AnthropicPlugin({}, 'ANTHROPIC_API_KEY');
      const models = plugin.getModels();

      expect(models.length).toBeGreaterThan(0);
      expect(models[0].id).toBe('claude-opus-4-5-20251101');
    });

    it('should calculate cost correctly', async () => {
      const plugin = new (await import('./src/llm/plugins/anthropic.js')).AnthropicPlugin({}, 'ANTHROPIC_API_KEY');
      const cost = plugin.calculateCost('claude-opus-4-5-20251101', 1000, 500);

      expect(cost).toBeGreaterThan(0);
    });
    
    it('should calculate cost correctly', async () => {
      const plugin = new (await import('./src/llm/plugins/anthropic.js')).AnthropicPlugin({}, 'ANTHROPIC_API_KEY');
      const cost = plugin.calculateCost('claude-opus-4-5-20251101', 1000, 500);

      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });
  });

  describe('OpenAI Plugin', () => {
    it('should have correct provider name and id', async () => {
      const plugin = new (await import('./src/llm/plugins/openai.js')).OpenAIPlugin({}, 'OPENAI_API_KEY');
      
      expect(plugin.name).toBe('OpenAI');
      expect(plugin.id).toBe('openai');
    });
    
    it('should return correct models', async () => {
      const plugin = new (await import('./src/llm/plugins/openai.js')).OpenAIPlugin({}, 'OPENAI_API_KEY');
      const models = plugin.getModels();

      expect(models.length).toBeGreaterThan(0);
      expect(models[0].id).toBe('gpt-4-turbo');
    });
  });

  describe('Google Plugin', () => {
    it('should have correct provider name and id', async () => {
      const plugin = new (await import('./src/llm/plugins/google.js')).GooglePlugin({}, 'GOOGLE_API_KEY');
      
      expect(plugin.name).toBe('Google');
      expect(plugin.id).toBe('google');
    });
    
    it('should return correct models', async () => {
      const plugin = new (await import('./src/llm/plugins/google.js')).GooglePlugin({}, 'GOOGLE_API_KEY');
      const models = plugin.getModels();
      
      expect(models.length).toBeGreaterThan(0);
      expect(models[0].id).toBe('gemini-1.5-pro-latest');
    });
  });
});
