/**
 * @fileoverview 민감 정보 자동 마스킹 유틸리티
 * 
 * TDD Green 단계: 테스트를 통과하는 최소 구현
 * 
 * 기능:
 * - API 키, 토큰, 비밀번호 등 7개 민감 정보 패턴 감지
 * - 정규식 기반 자동 마스킹
 * - 스트리밍 마스킹 지원
 * - DI 패턴으로 확장 가능한 구조
 */

import type {
  SensitivePattern,
  MaskOptions,
  MaskResult,
  MaskingStrategy,
  DetectedSensitive,
  Severity,
} from '@amicus/types';

/**
 * 이미 마스킹된 값 감지 패턴
 */
const ALREADY_MASKED = /\*{3,}REDACTED\*{3,}/;

/**
 * 기본 민감 정보 패턴 목록
 * 
 * 각 패턴은 OWASP, NIST 보안 가이드라인을 기반으로 정의됨
 */
export const SENSITIVE_PATTERNS: SensitivePattern[] = [
  // Anthropic API Key (OpenAI보다 먼저 체크)
  {
    name: 'anthropic_api_key',
    pattern: /sk-ant-api[a-zA-Z0-9-]{80,}/g,
    maskFormat: () => 'sk-ant-***REDACTED***',
    severity: 'critical',
  },
  // OpenAI API Key (sk-ant 제외)
  {
    name: 'openai_api_key',
    pattern: /sk-(?!ant-)[a-zA-Z0-9-]{20,}/g,
    maskFormat: () => 'sk-***REDACTED***',
    severity: 'critical',
  },
  // AWS Access Key
  {
    name: 'aws_access_key',
    pattern: /AKIA[A-Z0-9]{16}/g,
    maskFormat: () => 'AKIA***REDACTED***',
    severity: 'critical',
  },
  // Bearer Token
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[a-zA-Z0-9._-]+/gi,
    maskFormat: () => 'Bearer ***REDACTED***',
    severity: 'critical',
  },
  // JWT Token
  {
    name: 'jwt_token',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    maskFormat: () => '***REDACTED***',
    severity: 'critical',
  },
  // API Key in URL parameters
  {
    name: 'api_key_param',
    pattern: /([?&](?:api_key|apikey|key|token)=)[^&\s]+/gi,
    maskFormat: (match) => match.replace(/=[^&\s]+/, '=***REDACTED***'),
    severity: 'high',
  },
  // Generic Secret Key (password, secret, token in assignments)
  {
    name: 'secret_key',
    pattern: /(?:(?:password|passwd|secret|token|api_key)\s*[=:]\s*)['""]?[^\s'""]{8,}/gi,
    maskFormat: (match) => match.replace(/['""]?[^\s'""]{8,}$/, '***REDACTED***'),
    severity: 'high',
  },
];

/**
 * 기본 마스킹 옵션
 */
const DEFAULT_OPTIONS: Required<Omit<MaskOptions, 'patterns' | 'fallbackValue' | 'timeout'>> = {
  maskChar: '***REDACTED***',
  logContext: false,
  maxLength: 100000, // 100KB
  onMaskError: 'log-only',
};

/**
 * 민감 정보 마스킹 수행
 * 
 * @param text - 마스킹할 텍스트
 * @param options - 마스킹 옵션
 * @returns 마스킹 결과
 * 
 * @example
 * ```ts
 * const result = maskSensitiveInfo('API 키: sk-test-FAKE-KEY-NOT-REAL-123');
 * console.log(result.masked); // "API 키: sk-***REDACTED***"
 * console.log(result.detected); // [{ pattern: 'openai_api_key', severity: 'critical', count: 1 }]
 * ```
 */
