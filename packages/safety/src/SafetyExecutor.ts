import { simpleGit, type SimpleGit, ResetMode } from "simple-git";
import { AuditLogger, type AuditLoggerOptions } from "./AuditLogger.js";
import {
  DirtyWorkingTreeError,
  NotAGitRepositoryError,
  RollbackFailedError,
} from "./errors.js";

export type DirtyStateStrategy = "error" | "stash";

export interface SafetyExecutorOptions {
  /** Repository root where git operations should run. Default: `process.cwd()` */
  repoRoot?: string;
  /** How to handle a dirty working tree. Default: `"error"` */
  dirtyStateStrategy?: DirtyStateStrategy;
  /** Optional audit logger options. */
  audit?: AuditLoggerOptions;
}

export class SafetyExecutor {
  private readonly repoRoot: string;
  private readonly git: SimpleGit;
  private readonly audit: AuditLogger;
  private readonly dirtyStateStrategy: DirtyStateStrategy;

  // In-process mutex to prevent concurrent git mutations.
  private locked: Promise<void> = Promise.resolve();

  constructor(opts: SafetyExecutorOptions = {}) {
    this.repoRoot = opts.repoRoot ?? process.cwd();
    this.git = simpleGit({ baseDir: this.repoRoot });
    this.audit = new AuditLogger(this.repoRoot, opts.audit);
    this.dirtyStateStrategy = opts.dirtyStateStrategy ?? "error";
  }

  async execute<T>(
    taskDescription: string,
    operationFunction: () => Promise<T>
  ): Promise<T> {
    return this.withLock(async () => {
      await this.ensureRepo(taskDescription);

      const status = await this.git.status();
      await this.audit.append({
        taskDescription,
        phase: "precheck",
      });

      if (!status.isClean()) {
        if (this.dirtyStateStrategy === "stash") {
          await this.git.stash(["push", "-m", "amicus/safety-autostash"]);
        } else {
          throw new DirtyWorkingTreeError(
            "Working tree is not clean. Commit or stash your changes before running SafetyExecutor."
          );
        }
      }

      // Create a checkpoint commit marker. This is intentionally allow-empty so
      // it works even in a clean repo.
      const checkpointMessage = "amicus/safety-checkpoint";
      await this.git.commit(checkpointMessage, undefined, { "--allow-empty": null });

      const checkpointCommit = (await this.git.revparse(["HEAD"])).trim();
      await this.audit.append({
        taskDescription,
        phase: "checkpoint_created",
        checkpointCommit,
      });

      try {
        await this.audit.append({
          taskDescription,
          phase: "operation_started",
          checkpointCommit,
        });

        const result = await operationFunction();

        await this.audit.append({
          taskDescription,
          phase: "operation_succeeded",
          checkpointCommit,
        });

        return result;
      } catch (err) {
        await this.audit.append({
          taskDescription,
          phase: "operation_failed",
          checkpointCommit,
          error: this.toErrorShape(err),
        });

        await this.audit.append({
          taskDescription,
          phase: "rollback_started",
          checkpointCommit,
        });

        try {
          // Rollback as specified (discard the checkpoint commit + any changes).
          await this.git.reset(ResetMode.HARD, ["HEAD^"]);
          await this.audit.append({
            taskDescription,
            phase: "rollback_succeeded",
            checkpointCommit,
          });
        } catch (rollbackErr) {
          await this.audit.append({
            taskDescription,
            phase: "rollback_failed",
            checkpointCommit,
            error: this.toErrorShape(rollbackErr),
          });
          throw new RollbackFailedError(
            `Rollback failed: ${this.toErrorMessage(rollbackErr)}`
          );
        }

        throw err;
      }
    });
  }

  private async ensureRepo(taskDescription: string): Promise<void> {
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      await this.audit.append({
        taskDescription,
        phase: "precheck",
        error: { name: "NotAGitRepository", message: "Not a git repository" },
      });
      throw new NotAGitRepositoryError(
        `Not a git repository: ${this.repoRoot}. Run 'git init' first.`
      );
    }
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.locked;
    let release!: () => void;
    this.locked = new Promise<void>((r) => {
      release = r;
    });
    await prev;

    try {
      return await fn();
    } finally {
      release();
    }
  }

  private toErrorShape(err: unknown): { name: string; message: string } {
    if (err instanceof Error) return { name: err.name, message: err.message };
    return { name: "UnknownError", message: this.toErrorMessage(err) };
  }

  private toErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
}
