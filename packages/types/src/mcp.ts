/**
 * MCP (Model Context Protocol) types
 */

/**
 * MCP client options
 */
export interface MCPClientOptions {
  /** Client name */
  name: string;
  /** Client version */
  version: string;
  /** Transport configuration */
  transport: 'stdio' | 'http' | 'websocket';
  /** Connection configuration */
  config?: {
    url?: string;
    apiKey?: string;
    headers?: Record<string, string>;
  };
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Enable logging */
  logging?: boolean;
}

/**
 * Tool type for MCP
 */
export interface Tool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Tool input schema (JSON Schema) */
  inputSchema: Record<string, unknown>;
  /** Tool category */
  category?: string;
  /** Tool metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: string;
  /** Parameter description */
  description?: string;
  /** Whether parameter is required */
  required: boolean;
  /** Default value if not provided */
  default?: unknown;
  /** Parameter constraints */
  constraints?: {
    enum?: unknown[];
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

/**
 * Tool result structure
 */
export interface ToolResult {
  /** Result content */
  content: string | Record<string, unknown> | unknown[];
  /** Whether result is an error */
  isError?: boolean;
  /** Tool execution metadata */
  metadata?: {
    executionTime?: number;
    error?: string;
    warnings?: string[];
  };
  /** Timestamp of result */
  timestamp: number;
}

/**
 * MCP connection status
 */
export enum MCPStatus {
  /** Connection not established */
  DISCONNECTED = 'disconnected',
  /** Connecting */
  CONNECTING = 'connecting',
  /** Connection established */
  CONNECTED = 'connected',
  /** Connection lost */
  DISCONNECTED_ERROR = 'disconnected_error',
}

/**
 * MCP client event types
 */
export enum MCPEeventType {
  /** Client connected */
  CONNECTED = 'connected',
  /** Client disconnected */
  DISCONNECTED = 'disconnected',
  /** Tool executed */
  TOOL_EXECUTED = 'tool_executed',
  /** Tool error */
  TOOL_ERROR = 'tool_error',
  /** Message received */
  MESSAGE_RECEIVED = 'message_received',
  /** Configuration changed */
  CONFIGURATION_CHANGED = 'configuration_changed',
}

/**
 * MCP event
 */
export interface MCPEvent {
  /** Event type */
  type: MCPEeventType;
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data?: unknown;
  /** Client ID */
  clientId?: string;
}

/**
 * MCP message types
 */
export enum MCPMessageType {
  /** Request message */
  REQUEST = 'request',
  /** Response message */
  RESPONSE = 'response',
  /** Notification message */
  NOTIFICATION = 'notification',
}

/**
 * MCP message structure
 */
export interface MCPMessage {
  /** Message ID */
  id: string;
  /** Message type */
  type: MCPMessageType;
  /** Message name (e.g., tool_execute) */
  name: string;
  /** Message parameters */
  params?: Record<string, unknown>;
  /** Message timestamp */
  timestamp: number;
  /** Client metadata */
  metadata?: Record<string, unknown>;
}

/**
 * MCP server information
 */
export interface MCPServerInfo {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Server capabilities */
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  /** Server documentation URL */
  documentationUrl?: string;
}