export function maskSensitiveInfo(text: string | null | undefined, options?: MaskOptions): MaskResult {
  const startTime = performance.now();
  
  // null/undefined/빈 문자열 처리
  if (text == null || text === '') {
    return {
      masked: '',
      detected: [],
      processingTime: 0,
    };
  }
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // 이미 마스킹된 값인지 확인 (이중 마스킹 방지)
  if (ALREADY_MASKED.test(text)) {
    return {
      masked: text,
      detected: [],
      processingTime: 0,
    };
  }
  
  // maxLength 처리
  let processedText = text;
  if (text.length > (opts.maxLength ?? 100000)) {
    processedText = text.substring(0, opts.maxLength);
    if (opts.logContext) {
      console.warn(`[Masking] Text exceeds maxLength (${opts.maxLength}), truncating`);
    }
  }
  
  try {
    // 사용할 패턴 선택
    const patterns = opts.patterns
      ? SENSITIVE_PATTERNS.filter(p => opts.patterns!.includes(p.name))
      : SENSITIVE_PATTERNS;
    
    // 감지된 민감 정보 수집
    const detectedMap = new Map<string, { severity: Severity; count: number }>();
    
    // 각 패턴 적용
    let maskedText = processedText;
    const customMaskChar = opts.maskChar;
    const useCustomMask = customMaskChar !== '***REDACTED***';
    
    for (const pattern of patterns) {
      // 정규식 lastIndex 리셋 (global 플래그)
      pattern.pattern.lastIndex = 0;
      
      const matches = processedText.match(pattern.pattern);
      
      if (matches && matches.length > 0) {
        // 마스킹 적용
        maskedText = maskedText.replace(pattern.pattern, (match) => {
          // 커스텀 마스킹 문자가 있으면 사용
          if (useCustomMask && customMaskChar) {
            return customMaskChar;
          }
          return pattern.maskFormat(match);
        });
        
        // 감지 정보 기록
        const existing = detectedMap.get(pattern.name);
        if (existing) {
          existing.count += matches.length;
        } else {
          detectedMap.set(pattern.name, {
            severity: pattern.severity,
            count: matches.length,
          });
        }
      }
      
      // 정규식 lastIndex 리셋
      pattern.pattern.lastIndex = 0;
    }
    
    const detected: DetectedSensitive[] = Array.from(detectedMap.entries()).map(
      ([patternName, data]) => ({
        pattern: patternName,
        severity: data.severity,
        count: data.count,
      })
    );
    
    const endTime = performance.now();
    
    return {
      masked: maskedText,
      detected,
      processingTime: endTime - startTime,
    };
  } catch (error) {
    // 에러 처리 전략에 따라 동작
    if (opts.onMaskError === 'throw') {
      throw error;
    }
    
    if (opts.onMaskError === 'fallback') {
      return {
        masked: opts.fallbackValue ?? text,
        detected: [],
        processingTime: performance.now() - startTime,
      };
    }
    
    // log-only: 로그 기록 후 원본 반환
    console.warn('[Masking] Error during masking:', error);
    
    return {
      masked: text,
      detected: [],
      processingTime: performance.now() - startTime,
    };
  }
}

/**
 * 객체 내 중첩된 민감 정보 마스킹
 * 
 * @param obj - 마스킹할 객체
 * @param options - 마스킹 옵션
 * @returns 마스킹된 객체 (새로운 객체, 원본 불변)
 * 
 * @example
 * ```ts
 * const obj = { apiKey: 'sk-test-FAKE-KEY-NOT-REAL-123' };
 * const masked = maskSensitiveInfoInObject(obj);
 * console.log(masked.apiKey); // "sk-***REDACTED***"
 * ```
 */
export function maskSensitiveInfoInObject(obj: unknown, options?: MaskOptions): unknown {
  if (obj == null) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return maskSensitiveInfo(obj, options).masked;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveInfoInObject(item, options));
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = maskSensitiveInfoInObject(value, options);
    }
    
    return result;
  }
  
  // 숫자, 불리언 등은 그대로 반환
  return obj;
}

/**
 * 기본 마스킹 전략 구현 (DI 패턴)
 */
export class DefaultMaskingStrategy implements MaskingStrategy {
  private patterns: SensitivePattern[];
  
  constructor(patterns: SensitivePattern[] = SENSITIVE_PATTERNS) {
    this.patterns = patterns;
  }
  
