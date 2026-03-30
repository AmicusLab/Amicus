import type { ExecutionSummary } from './types.js';
import { maskSensitiveInfo, maskSensitiveInfoInObject } from '../utils/sensitive-mask.js';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  type: 'start' | 'result' | 'error' | 'retry';
  toolName: string;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  duration?: number;
  attempt?: number;
}

/**
 * 키 이름 기반 민감 정보 키 목록
 * maskSensitiveInfo의 패턴 기반 마스킹과 함께 사용
 */
const SENSITIVE_KEYS = [
  'password', 'token', 'apikey', 'secret', 'credential',
  'authorization', 'cookie', 'private_key', 'privatekey',
  'session', 'sessionid', 'refresh_token', 'access_token',
  'passphrase', 'secretkey', 'api_key', 'key', 'auth',
];

const LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

/**
 * 툴 실행 로깅 서비스
 * 
 * 민감 정보 자동 마스킹 기능을 포함:
 * - 패턴 기반 마스킹 (API 키, 토큰 등)
 * - 키 이름 기반 마스킹 (password, secret 등)
 */
export class ToolExecutionLogger {
  private entries: LogEntry[] = [];
  private readonly maxEntries: number;
  private readonly logLevel: LogLevel;
  private readonly disableMasking: boolean;

  constructor(config?: { 
    maxEntries?: number; 
    logLevel?: LogLevel;
    /** 마스킹 비활성화 (서버 환경 변수로만 제어) */
    disableMasking?: boolean;
  }) {
    this.maxEntries = config?.maxEntries ?? 1000;
    this.logLevel = config?.logLevel ?? 'INFO';
    // 마스킹 비활성화는 서버 환경 변수로만 제어
    this.disableMasking = config?.disableMasking ?? process.env.AMICUS_DISABLE_MASKING === 'true';
  }

  /**
   * 문자열 마스킹
   * 패턴 기반 + 키 기반 마스킹 조합
   */
  private sanitizeString(str: string): string {
    if (this.disableMasking) return str;
    
    // Phase 1의 패턴 기반 마스킹 사용
    const result = maskSensitiveInfo(str);
    return result.masked;
  }

  /**
   * 객체/값 마스킹
   * 중첩된 객체와 문자열 모두 처리
   */
  private sanitize(data: unknown): unknown {
    if (this.disableMasking) return data;
    if (data === null || data === undefined) return data;

    // 문자열은 패턴 기반 마스킹
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    // 배열은 재귀 처리
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    // 객체는 키 기반 + 패턴 기반 마스킹 조합
    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        // 키 이름이 민감 정보 키를 포함하면 마스킹
        if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk))) {
          sanitized[key] = '***REDACTED***';
        } else if (typeof value === 'string') {
          // 문자열 값은 패턴 기반 마스킹
          sanitized[key] = this.sanitizeString(value);
        } else {
          // 중첩 객체는 재귀 처리
          sanitized[key] = this.sanitize(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  private addEntry(entry: LogEntry): void {
    if (this.entries.length >= this.maxEntries) {
      this.entries.shift();
    }
    this.entries.push(entry);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS.indexOf(level) >= LEVELS.indexOf(this.logLevel);
  }

  logStart(toolName: string, args: Record<string, unknown>): void {
    if (!this.shouldLog('DEBUG')) return;

    this.addEntry({
      timestamp: Date.now(),
      level: 'DEBUG',
      type: 'start',
      toolName,
      args: this.sanitize(args) as Record<string, unknown>,
    });
  }

  logResult(toolName: string, result: unknown, duration: number): void {
    if (!this.shouldLog('INFO')) return;

    this.addEntry({
      timestamp: Date.now(),
      level: 'INFO',
      type: 'result',
      toolName,
      result: this.shouldLog('DEBUG') ? this.sanitize(result) : undefined,
      duration,
    });
  }

  logError(toolName: string, error: Error, duration: number): void {
    if (!this.shouldLog('ERROR')) return;

    this.addEntry({
      timestamp: Date.now(),
      level: 'ERROR',
      type: 'error',
      toolName,
      error: this.sanitizeString(error.message),
      duration,
    });
  }

  logRetry(toolName: string, attempt: number, error: Error): void {
    if (!this.shouldLog('WARN')) return;

    this.addEntry({
      timestamp: Date.now(),
      level: 'WARN',
      type: 'retry',
      toolName,
      attempt,
      error: this.sanitizeString(error.message),
    });
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  summarize(): ExecutionSummary {
    return {
      totalCalls: this.entries.filter(e => e.type === 'start').length,
      successes: this.entries.filter(e => e.type === 'result').length,
      failures: this.entries.filter(e => e.type === 'error').length,
      retries: this.entries.filter(e => e.type === 'retry').length,
    };
  }

  clear(): void {
    this.entries = [];
  }
}
