import { mkdir, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type AuditEventPhase =
  | "precheck"
  | "checkpoint_created"
  | "operation_started"
  | "operation_succeeded"
  | "operation_failed"
  | "rollback_started"
  | "rollback_succeeded"
  | "rollback_failed";

export interface AuditEvent {
  timestamp: string;
  taskDescription: string;
  phase: AuditEventPhase;
  repoRoot: string;
  checkpointCommit?: string;
  error?: {
    name: string;
    message: string;
  };
}

export interface AuditLoggerOptions {
  /** Default: `<repoRoot>/data/audit.log` */
  logPath?: string;
}

export class AuditLogger {
  private readonly logPath: string;

  constructor(private readonly repoRoot: string, opts: AuditLoggerOptions = {}) {
    this.logPath = resolve(repoRoot, opts.logPath ?? "data/audit.log");
  }

  async append(event: Omit<AuditEvent, "timestamp" | "repoRoot">): Promise<void> {
    const payload: AuditEvent = {
      timestamp: new Date().toISOString(),
      repoRoot: this.repoRoot,
      ...event,
    };

    await mkdir(dirname(this.logPath), { recursive: true });
    await appendFile(this.logPath, `${JSON.stringify(payload)}\n`, "utf8");
  }
}
