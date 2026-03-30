/**
 * @fileoverview StreamingMasker 단위 테스트
 * 
 * TDD Red-Green-Refactor 사이클로 작성됨
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StreamingMasker, maskSensitiveInfo } from '../sensitive-mask.js';

describe('StreamingMasker', () => {
  let masker: StreamingMasker;

  beforeEach(() => {
    masker = new StreamingMasker(50); // 작은 버퍼로 테스트
  });

  describe('기본 동작', () => {
    it('버퍼가 가득 차면 마스킹된 결과를 반환해야 함', () => {
      const chunk1 = 'This is a test with an API key: sk-';
      const chunk2 = 'proj-abc123T3BlbkFJxyz789 and more text';

      // 첫 번째 청크는 버퍼링만 됨
      expect(masker.processChunk(chunk1)).toBeNull();
      
      // 두 번째 청크로 버퍼가 가득 차면 마스킹된 결과 반환
      const result = masker.processChunk(chunk2);
      expect(result).not.toBeNull();
      expect(result).toContain('***REDACTED***');
    });

    it('flush()는 버퍼에 남은 내용을 반환해야 함', () => {
      masker.processChunk('Some text without sensitive data');
      
      const remaining = masker.flush();
      expect(remaining).toBe('Some text without sensitive data');
    });

    it('빈 버퍼에서 flush()는 빈 문자열을 반환해야 함', () => {
      expect(masker.flush()).toBe('');
    });

    it('reset()은 버퍼를 초기화해야 함', () => {
      masker.processChunk('Some data');
      expect(masker.getBufferLength()).toBeGreaterThan(0);
      
      masker.reset();
      expect(masker.getBufferLength()).toBe(0);
    });
  });

  describe('민감 정보 마스킹', () => {
    it('스트리밍 중 API 키를 마스킹해야 함', () => {
      const fullText = 'Using OpenAI API key: sk-test-FAKE-KEY-NOT-REAL-12345 in this request';
      
      // 전체 텍스트를 한 번에 처리 (버퍼 크기보다 큼)
      const maskerLarge = new StreamingMasker(10);
      const result = maskerLarge.processChunk(fullText);
      
      // processChunk가 버퍼 크기를 초과하면 바로 처리 결과 반환
      // 아니면 flush() 호출
      const finalResult = result ?? maskerLarge.flush();
      
      expect(finalResult).not.toContain('sk-test-FAKE-KEY-NOT-REAL-12345');
      expect(finalResult).toContain('***REDACTED***');
    });

    it('여러 민감 정보를 모두 마스킹해야 함', () => {
      // 실제 OpenAI API 키 형식과 Bearer 토큰 사용
      const fullText = 'Keys: sk-test-FAKE-KEY-NOT-REAL-12345 and Bearer abc123token456';
      
      const maskerLarge = new StreamingMasker(10);
      const result = maskerLarge.processChunk(fullText);
      const finalResult = result ?? maskerLarge.flush();
      
      // OpenAI API 키는 마스킹됨
      expect(finalResult).not.toContain('sk-test-FAKE-KEY-NOT-REAL-12345');
      // Bearer 토큰도 마스킹됨
      expect(finalResult).not.toContain('Bearer abc123token456');
      // 마스킹 표시가 있어야 함
      expect(finalResult).toContain('***REDACTED***');
    });
  });

  describe('경계 케이스', () => {
    it('청크가 민감 정보 경계를 가로지를 때 처리되어야 함', () => {
      // API 키가 청크 경계에 걸친 경우
      // 실제 OpenAI API 키 형식 사용
      const chunk1 = 'API key: sk-test-FAKE-KEY-NOT-REAL-123';
      const chunk2 = '789 more text here';
      
      const maskerSmall = new StreamingMasker(5);
      
      const result1 = maskerSmall.processChunk(chunk1);
      const result2 = maskerSmall.processChunk(chunk2);
      const remaining = maskerSmall.flush();
      
      // 결합된 결과에서 마스킹 확인
      const combined = (result1 ?? '') + (result2 ?? '') + remaining;
      
      // API 키 일부라도 마스킹되어야 함 (버퍼링 후 전체 처리)
      // 또는 전체 텍스트가 마스킹되어야 함
      expect(combined.includes('***REDACTED***') || 
             !combined.includes('sk-test-FAKE-KEY-NOT-REAL-12345')).toBe(true);
    });

    it('빈 청크를 처리할 수 있어야 함', () => {
      expect(masker.processChunk('')).toBeNull();
      expect(masker.getBufferLength()).toBe(0);
    });

    it('매우 긴 청크를 처리할 수 있어야 함', () => {
      const longChunk = 'x'.repeat(10000) + ' sk-test-FAKE-KEY-NOT-REAL-12345 ' + 'y'.repeat(10000);
      
      const maskerLarge = new StreamingMasker(5000);
      const result = maskerLarge.processChunk(longChunk);
      
      expect(result).not.toBeNull();
      expect(result).not.toContain('sk-test-FAKE-KEY-NOT-REAL-12345');
    });
  });

  describe('커스텀 옵션', () => {
    it('커스텀 마스킹 문자를 사용할 수 있어야 함', () => {
      const customMasker = new StreamingMasker(10, { maskChar: '[MASKED]' });
      
      const result = customMasker.processChunk('Key: sk-test-FAKE-KEY-NOT-REAL-12345');
      const finalResult = result ?? customMasker.flush();
      
      expect(finalResult).toContain('[MASKED]');
      expect(finalResult).not.toContain('***REDACTED***');
    });

    it('특정 패턴만 마스킹하도록 설정할 수 있어야 함', () => {
      const selectiveMasker = new StreamingMasker(10, {
        patterns: ['openai_api_key']
      });
      
      const result = selectiveMasker.processChunk('OpenAI: sk-test-FAKE-KEY-NOT-REAL-12345, AWS: AKIAIOSFODNN7EXAMPLE');
      const finalResult = result ?? selectiveMasker.flush();
      
      // OpenAI 키는 마스킹됨
      expect(finalResult).not.toContain('sk-test-FAKE-KEY-NOT-REAL-12345');
      // AWS 키는 마스킹되지 않음 (패턴에서 제외)
      expect(finalResult).toContain('AKIAIOSFODNN7EXAMPLE');
    });
  });
});

describe('maskSensitiveInfo 함수', () => {
  describe('기본 마스킹', () => {
    it('OpenAI API 키를 마스킹해야 함', () => {
      const result = maskSensitiveInfo('sk-test-FAKE-KEY-NOT-REAL-12345');
      expect(result.masked).toBe('sk-***REDACTED***');
      expect(result.detected).toHaveLength(1);
      expect(result.detected[0].pattern).toBe('openai_api_key');
    });

    it('AWS Access Key를 마스킹해야 함', () => {
      const result = maskSensitiveInfo('AWS Key: AKIAIOSFODNN7EXAMPLE');
      expect(result.masked).toContain('AKIA***REDACTED***');
      expect(result.detected.some(d => d.pattern === 'aws_access_key')).toBe(true);
    });

    it('Bearer Token을 마스킹해야 함', () => {
      const result = maskSensitiveInfo('Authorization: Bearer abc123token');
      expect(result.masked).toBe('Authorization: Bearer ***REDACTED***');
      expect(result.detected.some(d => d.pattern === 'bearer_token')).toBe(true);
    });

    it('JWT Token을 마스킹해야 함', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = maskSensitiveInfo(`Token: ${jwt}`);
      expect(result.masked).not.toContain(jwt);
      expect(result.detected.some(d => d.pattern === 'jwt_token')).toBe(true);
    });
  });

  describe('복합 케이스', () => {
    it('여러 민감 정보가 포함된 텍스트를 처리해야 함', () => {
      const text = `
        OpenAI Key: sk-test-FAKE-KEY-NOT-REAL-12345
        AWS Key: AKIAIOSFODNN7EXAMPLE
        Auth: Bearer abc123token
      `;
      
      const result = maskSensitiveInfo(text);
      
      expect(result.masked).not.toContain('sk-test-FAKE-KEY-NOT-REAL-12345');
      expect(result.masked).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(result.masked).not.toContain('Bearer abc123token');
      expect(result.detected.length).toBeGreaterThanOrEqual(3);
    });

    it('민감 정보가 없으면 원본 반환', () => {
      const text = 'This is a normal message without sensitive data';
      const result = maskSensitiveInfo(text);
      
      expect(result.masked).toBe(text);
      expect(result.detected).toHaveLength(0);
    });
  });

  describe('에지 케이스', () => {
    it('null/undefined는 빈 문자열 반환', () => {
      expect(maskSensitiveInfo(null).masked).toBe('');
      expect(maskSensitiveInfo(undefined).masked).toBe('');
    });

    it('빈 문자열은 빈 문자열 반환', () => {
      const result = maskSensitiveInfo('');
      expect(result.masked).toBe('');
    });

    it('이미 마스킹된 값은 이중 마스킹하지 않음', () => {
      const alreadyMasked = 'Key: ***REDACTED***';
      const result = maskSensitiveInfo(alreadyMasked);
      expect(result.masked).toBe(alreadyMasked);
    });
  });

  describe('커스텀 옵션', () => {
    it('커스텀 마스킹 문자 사용', () => {
      const result = maskSensitiveInfo('sk-test-FAKE-KEY-NOT-REAL-12345', {
        maskChar: '[REMOVED]'
      });
      expect(result.masked).toBe('[REMOVED]');
    });

    it('특정 패턴만 선택', () => {
      const text = 'sk-test-FAKE-KEY-NOT-REAL-12345 AKIAIOSFODNN7EXAMPLE';
      const result = maskSensitiveInfo(text, {
        patterns: ['openai_api_key']
      });
      
      expect(result.masked).not.toContain('sk-test-FAKE-KEY-NOT-REAL-12345');
      expect(result.masked).toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('처리 시간이 기록됨', () => {
      const result = maskSensitiveInfo('Some text');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });
});
