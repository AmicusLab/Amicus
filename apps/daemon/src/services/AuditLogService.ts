import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './ConfigService.js';

/**
 * 감사 로그 이벤트 타입
 */
export type AuditEvent = {
  timestamp: string;
  eventId: string;
  actor: 'admin';
  action: string;
  resource: string;
  result: 'success' | 'failure';
  message?: string;
};

/**
 * 감사 로그 마스킹 설정
 * 서버 환경 변수로만 제어
 */
const DISABLE_MASKING = process.env.AMICUS_DISABLE_MASKING === 'true';

/**
 * 민감 정보 패턴 (간단 버전 - 데몬에서는 외부 의존성 최소화)
 */
const SENSITIVE_PATTERNS = [
  // API Keys
  /sk-[a-zA-Z0-9-]{20,}/g,
  /sk-ant-api[a-zA-Z0-9-]{80,}/g,
  /AKIA[A-Z0-9]{16}/g,
  // Bearer Token
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  // JWT
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  // URL params
  /([?&](?:api_key|apikey|key|token|secret|password)=)[^&\s]+/gi,
];

/**
 * 감사 로그 문자열 마스킹
 */
function maskSensitiveData(text: string): string {
  if (DISABLE_MASKING) return text;
  
  let masked = text;
  
  for (const pattern of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern, (match, group1) => {
      if (group1) {
        // URL 파라미터 형식
        return `${group1}***REDACTED***`;
      }
      // 일반 패턴
      return '***REDACTED***';
    });
  }
  
  return masked;
}

/**
 * 감사 이벤트 마스킹
 */
function maskAuditEvent(event: AuditEvent): AuditEvent {
  if (DISABLE_MASKING) return event;
  
  const masked: AuditEvent = {
    ...event,
    resource: maskSensitiveData(event.resource),
  };
  if (event.message !== undefined) {
    masked.message = maskSensitiveData(event.message);
  }
  return masked;
}

function auditDir(): string {
  return join(repoRoot, 'data', 'audit');
}

function auditFilePath(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return join(auditDir(), `admin-${y}-${m}-${d}.jsonl`);
}

let queue: Promise<void> = Promise.resolve();

/**
 * 감사 로그 기록
 * 
 * 모든 민감 정보는 자동으로 마스킹되어 저장됨
 * (disableMasking은 서버 환경 변수로만 제어)
 */
export function writeAudit(event: AuditEvent): void {
  // 마스킹 적용
  const maskedEvent = maskAuditEvent(event);
  const line = JSON.stringify(maskedEvent) + '\n';
  
  queue = queue
    .then(async () => {
      await mkdir(auditDir(), { recursive: true });
      await appendFile(auditFilePath(), line, 'utf-8');
    })
    .catch(() => {
      // Audit logging failures must not break the daemon.
    });
}

export async function readAudit(params?: { limit?: number }): Promise<AuditEvent[]> {
  const limit = Math.max(1, Math.min(params?.limit ?? 100, 500));
  try {
    const raw = await readFile(auditFilePath(), 'utf-8');
    const lines = raw.split('\n').filter(Boolean);
    const slice = lines.slice(-limit);
    const events: AuditEvent[] = [];
    for (const line of slice) {
      try {
        events.push(JSON.parse(line) as AuditEvent);
      } catch {
        // skip
      }
    }
    return events;
  } catch {
    return [];
  }
}
