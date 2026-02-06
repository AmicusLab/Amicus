/**
 * Chat and conversation types for LLM integration
 */

/**
 * Message role in a conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * A single message in a conversation
 */
export interface Message {
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
}

/**
 * Configuration for chat completion
 */
export interface ChatConfig {
  /** Model identifier (provider:model format, e.g., 'anthropic:claude-3-5-sonnet') */
  model?: string;
  /** System prompt override */
  systemPrompt?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for sampling (0-1) */
  temperature?: number;
  /** Top-p for nucleus sampling */
  topP?: number;
}

/**
 * Chat completion result
 */
export interface ChatResult {
  /** Generated response text */
  response: string;
  /** Token usage information */
  usage: {
    input: number;
    output: number;
    total: number;
  };
  /** Model used for generation */
  model: string;
  /** Provider used */
  provider: string;
}
