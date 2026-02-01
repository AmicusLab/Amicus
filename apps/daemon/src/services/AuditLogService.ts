import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './ConfigService.js';

export type AuditEvent = {
  timestamp: string;
  eventId: string;
  actor: 'admin';
  action: string;
  resource: string;
  result: 'success' | 'failure';
  message?: string;
};

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

export function writeAudit(event: AuditEvent): void {
  const line = JSON.stringify(event) + '\n';
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
