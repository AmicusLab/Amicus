/**
 * Core domain types for task management and decision making
 */

/**
 * Task status enumeration
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Task metadata
 */
export interface TaskMetadata {
  /** Parent task ID if this is a subtask */
  parentId?: string;
  /** Related task IDs */
  relatedIds?: string[];
  /** Custom task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Core task representation
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  /** Task description and requirements */
  description: string;
  /** Current task status */
  status: TaskStatus;
  /** Task priority */
  priority: TaskPriority;
  /** Metadata for the task */
  metadata?: TaskMetadata;
  /** Task creation timestamp */
  createdAt: number;
  /** Task last update timestamp */
  updatedAt: number;
  /** Assigned agent or worker ID */
  assignedTo?: string;
  /** Completion percentage (0-100) */
  progress?: number;
  /** Tool name to use for execution */
  tool?: string;
  /** Parameters for tool execution */
  parameters?: Record<string, unknown>;
}

/**
 * Thought content for reasoning
 */
export interface Thought {
  /** Thought content or reasoning */
  content: string;
  /** Thought timestamp */
  timestamp: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Thought category */
  category?: 'analysis' | 'decision' | 'evaluation' | 'planning';
  /** Related task ID if applicable */
  relatedTaskId?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent action type
 */
export enum AgentActionType {
  /** Information retrieval action */
  QUERY = 'query',
  /** Execution action */
  EXECUTE = 'execute',
  /** Decision action */
  DECIDE = 'decide',
  /** Memory action */
  MEMORY = 'memory',
  /** Communication action */
  COMMUNICATE = 'communicate',
  /** Tool execution */
  TOOL = 'tool',
  /** Custom action */
  CUSTOM = 'custom',
}

/**
 * Agent action metadata
 */
export interface AgentAction {
  /** Action type */
  type: AgentActionType;
  /** Tool or resource name */
  tool: string;
  /** Action parameters */
  parameters?: Record<string, unknown>;
  /** Action result if available */
  result?: unknown;
  /** Action timestamp */
  timestamp: number;
  /** Related thought or decision ID */
  relatedId?: string;
  /** Action status */
  status?: 'pending' | 'completed' | 'failed';
  /** Error if failed */
  error?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Decision options
 */
export interface DecisionOption {
  /** Option ID */
  id: string;
  /** Option description */
  description: string;
  /** Option score or confidence */
  score?: number;
  /** Reasoning for this option */
  reasoning?: string;
}

/**
 * Decision representation
 */
export interface Decision {
  /** Decision ID */
  id: string;
  /** Task this decision applies to */
  taskId: string;
  /** Decision type */
  type: 'selection' | 'assignment' | 'validation' | 'custom';
  /** Selected option or result */
  selection?: string | unknown;
  /** Decision reasoning */
  reasoning: string;
  /** Available options considered */
  options: DecisionOption[];
  /** Timestamp */
  timestamp: number;
  /** Approval status */
  approved?: boolean;
  /** Approval metadata */
  approvalMetadata?: {
    approvedBy?: string;
    approvedAt?: number;
    comments?: string;
  };
}

/**
 * Task execution context
 */
export interface TaskContext {
  /** Available tools */
  tools?: string[];
  /** Available memory sections */
  memorySections?: string[];
  /** Current context state */
  state?: Record<string, unknown>;
}

/**
 * Agent task result
 */
export interface TaskResult {
  /** Task ID */
  taskId: string;
  /** Execution status */
  success: boolean;
  /** Result data if successful */
  data?: unknown;
  /** Error if failed */
  error?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Execution duration in milliseconds */
  duration?: number;
}
