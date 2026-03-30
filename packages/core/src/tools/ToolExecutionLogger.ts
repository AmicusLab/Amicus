import type { ExecutionSummary } from './types.js';

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

const SENSITIVE_KEYS = [
  'password', 'token', 'apikey', 'secret', 'credential',
  'authorization', 'cookie', 'private_key', 'privatekey',
  'session', 'sessionid', 'refresh_token', 'access_token',
  'passphrase', 'secretkey',
];

const LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

export class ToolExecutionLogger {
  private entries: LogEntry[] = [];
  private readonly maxEntries: number;
  private readonly logLevel: LogLevel;

  constructor(config?: { maxEntries?: number; logLevel?: LogLevel }) {
    this.maxEntries = config?.maxEntries ?? 1000;
    this.logLevel = config?.logLevel ?? 'INFO';
  }

  private sanitizeString(str: string): string {
    let result = str.replace(
      /([?&](?:token|key|secret|password|api_key)=)[^&\s]+/gi,
      '$1***REDACTED***'
    );
    result = result.replace(/Bearer\s+\S+/gi, 'Bearer ***REDACTED***');
    return result;
  }

  private sanitize(data: unknown): unknown {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') return this.sanitizeString(data);

    if (Array.isArray(data)) return data.map(item => this.sanitize(item));

    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk))) {
          sanitized[key] = '***REDACTED***';
        } else {
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
