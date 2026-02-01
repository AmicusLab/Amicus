/**
 * Dashboard and UI types for Interface Layer (Phase 4)
 */

import type { Task, TaskStatus, Thought } from './core.js';

// ============================================================================
// System Health Types
// ============================================================================

/**
 * System health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * System resource usage
 */
export interface ResourceUsage {
  /** CPU usage percentage (0-100) */
  cpu: number;
  /** Memory usage in bytes */
  memoryUsed: number;
  /** Total memory in bytes */
  memoryTotal: number;
  /** Memory usage percentage (0-100) */
  memoryPercent: number;
}

/**
 * Daemon process status
 */
export interface DaemonStatus {
  /** Whether daemon is running */
  running: boolean;
  /** Process ID */
  pid?: number;
  /** Uptime in milliseconds */
  uptime: number;
  /** Start timestamp */
  startedAt: number;
  /** Last heartbeat timestamp */
  lastHeartbeat: number;
}

/**
 * Overall system health information
 */
export interface SystemHealth {
  /** Overall health status */
  status: HealthStatus;
  /** Daemon process status */
  daemon: DaemonStatus;
  /** System resource usage */
  resources: ResourceUsage;
  /** Connected services status */
  services: Record<string, {
    name: string;
    status: HealthStatus;
    latency?: number;
    error?: string;
  }>;
  /** Timestamp of this health check */
  timestamp: number;
}

// ============================================================================
// Tokenomics Types (LLM Usage Tracking)
// ============================================================================

/**
 * Token usage for a single LLM call
 */
export interface TokenUsage {
  /** Input/prompt tokens */
  input: number;
  /** Output/completion tokens */
  output: number;
  /** Total tokens */
  total: number;
}

/**
 * Cost calculation for LLM usage
 */
export interface TokenCost {
  /** Cost in USD */
  usd: number;
  /** Cost per 1K input tokens */
  inputRate: number;
  /** Cost per 1K output tokens */
  outputRate: number;
}

/**
 * LLM provider/model identifier
 */
export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'local';

/**
 * Usage statistics for a specific model
 */
export interface ModelUsageStats {
  /** Model identifier (e.g., 'claude-3-5-sonnet', 'gpt-4') */
  model: string;
  /** Provider */
  provider: LLMProvider;
  /** Total token usage */
  tokens: TokenUsage;
  /** Estimated cost */
  cost: TokenCost;
  /** Number of API calls */
  callCount: number;
  /** Average latency in milliseconds */
  avgLatency: number;
  /** Error count */
  errorCount: number;
}

/**
 * Aggregated tokenomics data for dashboard
 */
export interface Tokenomics {
  /** Usage by model */
  byModel: ModelUsageStats[];
  /** Total tokens across all models */
  totalTokens: TokenUsage;
  /** Total cost across all models */
  totalCost: TokenCost;
  /** Time period start */
  periodStart: number;
  /** Time period end */
  periodEnd: number;
  /** Budget limit (if set) */
  budgetLimit?: number;
  /** Budget used percentage */
  budgetUsedPercent?: number;
}

// ============================================================================
// Agent/Orchestrator Types
// ============================================================================

/**
 * Sub-agent status
 */
export type AgentState = 'idle' | 'working' | 'paused' | 'error' | 'terminated';

/**
 * Sub-agent information for orchestrator monitor
 */
export interface SubAgentInfo {
  /** Unique agent ID */
  id: string;
  /** Agent name/type */
  name: string;
  /** Current state */
  state: AgentState;
  /** Current task (if working) */
  currentTask?: {
    id: string;
    description: string;
    progress: number;
    startedAt: number;
  };
  /** Last activity timestamp */
  lastActivity: number;
  /** Error message (if in error state) */
  error?: string;
  /** Resource usage */
  resources?: ResourceUsage;
}

/**
 * Orchestrator status
 */
