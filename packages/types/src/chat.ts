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
  tool_call_id?: string;
  /** Tool name (when role is 'tool', identifies which tool was called) */
  tool_name?: string;
  /** Tool calls made by the assistant (when role is 'assistant' and tools were called) */
  tool_calls?: ToolCall[];
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
  input_schema: Record<string, unknown>;
}

/**
 * Tool call request from LLM
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** Tool name to call */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
}

/**
 * Chat response - either text or tool call request
 */
export type ChatResponse =
  | { type: 'text'; content: string }
  | { type: 'tool_calls'; tool_calls: ToolCall[]; content?: string };

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
  /** 
   * 민감 정보 마스킹 비활성화 (서버 환경 변수로만 제어 권장)
   * @deprecated 클라이언트에서 설정하지 마세요. 백엔드에서만 제어해야 합니다.
   */
  disableMasking?: boolean;
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

/**
 * Streaming chunk types for SSE streaming chat
 */
export type StreamChunk =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_call_start'; toolName: string; toolCallId: string }
  | { type: 'tool_call_result'; toolCallId: string; content: string }
  | { type: 'usage'; input: number; output: number; total: number }
  | { type: 'done' }
  | { type: 'error'; message: string };
