import { RecoveryStrategy, type RetryConfig } from './types.js';

export class RetryPolicy {
  private totalElapsedMs = 0;

  constructor(private readonly config: RetryConfig) {}

  getDelay(attempt: number): number {
    const { strategy, baseDelayMs, maxDelayMs } = this.config;

    if (strategy === RecoveryStrategy.EXPONENTIAL_BACKOFF) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      return Math.min(delay, maxDelayMs ?? Infinity);
    }

    if (strategy === RecoveryStrategy.WAIT_AND_RETRY) {
      return baseDelayMs;
    }

    return 0;
  }

  shouldRetry(attempt: number, additionalDelayMs: number = 0): boolean {
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    if (this.config.maxTotalDelayMs !== undefined) {
      if (this.totalElapsedMs + additionalDelayMs > this.config.maxTotalDelayMs) {
        return false;
      }
    }

    return true;
  }

  recordDelay(delayMs: number): void {
    this.totalElapsedMs += delayMs;
  }

  getTotalElapsedMs(): number {
    return this.totalElapsedMs;
  }
}
