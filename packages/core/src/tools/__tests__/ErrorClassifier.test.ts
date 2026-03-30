import { describe, it, expect } from 'bun:test';
import { ErrorClassifier } from '../ErrorClassifier.js';
import { ErrorCategory, RecoveryStrategy } from '../types.js';

describe('ErrorClassifier', () => {
  const classifier = new ErrorClassifier();

  describe('네트워크 에러 분류', () => {
    it('ECONNREFUSED 에러를 RETRYABLE + EXPONENTIAL_BACKOFF으로 분류한다', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:3000');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.RETRYABLE);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF);
      expect(result.maxRetries).toBe(3);
      expect(result.baseDelayMs).toBe(1000);
      expect(result.maxTotalDelayMs).toBe(15000);
    });

    it('ENOTFOUND 에러를 RETRYABLE로 분류한다', () => {
      const error = new Error('getaddrinfo ENOTFOUND example.com');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.RETRYABLE);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF);
    });

    it('ETIMEDOUT 에러를 RETRYABLE로 분류한다', () => {
      const error = new Error('ETIMEDOUT');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.RETRYABLE);
    });

    it('ECONNRESET 에러를 RETRYABLE로 분류한다', () => {
      const error = new Error('read ECONNRESET');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.RETRYABLE);
    });
  });

  describe('Rate limit 에러 분류', () => {
    it('"rate limit" 메시지를 TRANSIENT + WAIT_AND_RETRY로 분류한다', () => {
      const error = new Error('rate limit exceeded');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.TRANSIENT);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.WAIT_AND_RETRY);
      expect(result.maxRetries).toBe(5);
      expect(result.baseDelayMs).toBe(5000);
      expect(result.maxTotalDelayMs).toBe(30000);
    });

    it('"too many requests" 메시지를 TRANSIENT로 분류한다', () => {
      const error = new Error('too many requests');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.TRANSIENT);
    });
  });

  describe('Validation 에러 분류', () => {
    it('"invalid" 메시지를 PERMANENT + NONE으로 분류한다', () => {
      const error = new Error('invalid input provided');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.PERMANENT);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.NONE);
      expect(result.maxRetries).toBe(0);
    });

    it('"validation" 메시지를 PERMANENT로 분류한다', () => {
      const error = new Error('validation failed');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.PERMANENT);
    });
  });

  describe('Auth 에러 분류', () => {
    it('"unauthorized" 메시지를 PERMANENT로 분류한다', () => {
      const error = new Error('unauthorized access');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.PERMANENT);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.NONE);
    });

    it('"forbidden" 메시지를 PERMANENT로 분류한다', () => {
      const error = new Error('forbidden');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.PERMANENT);
    });
  });

  describe('Unknown 에러 분류', () => {
    it('알 수 없는 에러를 UNKNOWN + NONE으로 분류한다', () => {
      const error = new Error('something went wrong');
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.NONE);
      expect(result.maxRetries).toBe(0);
      expect(result.baseDelayMs).toBe(0);
    });
  });

  describe('HTTP 상태 코드 기반 분류', () => {
    it('status 429를 TRANSIENT + WAIT_AND_RETRY로 분류한다', () => {
      const error = Object.assign(new Error('Too Many Requests'), { status: 429 });
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.TRANSIENT);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.WAIT_AND_RETRY);
    });

    it('status 401을 PERMANENT로 분류한다', () => {
      const error = Object.assign(new Error('Unauthorized'), { status: 401 });
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.PERMANENT);
    });

    it('status 403을 PERMANENT로 분류한다', () => {
      const error = Object.assign(new Error('Forbidden'), { status: 403 });
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.PERMANENT);
    });

    it('status 500을 RETRYABLE + EXPONENTIAL_BACKOFF으로 분류한다', () => {
      const error = Object.assign(new Error('Internal Server Error'), { status: 500 });
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.RETRYABLE);
      expect(result.recoveryStrategy).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF);
    });

    it('status 503을 RETRYABLE로 분류한다', () => {
      const error = Object.assign(new Error('Service Unavailable'), { status: 503 });
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.RETRYABLE);
    });

    it('status 400을 PERMANENT로 분류한다', () => {
      const error = Object.assign(new Error('Bad Request'), { status: 400 });
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.PERMANENT);
    });

    it('statusCode 필드도 인식한다', () => {
      const error = Object.assign(new Error('Internal Error'), { statusCode: 503 });
      const result = classifier.classify(error);

      expect(result.category).toBe(ErrorCategory.RETRYABLE);
    });
  });

  describe('DI 패턴 - 커스텀 패턴 주입', () => {
    it('커스텀 네트워크 패턴을 주입할 수 있다', () => {
      const customClassifier = new ErrorClassifier({
        patterns: { network: /CUSTOM_NET_ERROR/i },
      });
      const error = new Error('CUSTOM_NET_ERROR occurred');
      const result = customClassifier.classify(error);

      expect(result.category).toBe(ErrorCategory.RETRYABLE);
    });

    it('커스텀 rateLimit 패턴을 주입할 수 있다', () => {
      const customClassifier = new ErrorClassifier({
        patterns: { rateLimit: /THROTTLED/i },
      });
      const error = new Error('Request THROTTLED');
      const result = customClassifier.classify(error);

      expect(result.category).toBe(ErrorCategory.TRANSIENT);
    });
  });
});
