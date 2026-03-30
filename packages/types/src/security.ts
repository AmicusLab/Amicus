/**
 * @fileoverview 민감 정보 마스킹 관련 타입 정의
 * 
 * 보안 관련 타입과 인터페이스를 정의합니다.
 */

/**
 * 민감 정보 심각도 레벨
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 민감 정보 패턴 정의
 */
export interface SensitivePattern {
  /** 패턴 이름 */
  name: string;
  /** 감지 정규식 */
  pattern: RegExp;
  /** 마스킹 포맷 함수 */
  maskFormat: (match: string) => string;
  /** 심각도 레벨 */
  severity: Severity;
}

/**
 * 마스킹 에러 처리 전략
 */
export type MaskErrorStrategy = 'throw' | 'fallback' | 'log-only';

/**
 * 마스킹 옵션
 */
export interface MaskOptions {
  /** 마스킹 문자 (기본값: '***REDACTED***') */
  maskChar?: string;
  /** 특정 패턴만 적용 (패턴 이름 배열) */
  patterns?: string[];
  /** 컨텍스트 정보 로깅 */
  logContext?: boolean;
  /** 최대 처리 길이 (성능 보호) */
  maxLength?: number;
  /** 에러 처리 전략 */
  onMaskError?: MaskErrorStrategy;
  /** 에러 시 반환할 기본값 */
  fallbackValue?: string;
  /** 타임아웃 (ms) */
  timeout?: number;
}

/**
 * 감지된 민감 정보
 */
export interface DetectedSensitive {
  /** 패턴 이름 */
  pattern: string;
  /** 심각도 */
  severity: Severity;
  /** 발견 횟수 */
  count: number;
}

/**
 * 마스킹 결과
 */
export interface MaskResult {
  /** 마스킹된 텍스트 */
  masked: string;
  /** 발견된 민감 정보 목록 */
  detected: DetectedSensitive[];
  /** 처리 시간 (ms) */
  processingTime: number;
}

/**
 * 마스킹 전략 인터페이스 (DI 패턴)
 */
export interface MaskingStrategy {
  /**
   * 텍스트 마스킹 수행
   * @param text 마스킹할 텍스트
   * @param options 마스킹 옵션
   * @returns 마스킹 결과
   */
  mask(text: string, options?: MaskOptions): MaskResult;
}

/**
 * 스트리밍 마스킹 상태
 */
export type StreamingMaskerState = 'idle' | 'buffering' | 'ready';

/**
 * 마스킹 해제 권한
 */
export interface RevealPermission {
  /** 사용자 ID */
  userId: string;
  /** 권한 레벨 */
  level: 'admin' | 'auditor' | 'none';
  /** 만료 시간 (Unix timestamp) */
  expiresAt?: number;
}

/**
 * 감사 로그 항목
 */
export interface MaskingAuditLog {
  /** 로그 ID */
  id: string;
  /** 작업 유형 */
  action: 'mask' | 'reveal' | 'error';
  /** 패턴 이름 */
  pattern?: string;
  /** 사용자 ID */
  userId?: string;
  /** 타임스탬프 */
  timestamp: number;
  /** 컨텍스트 정보 */
  context?: Record<string, unknown>;
}
