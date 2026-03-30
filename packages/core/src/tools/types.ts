import { z, type ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface Tool<T = unknown> {
  name: string;
  description: string;
  schema: ZodType<T>;
  execute: (args: T) => Promise<string>;
}

export enum ErrorCategory {
  RETRYABLE = 'RETRYABLE',
  TRANSIENT = 'TRANSIENT',
  PERMANENT = 'PERMANENT',
  UNKNOWN = 'UNKNOWN',
}

export enum RecoveryStrategy {
  NONE = 'NONE',
  IMMEDIATE_RETRY = 'IMMEDIATE_RETRY',
  WAIT_AND_RETRY = 'WAIT_AND_RETRY',
  EXPONENTIAL_BACKOFF = 'EXPONENTIAL_BACKOFF',
  FALLBACK = 'FALLBACK',
}

export interface ClassificationResult {
  category: ErrorCategory;
  recoveryStrategy: RecoveryStrategy;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  maxTotalDelayMs?: number;
}

export interface RetryConfig {
  strategy: RecoveryStrategy;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  maxTotalDelayMs?: number;
}

export interface ExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: ClassificationResult & { message: string };
  attempts: number;
  partialFailure?: Array<{ item: unknown; error: string }>;
  totalDurationMs: number;
}

export interface ExecutionSummary {
  totalCalls: number;
  successes: number;
  failures: number;
  retries: number;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): Array<{
    name: string;
    description: string;
    input_schema: unknown;
  }> {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input_schema: zodToJsonSchema(tool.schema as any, { 
        name: `${tool.name}_input`,
        $refStrategy: 'none' 
      })
    }));
  }
}
