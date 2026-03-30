import { ErrorCategory, RecoveryStrategy, type ClassificationResult } from './types.js';

export interface ErrorClassifierConfig {
  patterns?: {
    network?: RegExp;
    rateLimit?: RegExp;
    validation?: RegExp;
    auth?: RegExp;
  };
}

export class ErrorClassifier {
  private readonly patterns: {
    network: RegExp;
    rateLimit: RegExp;
    validation: RegExp;
    auth: RegExp;
  };

  constructor(config?: ErrorClassifierConfig) {
    this.patterns = {
      network: config?.patterns?.network ?? /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/i,
      rateLimit: config?.patterns?.rateLimit ?? /rate limit|too many requests|429/i,
      validation: config?.patterns?.validation ?? /invalid|validation|schema|required/i,
      auth: config?.patterns?.auth ?? /unauthorized|forbidden|401|403/i,
    };
  }

  classify(error: Error): ClassificationResult {
    const message = error.message;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (error as any).status ?? (error as any).statusCode;

    if (status !== undefined) {
      return this.classifyByStatus(status);
    }

    if (this.patterns.network.test(message)) {
      return {
        category: ErrorCategory.RETRYABLE,
        recoveryStrategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 3,
        baseDelayMs: 1000,
        maxTotalDelayMs: 15000,
      };
    }

    if (this.patterns.rateLimit.test(message)) {
      return {
        category: ErrorCategory.TRANSIENT,
        recoveryStrategy: RecoveryStrategy.WAIT_AND_RETRY,
        maxRetries: 5,
        baseDelayMs: 5000,
        maxTotalDelayMs: 30000,
      };
    }

    if (this.patterns.validation.test(message)) {
      return {
        category: ErrorCategory.PERMANENT,
        recoveryStrategy: RecoveryStrategy.NONE,
        maxRetries: 0,
        baseDelayMs: 0,
      };
    }

    if (this.patterns.auth.test(message)) {
      return {
        category: ErrorCategory.PERMANENT,
        recoveryStrategy: RecoveryStrategy.NONE,
        maxRetries: 0,
        baseDelayMs: 0,
      };
    }

    return {
      category: ErrorCategory.UNKNOWN,
      recoveryStrategy: RecoveryStrategy.NONE,
      maxRetries: 0,
      baseDelayMs: 0,
    };
  }

  private classifyByStatus(status: number): ClassificationResult {
    if (status === 429) {
      return {
        category: ErrorCategory.TRANSIENT,
        recoveryStrategy: RecoveryStrategy.WAIT_AND_RETRY,
        maxRetries: 5,
        baseDelayMs: 5000,
        maxTotalDelayMs: 30000,
      };
    }

    if (status === 401 || status === 403) {
      return {
        category: ErrorCategory.PERMANENT,
        recoveryStrategy: RecoveryStrategy.NONE,
        maxRetries: 0,
        baseDelayMs: 0,
      };
    }

    if (status >= 500) {
      return {
        category: ErrorCategory.RETRYABLE,
        recoveryStrategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 3,
        baseDelayMs: 1000,
        maxTotalDelayMs: 15000,
      };
    }

    if (status >= 400) {
      return {
        category: ErrorCategory.PERMANENT,
        recoveryStrategy: RecoveryStrategy.NONE,
        maxRetries: 0,
        baseDelayMs: 0,
      };
    }

    return {
      category: ErrorCategory.UNKNOWN,
      recoveryStrategy: RecoveryStrategy.NONE,
      maxRetries: 0,
      baseDelayMs: 0,
    };
  }
}
