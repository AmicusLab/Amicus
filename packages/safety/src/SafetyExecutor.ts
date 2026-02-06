import simpleGit, { SimpleGit } from 'simple-git';
import { WRITE_TOOLS, DEFAULT_GITIGNORE, SNAPSHOT_MESSAGE_PREFIX } from './config.js';

/**
 * SafetyExecutor - 도구 실행 인터셉터
 * 도구 실행 후 Git 스냅샷을 자동 생성하여 되돌리기 가능하게 함
 */
export class SafetyExecutor {
  private git: SimpleGit;

  constructor(private baseDir: string = process.cwd()) {
    this.git = simpleGit(baseDir);
  }

  /**
   * Git 레포지토리 초기화 (없으면 생성)
   */
  async initRepo(): Promise<void> {
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      console.log('[Safety] Initializing Git repository...');
      await this.git.init();
      await this.git.addConfig('user.name', 'Amicus Agent');
      await this.git.addConfig('user.email', 'agent@amicus.ai');
    }

    await this.ensureGitignore();

    const log = await this.git.log({ maxCount: 1 }).catch(() => ({ total: 0 }));
    if (log.total === 0) {
      await this.git.add('.gitignore');
      await this.git.commit(`${SNAPSHOT_MESSAGE_PREFIX} Initial baseline`);
      console.log('[Safety] Created baseline commit');
    }
  }

  private async ensureGitignore(): Promise<void> {
    const gitignorePath = `${this.baseDir}/.gitignore`;
    const fs = await import('fs/promises');

    try {
      await fs.access(gitignorePath);
    } catch {
      await fs.writeFile(gitignorePath, DEFAULT_GITIGNORE, 'utf-8');
      console.log('[Safety] Created .gitignore to protect sensitive files');
    }
  }

  /**
   * 스냅샷 생성 (Git commit)
   */
  private async createSnapshot(toolName: string): Promise<void> {
    try {
      const status = await this.git.status();
      
      if (status.files.length > 0) {
        await this.git.add('.');
        await this.git.commit(`${SNAPSHOT_MESSAGE_PREFIX} Auto-save after executing: ${toolName}`);
        console.log(`[Safety] Snapshot created for ${toolName}`);
      } else {
        console.log(`[Safety] No changes to snapshot`);
      }
    } catch (error: any) {
      console.error('[Safety] Failed to create snapshot:', error.message);
      throw new Error(`Snapshot creation failed: ${error.message}`);
    }
  }

  /**
   * 도구가 쓰기 작업인지 판별
   */
  private isWriteOperation(toolName: string): boolean {
    return WRITE_TOOLS.includes(toolName);
  }

  /**
   * 안전하게 도구 실행 (인터셉터)
   */
  async executeSafe<T>(
    toolName: string,
    executeFn: () => Promise<T>
  ): Promise<T> {
    if (!this.isWriteOperation(toolName)) {
      return executeFn();
    }

    try {
      const result = await executeFn();
      console.log(`[Safety] Tool ${toolName} executed successfully`);

      try {
        await this.createSnapshot(toolName);
      } catch (snapshotError: any) {
        console.error(`[Safety] Snapshot failed, rolling back working tree:`, snapshotError.message);
        await this.git.reset(['--hard', 'HEAD']);
        await this.git.clean('f', ['-d']);
        throw new Error(`Snapshot failed: ${snapshotError.message}`);
      }

      return result;
    } catch (toolError: any) {
      console.error(`[Safety] Tool ${toolName} failed:`, toolError.message);
      throw toolError;
    }
  }

  /**
   * 롤백 (마지막 커밋으로 되돌리기)
   */
  async rollback(): Promise<string> {
    try {
      const status = await this.git.status();
      if (status.files.length > 0) {
        return '❌ 커밋되지 않은 변경사항이 있습니다. 먼저 변경사항을 처리해주세요.';
      }

      const log = await this.git.log({ maxCount: 1 });
      if (log.total === 0) {
        return '❌ 되돌릴 커밋이 없습니다.';
      }

      const lastCommit = log.latest;
      if (!lastCommit || !lastCommit.message.startsWith(SNAPSHOT_MESSAGE_PREFIX)) {
        return '❌ 마지막 커밋이 SafetyExecutor가 생성한 스냅샷이 아닙니다. 수동으로 되돌려주세요.';
      }

      await this.git.reset(['--hard', 'HEAD~1']);
      console.log('[Safety] Rolled back to previous state');
      return '✅ 성공적으로 이전 상태로 되돌렸습니다.';
    } catch (error: any) {
      console.error('[Safety] Rollback failed:', error.message);
      return `❌ 롤백 실패: ${error.message}`;
    }
  }
}