export interface OrchestratorStatus {
  /** Whether orchestrator is active */
  active: boolean;
  /** List of sub-agents */
  agents: SubAgentInfo[];
  /** Queue of pending tasks */
  pendingTasks: number;
  /** Running tasks count */
  runningTasks: number;
  /** Completed tasks count (in current session) */
  completedTasks: number;
  /** Failed tasks count (in current session) */
  failedTasks: number;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

/**
 * WebSocket message types
 */
export type WSMessageType =
  | 'connect'
  | 'disconnect'
  | 'heartbeat'
  | 'task:started'
  | 'task:progress'
  | 'task:completed'
  | 'task:failed'
  | 'task:paused'
  | 'task:resumed'
  | 'task:cancelled'
  | 'thought:new'
  | 'agent:stateChange'
  | 'system:healthUpdate'
  | 'tokenomics:update'
  | 'error';

/**
 * Base WebSocket message
 */
export interface WSMessage<T = unknown> {
  /** Message type */
  type: WSMessageType;
  /** Message payload */
  payload: T;
  /** Timestamp */
  timestamp: number;
  /** Optional correlation ID for request-response */
  correlationId?: string;
}

/**
 * Task event payload
 */
export interface TaskEventPayload {
  task: Task;
  status: TaskStatus;
  progress?: number;
  error?: string;
}

/**
 * Thought stream payload
 */
export interface ThoughtPayload {
  thought: Thought;
  agentId?: string;
}

/**
 * Agent state change payload
 */
export interface AgentStateChangePayload {
  agent: SubAgentInfo;
  previousState: AgentState;
  newState: AgentState;
}

// ============================================================================
// Control Center Types
// ============================================================================

/**
 * Configuration categories
 */
export type ConfigCategory = 
  | 'llm'
  | 'routing'
  | 'notifications'
  | 'appearance';

/**
 * Configuration item
 */
export interface ConfigItem {
  /** Config key */
  key: string;
  /** Display label */
  label: string;
  /** Current value */
  value: unknown;
  /** Value type */
  type: 'string' | 'number' | 'boolean' | 'select' | 'json';
  /** Available options for select type */
  options?: Array<{ label: string; value: unknown }>;
  /** Description */
  description?: string;
  /** Whether this requires restart */
  requiresRestart?: boolean;
  /** Validation rules */
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * Configuration section
 */
export interface ConfigSection {
  /** Category */
  category: ConfigCategory;
  /** Display title */
  title: string;
  /** Description */
  description?: string;
  /** Config items */
  items: ConfigItem[];
}

/**
 * Approval request for human-in-the-loop
 */
export interface ApprovalRequest {
  /** Unique request ID */
  id: string;
  /** Task that requires approval */
  taskId: string;
  /** Action type */
  actionType: 'file_delete' | 'external_api' | 'cost_threshold' | 'dangerous_operation';
  /** Description of what needs approval */
  description: string;
  /** Details about the action */
  details: Record<string, unknown>;
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** When request was created */
  createdAt: number;
  /** Timeout for auto-reject (optional) */
  timeout?: number;
  /** Current status */
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

// ============================================================================
// Provider and Server Status Types
// ============================================================================

/**
 * LLM provider status for dashboard display
 */
export interface LLMProviderStatus {
  /** Provider identifier (e.g., 'anthropic', 'openai') */
  id: string;
  /** Display name */
  name: string;
  /** Whether provider is enabled in config */
  enabled: boolean;
  /** Whether provider is available (has API key and loaded) */
  available: boolean;
  /** Number of models available */
  modelCount: number;
  /** Error message if provider failed to load */
  error?: string;
}

/**
 * MCP server status for dashboard display
 */
export interface MCPServerStatus {
  /** Server identifier (e.g., 'filesystem', 'github') */
  id: string;
  /** Display name */
  name: string;
  /** Whether server is enabled in config */
  enabled: boolean;
  /** Whether server is currently connected */
  connected: boolean;
  /** Number of tools provided by this server */
  toolCount: number;
  /** Error message if server failed to connect */
  error?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = unknown> {
  /** Whether request succeeded */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Response metadata */
  meta?: {
    requestId: string;
    timestamp: number;
    duration: number;
  };
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
