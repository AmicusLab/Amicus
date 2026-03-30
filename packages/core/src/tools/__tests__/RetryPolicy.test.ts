import { describe, it, expect, beforeEach } from 'bun:test';
import { RetryPolicy } from '../RetryPolicy.js';
import { RecoveryStrategy, type RetryConfig } from '../types.js';

describe('RetryPolicy', () => {
  describe('EXPONENTIAL_BACKOFF 전략', () => {
    let policy: RetryPolicy;

    beforeEach(() => {
      const config: RetryConfig = {
        strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 8000,
        maxTotalDelayMs: 15000,
      };
      policy = new RetryPolicy(config);
    });

    it('attempt 0에서 baseDelay * 2^0 = 1000을 반환한다', () => {
      expect(policy.getDelay(0)).toBe(1000);
    });

    it('attempt 1에서 baseDelay * 2^1 = 2000을 반환한다', () => {
      expect(policy.getDelay(1)).toBe(2000);
    });

    it('attempt 2에서 baseDelay * 2^2 = 4000을 반환한다', () => {
      expect(policy.getDelay(2)).toBe(4000);
    });

    it('maxDelayMs를 초과하지 않는다', () => {
      expect(policy.getDelay(3)).toBe(8000);
      expect(policy.getDelay(10)).toBe(8000);
    });

    it('maxRetries 이하 attempt에서 shouldRetry가 true를 반환한다', () => {
      expect(policy.shouldRetry(0)).toBe(true);
      expect(policy.shouldRetry(2)).toBe(true);
    });

    it('maxRetries에 도달하면 shouldRetry가 false를 반환한다', () => {
      expect(policy.shouldRetry(3)).toBe(false);
      expect(policy.shouldRetry(4)).toBe(false);
    });
  });

  describe('WAIT_AND_RETRY 전략', () => {
    let policy: RetryPolicy;

    beforeEach(() => {
      const config: RetryConfig = {
        strategy: RecoveryStrategy.WAIT_AND_RETRY,
        maxRetries: 5,
        baseDelayMs: 5000,
        maxTotalDelayMs: 30000,
      };
      policy = new RetryPolicy(config);
    });

    it('모든 attempt에서 baseDelayMs를 반환한다', () => {
      expect(policy.getDelay(0)).toBe(5000);
      expect(policy.getDelay(3)).toBe(5000);
    });

    it('totalElapsedMs가 maxTotalDelayMs를 초과하면 shouldRetry가 false를 반환한다', () => {
      policy.recordDelay(5000);
      policy.recordDelay(5000);
      policy.recordDelay(5000);
      policy.recordDelay(5000);
      policy.recordDelay(5000);
      // totalElapsedMs = 25000, additionalDelay = 5000 => 30000 = maxTotalDelayMs
      // 30000 > 30000 is false, so shouldRetry는 true
      expect(policy.shouldRetry(5, 5000)).toBe(false); // attempt >= maxRetries
    });

    it('totalElapsedMs + additionalDelay가 maxTotalDelayMs 초과 시 shouldRetry가 false', () => {
      policy.recordDelay(5000);
      policy.recordDelay(5000);
      policy.recordDelay(5000);
      policy.recordDelay(5000);
      policy.recordDelay(5000);
      policy.recordDelay(5000);
      // totalElapsedMs = 30000, additionalDelay = 5000 => 35000 > 30000
      expect(policy.shouldRetry(0, 5000)).toBe(false);
    });
  });

  describe('NONE 전략', () => {
    it('NONE 전략은 delay 0을 반환한다', () => {
      const policy = new RetryPolicy({
        strategy: RecoveryStrategy.NONE,
        maxRetries: 0,
        baseDelayMs: 0,
      });
      expect(policy.getDelay(0)).toBe(0);
    });
  });

  describe('상태 추적', () => {
    it('recordDelay로 totalElapsedMs가 누적된다', () => {
      const policy = new RetryPolicy({
        strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 5,
        baseDelayMs: 1000,
        maxTotalDelayMs: 10000,
      });

      expect(policy.getTotalElapsedMs()).toBe(0);
      policy.recordDelay(1000);
      expect(policy.getTotalElapsedMs()).toBe(1000);
      policy.recordDelay(2000);
      expect(policy.getTotalElapsedMs()).toBe(3000);
    });

    it('maxTotalDelayMs 없이는 시간 제한 없이 shouldRetry가 true를 반환한다', () => {
      const policy = new RetryPolicy({
        strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        maxRetries: 10,
        baseDelayMs: 1000,
      });

      policy.recordDelay(999999);
      expect(policy.shouldRetry(0, 999999)).toBe(true);
    });
  });
});
