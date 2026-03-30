import { ErrorCategory, RecoveryStrategy, type ClassificationResult, type ExecutionResult, type RetryConfig } from './types.js';
import { ErrorClassifier } from './ErrorClassifier.js';
import { RetryPolicy } from './RetryPolicy.js';
import { ToolExecutionLogger, type LogLevel } from './ToolExecutionLogger.js';
import type { ToolRegistry, Tool } from './types.js';

export interface EngineConfig {
  toolRegistry: ToolRegistry;
  errorClassifier?: ErrorClassifier;
  logger?: ToolExecutionLogger;
  maxExecutionTimeMs?: number;
}

export class ToolExecutionEngine {
  private readonly errorClassifier: ErrorClassifier;
  private readonly logger: ToolExecutionLogger;
  private readonly maxExecutionTimeMs: number;
  private readonly maxIterations = 100;

  constructor(private readonly config: EngineConfig) {
    this.errorClassifier = config.errorClassifier ?? new ErrorClassifier();
    this.logger = config.logger ?? new ToolExecutionLogger();
    this.maxExecutionTimeMs = config.maxExecutionTimeMs ?? 30000;
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    safetyExecutor?: { executeSafe: <T>(name: string, fn: () => Promise<T>) => Promise<T> }
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Edge case: args null/undefined
    const safeArgs = args ?? {};

    // Tool lookup
    const tool = this.config.toolRegistry.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: {
          category: ErrorCategory.PERMANENT,
          recoveryStrategy: RecoveryStrategy.NONE,
          maxRetries: 0,
          baseDelayMs: 0,
          message: `Unknown tool: ${toolName}`,
        },
        attempts: 0,
        totalDurationMs: Date.now() - startTime,
      };
    }

    let attempt = 0;
    let policy: RetryPolicy | null = null;

    while (attempt < this.maxIterations) {
      // Global timeout check
      const elapsed = Date.now() - startTime;
      if (elapsed >= this.maxExecutionTimeMs) {
        return {
          success: false,
          error: {
            category: ErrorCategory.TRANSIENT,
            recoveryStrategy: RecoveryStrategy.NONE,
            maxRetries: 0,
            baseDelayMs: 0,
            message: 'Execution timeout',
          },
          attempts: attempt,
          totalDurationMs: elapsed,
        };
      }

      const callStartTime = Date.now();
      this.logger.logStart(toolName, safeArgs);

      try {
        // Validate args with Zod schema
        const validatedArgs = tool.schema.parse(safeArgs);

        // Execute tool (with or without safety executor)
        let rawResult: string;
        if (safetyExecutor) {
          rawResult = await safetyExecutor.executeSafe(toolName, () => tool.execute(validatedArgs));
        } else {
          rawResult = await tool.execute(validatedArgs);
        }

        const duration = Date.now() - callStartTime;
        this.logger.logResult(toolName, rawResult, duration);

        // Attempt to interpret the raw string result as structured data for partial success handling
        let structuredResult: unknown = rawResult;
        try {
          const parsed = JSON.parse(rawResult);
          structuredResult = parsed;
        } catch {
          // If parsing fails, leave structuredResult as the original string
        }

        // Check for partial success based on the structured result (if any)
        if (this.isPartialSuccess(structuredResult)) {
          return this.handlePartialSuccess(
            structuredResult as Record<string, unknown>,
            attempt + 1,
            Date.now() - startTime
          );
        }

        return {
          success: true,
          data: rawResult,
          attempts: attempt + 1,
          totalDurationMs: Date.now() - startTime,
        };
      } catch (error: unknown) {
        const duration = Date.now() - callStartTime;
        const err = error instanceof Error ? error : new Error(String(error));
        const classification = this.errorClassifier.classify(err);
        this.logger.logError(toolName, err, duration);

        // Non-recoverable error
        if (classification.recoveryStrategy === RecoveryStrategy.NONE) {
          return {
            success: false,
            error: { ...classification, message: err.message },
            attempts: attempt + 1,
            totalDurationMs: Date.now() - startTime,
          };
        }

        // Build retry policy from the current classification so strategy/maxRetries stay in sync
        const retryConfig: RetryConfig = {
          strategy: classification.recoveryStrategy,
          maxRetries: classification.maxRetries,
          baseDelayMs: classification.baseDelayMs,
          ...(classification.maxDelayMs !== undefined && { maxDelayMs: classification.maxDelayMs }),
          ...(classification.maxTotalDelayMs !== undefined && { maxTotalDelayMs: classification.maxTotalDelayMs }),
        };
        policy = new RetryPolicy(retryConfig);

        const delay = policy.getDelay(attempt);

        // Check if we should retry
        if (!policy.shouldRetry(attempt, delay)) {
          return {
            success: false,
            error: { ...classification, message: err.message },
            attempts: attempt + 1,
            totalDurationMs: Date.now() - startTime,
          };
        }

        this.logger.logRetry(toolName, attempt + 1, err);
        await this.sleep(delay);
        policy.recordDelay(delay);
        attempt++;
      }
    }

    // Safety limit reached
    return {
      success: false,
      error: {
        category: ErrorCategory.UNKNOWN,
        recoveryStrategy: RecoveryStrategy.NONE,
        maxRetries: 0,
        baseDelayMs: 0,
        message: 'Max iterations reached',
      },
      attempts: attempt,
      totalDurationMs: Date.now() - startTime,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isPartialSuccess(result: unknown): boolean {
    return (
      typeof result === 'object' &&
      result !== null &&
      'partialFailure' in result
    );
  }

  private handlePartialSuccess(
    result: Record<string, unknown>,
    attempts: number,
    totalDurationMs: number
  ): ExecutionResult {
    return {
      success: true,
      data: (result.data as string) ?? String(result),
      partialFailure: result.partialFailure as Array<{ item: unknown; error: string }>,
      attempts,
      totalDurationMs,
    };
  }

  getLogger(): ToolExecutionLogger {
    return this.logger;
  }
}