  mask(text: string, options?: MaskOptions): MaskResult {
    // 커스텀 패턴이 있으면 해당 패턴만 사용하는 새 인스턴스로 처리
    if (options?.patterns && options.patterns.length > 0) {
      const patternsList = options.patterns; // null 체크를 위한 지역 변수
      const filteredPatterns = this.patterns.filter(p => patternsList.includes(p.name));
      const tempStrategy = new DefaultMaskingStrategy(filteredPatterns);
      // patterns 없이 새로운 options 객체 생성
      const { patterns: _, ...restOptions } = options;
      return tempStrategy.mask(text, restOptions);
    }
    
    // 패턴을 직접 사용하는 내부 마스킹 함수
    const startTime = performance.now();
    
    if (text == null || text === '') {
      return { masked: '', detected: [], processingTime: 0 };
    }
    
    const customMaskChar = options?.maskChar;
    const useCustomMask = customMaskChar && customMaskChar !== '***REDACTED***';
    
    const detectedMap = new Map<string, { severity: Severity; count: number }>();
    let maskedText = text;
    
    for (const pattern of this.patterns) {
      pattern.pattern.lastIndex = 0;
      const matches = text.match(pattern.pattern);
      
      if (matches && matches.length > 0) {
        maskedText = maskedText.replace(pattern.pattern, (match) => {
          if (useCustomMask) {
            return customMaskChar!;
          }
          return pattern.maskFormat(match);
        });
        
        const existing = detectedMap.get(pattern.name);
        if (existing) {
          existing.count += matches.length;
        } else {
          detectedMap.set(pattern.name, {
            severity: pattern.severity,
            count: matches.length,
          });
        }
      }
      pattern.pattern.lastIndex = 0;
    }
    
    const detected: DetectedSensitive[] = Array.from(detectedMap.entries()).map(
      ([patternName, data]) => ({
        pattern: patternName,
        severity: data.severity,
        count: data.count,
      })
    );
    
    return {
      masked: maskedText,
      detected,
      processingTime: performance.now() - startTime,
    };
  }
}

/**
 * 스트리밍 마스킹 클래스
 * 
 * 청크 단위로 들어오는 텍스트를 버퍼링하며 마스킹 수행
 * 
 * @example
 * ```ts
 * const masker = new StreamingMasker();
 * 
 * for await (const chunk of stream) {
 *   const masked = masker.processChunk(chunk);
 *   if (masked) {
 *     yield masked;
 *   }
 * }
 * 
 * const remaining = masker.flush();
 * if (remaining) yield remaining;
 * ```
 */
export class StreamingMasker {
  private buffer = '';
  private readonly bufferSize: number;
  private options?: MaskOptions;
  
  constructor(bufferSize = 256, options?: MaskOptions) {
    this.bufferSize = bufferSize;
    if (options !== undefined) {
      this.options = options;
    }
  }
  
  /**
   * 청크 처리
   * 
   * @param chunk - 입력 청크
   * @returns 마스킹된 텍스트 또는 null (버퍼링 중)
   */
  processChunk(chunk: string): string | null {
    this.buffer += chunk;
    
    // 버퍼가 충분히 찼을 때만 처리
    if (this.buffer.length >= this.bufferSize) {
      return this.flush();
    }
    
    return null;
  }
  
  /**
   * 남은 버퍼 처리 및 반환
   */
  flush(): string {
    if (this.buffer.length === 0) {
      return '';
    }
    
    const result = maskSensitiveInfo(this.buffer, this.options);
    this.buffer = '';
    
    return result.masked;
  }
  
  /**
   * 버퍼 초기화
   */
  reset(): void {
    this.buffer = '';
  }
  
  /**
   * 현재 버퍼 크기 반환
   */
  getBufferLength(): number {
    return this.buffer.length;
  }
}

// 타입 재export
export type {
  SensitivePattern,
  MaskOptions,
  MaskResult,
  MaskingStrategy,
  DetectedSensitive,
  Severity,
  MaskErrorStrategy,
  RevealPermission,
  MaskingAuditLog,
  StreamingMaskerState,
} from '@amicus/types';
