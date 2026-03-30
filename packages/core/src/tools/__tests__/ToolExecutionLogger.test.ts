import { describe, it, expect, beforeEach } from 'bun:test';
import { ToolExecutionLogger } from '../ToolExecutionLogger.js';

describe('ToolExecutionLogger', () => {
  let logger: ToolExecutionLogger;

  beforeEach(() => {
    logger = new ToolExecutionLogger({ logLevel: 'DEBUG' });
  });

  describe('로그 기록', () => {
    it('logStart가 start 타입 엔트리를 추가한다', () => {
      logger.logStart('myTool', { foo: 'bar' });
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('start');
      expect(entries[0].toolName).toBe('myTool');
      expect(entries[0].level).toBe('DEBUG');
    });

    it('logResult가 result 타입 엔트리를 추가한다', () => {
      logger.logResult('myTool', 'output', 150);
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('result');
      expect(entries[0].duration).toBe(150);
    });

    it('logError가 error 타입 엔트리를 추가한다', () => {
      const error = new Error('something failed');
      logger.logError('myTool', error, 100);
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('error');
      expect(entries[0].error).toBe('something failed');
      expect(entries[0].level).toBe('ERROR');
    });

    it('logRetry가 retry 타입 엔트리를 추가한다', () => {
      const error = new Error('retry needed');
      logger.logRetry('myTool', 1, error);
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('retry');
      expect(entries[0].attempt).toBe(1);
      expect(entries[0].level).toBe('WARN');
    });
  });

  describe('민감정보 마스킹', () => {
    it('password 키를 마스킹한다', () => {
      logger.logStart('authTool', { password: 'secret123' });
      const entries = logger.getEntries();

      expect(entries[0].args?.password).toBe('***REDACTED***');
    });

    it('token 키를 마스킹한다', () => {
      logger.logStart('apiTool', { token: 'abc123xyz' });
      const entries = logger.getEntries();

      expect(entries[0].args?.token).toBe('***REDACTED***');
    });

    it('apiKey 키를 마스킹한다', () => {
      logger.logStart('apiTool', { apiKey: 'sk-12345' });
      const entries = logger.getEntries();

      expect(entries[0].args?.apiKey).toBe('***REDACTED***');
    });

    it('secret 키를 마스킹한다', () => {
      logger.logStart('apiTool', { secret: 'topsecret' });
      const entries = logger.getEntries();

      expect(entries[0].args?.secret).toBe('***REDACTED***');
    });

    it('민감하지 않은 키는 그대로 유지한다', () => {
      logger.logStart('myTool', { username: 'alice', count: 5 });
      const entries = logger.getEntries();

      expect(entries[0].args?.username).toBe('alice');
      expect(entries[0].args?.count).toBe(5);
    });

    it('URL 쿼리 파라미터의 token을 마스킹한다', () => {
      logger.logStart('httpTool', { url: 'https://api.example.com?token=abc123&page=1' });
      const entries = logger.getEntries();

      expect(entries[0].args?.url).toContain('***REDACTED***');
      expect(entries[0].args?.url).not.toContain('abc123');
    });

    it('Bearer 토큰을 마스킹한다', () => {
      logger.logStart('httpTool', { header: 'Bearer eyJhbGciOiJSUzI1NiJ9.token' });
      const entries = logger.getEntries();

      expect(entries[0].args?.header).toContain('***REDACTED***');
      expect(entries[0].args?.header).not.toContain('eyJhbGciOiJSUzI1NiJ9');
    });

    it('access_token 키를 마스킹한다', () => {
      logger.logStart('authTool', { access_token: 'oauth-token' });
      const entries = logger.getEntries();

      expect(entries[0].args?.access_token).toBe('***REDACTED***');
    });
  });

  describe('로그 레벨 필터링', () => {
    it('INFO 레벨에서는 DEBUG 로그(logStart)를 기록하지 않는다', () => {
      const infoLogger = new ToolExecutionLogger({ logLevel: 'INFO' });
      infoLogger.logStart('myTool', { foo: 'bar' });

      expect(infoLogger.getEntries()).toHaveLength(0);
    });

    it('INFO 레벨에서 logResult, logError, logRetry는 기록된다', () => {
      const infoLogger = new ToolExecutionLogger({ logLevel: 'INFO' });
      infoLogger.logResult('myTool', 'output', 100);
      infoLogger.logError('myTool', new Error('err'), 50);
      infoLogger.logRetry('myTool', 1, new Error('retry'));

      expect(infoLogger.getEntries()).toHaveLength(3);
    });

    it('INFO 레벨에서 logResult는 result 데이터를 포함하지 않는다', () => {
      const infoLogger = new ToolExecutionLogger({ logLevel: 'INFO' });
      infoLogger.logResult('myTool', 'sensitive-output', 100);

      const entries = infoLogger.getEntries();
      expect(entries[0].result).toBeUndefined();
    });

    it('DEBUG 레벨에서 logResult는 result 데이터를 포함한다', () => {
      logger.logResult('myTool', 'output-data', 100);

      const entries = logger.getEntries();
      expect(entries[0].result).toBe('output-data');
    });
  });

  describe('최대 엔트리 제한', () => {
    it('maxEntries 초과 시 오래된 항목이 제거된다', () => {
      const smallLogger = new ToolExecutionLogger({ maxEntries: 3, logLevel: 'DEBUG' });

      smallLogger.logResult('tool', 'r1', 10);
      smallLogger.logResult('tool', 'r2', 10);
      smallLogger.logResult('tool', 'r3', 10);
      smallLogger.logResult('tool', 'r4', 10); // r1이 제거되어야 함

      const entries = smallLogger.getEntries();
      expect(entries).toHaveLength(3);
      // r2, r3, r4가 남아야 함 (r1은 제거)
    });

    it('기본 maxEntries는 1000이다', () => {
      const defaultLogger = new ToolExecutionLogger();
      for (let i = 0; i < 1005; i++) {
        defaultLogger.logResult('tool', `r${i}`, 1);
      }
      expect(defaultLogger.getEntries()).toHaveLength(1000);
    });
  });

  describe('summarize', () => {
    it('totalCalls, successes, failures, retries를 집계한다', () => {
      const debugLogger = new ToolExecutionLogger({ logLevel: 'DEBUG' });
      debugLogger.logStart('tool', {});
      debugLogger.logStart('tool', {});
      debugLogger.logResult('tool', 'ok', 10);
      debugLogger.logError('tool', new Error('fail'), 20);
      debugLogger.logRetry('tool', 1, new Error('retry'));

      const summary = debugLogger.summarize();
      expect(summary.totalCalls).toBe(2);
      expect(summary.successes).toBe(1);
      expect(summary.failures).toBe(1);
      expect(summary.retries).toBe(1);
    });
  });

  describe('clear', () => {
    it('clear 후 엔트리가 비워진다', () => {
      logger.logResult('tool', 'output', 100);
      expect(logger.getEntries()).toHaveLength(1);

      logger.clear();
      expect(logger.getEntries()).toHaveLength(0);
    });
  });

  describe('getEntries 불변성', () => {
    it('getEntries는 내부 배열의 복사본을 반환한다', () => {
      logger.logResult('tool', 'output', 100);
      const entries = logger.getEntries();
      entries.push({ timestamp: 0, level: 'INFO', type: 'result', toolName: 'fake' });

      expect(logger.getEntries()).toHaveLength(1);
    });
  });
});
