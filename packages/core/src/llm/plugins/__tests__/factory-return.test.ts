/**
 * Factory Return Test for LLM Provider Plugins
 *
 * Verifies that all provider plugins return factory functions, not model instances.
 * This is critical for dynamic model selection in the routing system.
 */

import { AnthropicPlugin } from '../anthropic.js';
import { OpenAIPlugin } from '../openai.js';
import { GroqPlugin } from '../groq.js';

describe('Provider Factory Return Tests', () => {
  beforeEach(() => {
    // Clear any existing environment variables for test isolation
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
  });

  describe('AnthropicPlugin', () => {
    it('should return provider factory, not model instance', () => {
      const plugin = new AnthropicPlugin({}, 'TEST_API_KEY');
      process.env.TEST_API_KEY = 'test-key';
      const provider = plugin.createProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
      expect(typeof provider).toBe('function');
      delete process.env.TEST_API_KEY;
    });

    it('should throw error when no API key provided', () => {
      const plugin = new AnthropicPlugin({}, 'TEST_API_KEY');
      expect(() => plugin.createProvider({})).toThrow('Anthropic API key not found');
    });
  });

  describe('OpenAIPlugin', () => {
    it('should return provider factory, not model instance', () => {
      const plugin = new OpenAIPlugin({}, 'TEST_API_KEY');
      process.env.TEST_API_KEY = 'test-key';
      const provider = plugin.createProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
      expect(typeof provider).toBe('function');
      delete process.env.TEST_API_KEY;
    });

    it('should throw error when no API key provided', () => {
      const plugin = new OpenAIPlugin({}, 'TEST_API_KEY');
      expect(() => plugin.createProvider({})).toThrow('OpenAI API key not found');
    });
  });

  describe('GroqPlugin', () => {
    it('should return provider factory, not model instance', () => {
      const plugin = new GroqPlugin({}, 'TEST_API_KEY');
      process.env.TEST_API_KEY = 'test-key';
      const provider = plugin.createProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
      expect(typeof provider).toBe('function');
      delete process.env.TEST_API_KEY;
    });

    it('should throw error when no API key provided', () => {
      const plugin = new GroqPlugin({}, 'TEST_API_KEY');
      expect(() => plugin.createProvider({})).toThrow('Groq API key not found');
    });
  });
});
