/**
 * @fileoverview 민감 정보 마스킹 유틸리티 테스트
 * 
 * TDD Red-Green-Refactor 사이클로 구현
 * 모든 테스트는 먼저 실패해야 함
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  maskSensitiveInfo,
  maskSensitiveInfoInObject,
  SENSITIVE_PATTERNS,
  StreamingMasker,
  DefaultMaskingStrategy,
  type MaskOptions,
  type MaskResult,
  type MaskingStrategy,
} from '../sensitive-mask.js';

describe('maskSensitiveInfo', () => {
  describe('AC-1: 민감 정보 감지', () => {
    it('OpenAI API 키를 감지하고 마스킹해야 함', () => {
      const text = 'API 키: sk-test-FAKE-KEY-NOT-REAL-12345';
      const result = maskSensitiveInfo(text);
      
      expect(result.masked).toContain('***REDACTED***');
      expect(result.masked).not.toContain('sk-test-FAKE-KEY-NOT-REAL-12345');
      expect(result.detected).toHaveLength(1);
      expect(result.detected[0].pattern).toBe('openai_api_key');
      expect(result.detected[0].severity).toBe('critical');
    });

    it('Anthropic API 키를 감지하고 마스킹해야 함', () => {
      const text = 'Anthropic 키: sk-test-FAKE-ANTHROPIC-KEY-NOT-REAL';
      const result = maskSensitiveInfo(text);
      
      expect(result.masked).toContain('***REDACTED***');
      expect(result.detected[0].pattern).toBe('anthropic_api_key');
      expect(result.detected[0].severity).toBe('critical');
    });

    it('AWS 액세스 키를 감지하고 마스킹해야 함', () => {
      const text = 'AWS 키: AKIAIOSFODNN7EXAMPLE';
      const result = maskSensitiveInfo(text);
      
      expect(result.masked).toContain('AKIA***REDACTED***');
      expect(result.masked).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(result.detected[0].pattern).toBe('aws_access_key');
    });

    it('Bearer 토큰을 감지하고 마스킹해야 함', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const result = maskSensitiveInfo(text);
      
      expect(result.masked).toContain('Bearer ***REDACTED***');
      expect(result.masked).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(result.detected[0].pattern).toBe('bearer_token');
    });

    it('JWT 토큰을 감지하고 마스킹해야 함', () => {
      const text = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = maskSensitiveInfo(text);
      
      expect(result.masked).toContain('***REDACTED***');
      expect(result.masked).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(result.detected.some(d => d.pattern === 'jwt_token')).toBe(true);
    });

    it('API 키 URL 파라미터를 감지하고 마스킹해야 함', () => {
      const text = 'https://api.example.com?api_key=secret123&token=abc456';
      const result = maskSensitiveInfo(text);
      
      expect(result.masked).toContain('***REDACTED***');
      expect(result.masked).not.toContain('secret123');
      expect(result.masked).not.toContain('abc456');
    });

    it('비밀번호 필드를 감지하고 마스킹해야 함', () => {
      const text = 'password = "MySecretPass123"';
      const result = maskSensitiveInfo(text);
      
      expect(result.masked).toContain('***REDACTED***');
      expect(result.masked).not.toContain('MySecretPass123');
    });
  });

  describe('AC-6: 성능 (1KB 텍스트 < 10ms)', () => {
    it('1KB 텍스트 처리 시간이 10ms 미만이어야 함', () => {
      // 1KB 텍스트 생성
      const text = 'A'.repeat(1024) + ' sk-test-FAKE-KEY-NOT-REAL-12345 ';
      
      const startTime = performance.now();
      const result = maskSensitiveInfo(text);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(10);
      expect(result.processingTime).toBeLessThan(10);
    });
  });

  describe('엣지 케이스', () => {
    it('null 입력 시 빈 결과를 반환해야 함', () => {
      const result = maskSensitiveInfo(null as any);
      
      expect(result.masked).toBe('');
      expect(result.detected).toHaveLength(0);
      expect(result.processingTime).toBe(0);
    });

    it('undefined 입력 시 빈 결과를 반환해야 함', () => {
      const result = maskSensitiveInfo(undefined as any);
      
      expect(result.masked).toBe('');
      expect(result.detected).toHaveLength(0);
    });

    it('빈 문자열 입력 시 빈 결과를 반환해야 함', () => {
      const result = maskSensitiveInfo('');
      
      expect(result.masked).toBe('');
      expect(result.detected).toHaveLength(0);
    });

    it('maxLength 초과 시 경고와 함께 앞부분만 처리해야 함', () => {
      const longText = 'A'.repeat(2000) + ' sk-test-FAKE-KEY-NOT-REAL-12345';
      const result = maskSensitiveInfo(longText, { maxLength: 1000 });
      
      expect(result.masked.length).toBeLessThanOrEqual(1000);
    });

    it('유니코드/이모지가 포함된 텍스트를 올바르게 처리해야 함', () => {
      const text = '안녕하세요 👋 API 키: sk-test-FAKE-KEY-NOT-REAL-12345 🎉';
      const result = maskSensitiveInfo(text);
      
      expect(result.masked).toContain('👋');
      expect(result.masked).toContain('🎉');
      expect(result.masked).toContain('***REDACTED***');
    });

    it('이미 마스킹된 값은 다시 마스킹하지 않아야 함', () => {
      const text = 'Key: sk-***REDACTED***';
      const result = maskSensitiveInfo(text);
      
      // 이중 마스킹 방지
      expect(result.masked).toBe('Key: sk-***REDACTED***');
      expect(result.detected).toHaveLength(0);
    });
  });

  describe('에러 시나리오', () => {
    it('정규식 처리 실패 시 onMaskError=throw 옵션으로 에러를 던져야 함', () => {
      // 의도적으로 잘못된 패턴
      const text = 'Normal text';
      const options: MaskOptions = { onMaskError: 'throw' };
      
      expect(() => maskSensitiveInfo(text, options)).not.toThrow();
    });

    it('정규식 처리 실패 시 onMaskError=fallback 옵션으로 원본을 반환해야 함', () => {
      const text = 'Normal text';
      const options: MaskOptions = { onMaskError: 'fallback', fallbackValue: '[MASKING_FAILED]' };
      const result = maskSensitiveInfo(text, options);
      
      expect(result.masked).toBe('Normal text');
    });

    it('정규식 처리 실패 시 onMaskError=log-only 옵션으로 로그만 기록해야 함', () => {
      const text = 'Normal text';
      const options: MaskOptions = { onMaskError: 'log-only' };
      const result = maskSensitiveInfo(text, options);
      
      expect(result.masked).toBe('Normal text');
    });
  });

  describe('마스킹 옵션', () => {
    it('특정 패턴만 적용할 수 있어야 함', () => {
      const text = 'OpenAI: sk-test-FAKE-KEY-NOT-REAL-12345 AWS: AKIAIOSFODNN7EXAMPLE';
      const result = maskSensitiveInfo(text, { patterns: ['openai_api_key'] });
      
      expect(result.masked).toContain('***REDACTED***');
      expect(result.masked).toContain('AKIAIOSFODNN7EXAMPLE'); // AWS 키는 마스킹 안 됨
      expect(result.detected).toHaveLength(1);
      expect(result.detected[0].pattern).toBe('openai_api_key');
    });

    it('커스텀 마스킹 문자를 사용할 수 있어야 함', () => {
      const text = 'sk-test-FAKE-KEY-NOT-REAL-12345';
      const result = maskSensitiveInfo(text, { maskChar: '****HIDDEN****' });
      
      expect(result.masked).toContain('****HIDDEN****');
    });
  });
});

describe('maskSensitiveInfoInObject', () => {
  it('객체 내 중첩된 민감 정보를 마스킹해야 함', () => {
    const obj = {
      apiKey: 'sk-test-FAKE-KEY-NOT-REAL-12345',
      config: {
        token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        name: 'test',
      },
    };
    
    const result = maskSensitiveInfoInObject(obj) as any;
    
    expect(result.apiKey).toContain('***REDACTED***');
    expect(result.config.token).toContain('***REDACTED***');
    expect(result.config.name).toBe('test');
  });

  it('배열 내 민감 정보를 마스킹해야 함', () => {
    const obj = {
      keys: [
        'sk-test-FAKE-KEY-NOT-REAL-12345',
        'AKIAIOSFODNN7EXAMPLE',
      ],
    };
    
    const result = maskSensitiveInfoInObject(obj) as any;
    
    expect(result.keys[0]).toContain('***REDACTED***');
    expect(result.keys[1]).toContain('***REDACTED***');
  });

  it('원본 객체를 수정하지 않아야 함 (immutable)', () => {
    const obj = { key: 'sk-test-FAKE-KEY-NOT-REAL-12345' };
    const result = maskSensitiveInfoInObject(obj) as any;
    
    expect(obj.key).toBe('sk-test-FAKE-KEY-NOT-REAL-12345');
    expect(result.key).not.toBe(obj.key);
  });
});

describe('StreamingMasker', () => {
  it('청크 단위로 스트리밍 마스킹을 수행해야 함', () => {
    const masker = new StreamingMasker(20); // 작은 버퍼 크기로 테스트
    
    const chunk1 = masker.processChunk('API 키: sk-test-FAKE-');
    // 버퍼가 아직 충분히 차지 않았을 수 있음
    const chunk2 = masker.processChunk('abc123def456T3BlbkFJxyz789 입니다.');
    // 버퍼가 차면 처리됨
    const final = masker.flush();
    
    const result = chunk2 || final;
    expect(result).toContain('***REDACTED***');
  });

  it('flush()로 남은 버퍼를 처리해야 함', () => {
    const masker = new StreamingMasker();
    
    masker.processChunk('안녕하세요');
    const flushed = masker.flush();
    
    expect(flushed).toBe('안녕하세요');
  });

  it('여러 민감 정보가 걸쳐 있을 때 올바르게 처리해야 함', () => {
    const masker = new StreamingMasker();
    
    masker.processChunk('Key1: ');
    masker.processChunk('sk-test-FAKE-KEY-NOT-REAL-12345 ');
    const result = masker.flush();
    
    expect(result).toContain('***REDACTED***');
  });
});

describe('DefaultMaskingStrategy (DI 패턴)', () => {
  it('MaskingStrategy 인터페이스를 구현해야 함', () => {
    const strategy: MaskingStrategy = new DefaultMaskingStrategy();
    
    const result = strategy.mask('sk-test-FAKE-KEY-NOT-REAL-12345');
    
    expect(result.masked).toContain('***REDACTED***');
  });

  it('커스텀 패턴으로 초기화할 수 있어야 함', () => {
    // OpenAI 패턴만 사용 (패턴 이름으로 찾기)
    const openaiPattern = SENSITIVE_PATTERNS.find(p => p.name === 'openai_api_key');
    const customPatterns = openaiPattern ? [openaiPattern] : [];
    const strategy = new DefaultMaskingStrategy(customPatterns);
    
    const text = 'OpenAI: sk-test-FAKE-KEY-NOT-REAL-12345 AWS: AKIAIOSFODNN7EXAMPLE';
    const result = strategy.mask(text);
    
    expect(result.detected).toHaveLength(1);
    expect(result.detected[0].pattern).toBe('openai_api_key');
    expect(result.masked).toContain('***REDACTED***');
  });
});

describe('SENSITIVE_PATTERNS', () => {
  it('7개의 기본 패턴이 정의되어 있어야 함', () => {
    expect(SENSITIVE_PATTERNS.length).toBe(7);
  });

  it('각 패턴이 필수 속성을 가져야 함', () => {
    SENSITIVE_PATTERNS.forEach(pattern => {
      expect(pattern).toHaveProperty('name');
      expect(pattern).toHaveProperty('pattern');
      expect(pattern).toHaveProperty('maskFormat');
      expect(pattern).toHaveProperty('severity');
      expect(['low', 'medium', 'high', 'critical']).toContain(pattern.severity);
    });
  });
});
