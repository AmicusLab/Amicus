/**
 * Chat and conversation types for LLM integration
 */

/**
 * Message role in a conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * A single message in a conversation
 */
export interface Message {
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Tool call ID (required when role is 'tool', undefined otherwise) */
  toolCallId?: string;
}

/**
 * Tool definition for function calling (MCP-compatible format)
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input parameter schema (JSON Schema) */
  parameters: Record<string, unknown>;
}

/**
 * Tool call request from LLM
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  toolCallId: string;
  /** Tool name to call */
  tool: string;
  /** Tool arguments */
  args: Record<string, unknown>;
}

/**
 * Chat response - either text or tool call request
 */
export type ChatResponse =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolCall: ToolCall };

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
  /** Available tools for function calling */
  tools?: ToolDefinition[];
}

/**
 * Chat completion result
 */
export interface ChatResult {
  /** Generated response (text or tool call) */
  response: ChatResponse;
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
