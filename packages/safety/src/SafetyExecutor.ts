import simpleGit, { SimpleGit } from 'simple-git';
import { WRITE_TOOLS } from './config.js';

/**
 * SafetyExecutor - 도구 실행 인터셉터
 * 도구 실행 전 Git 스냅샷을 자동 생성하여 되돌리기 가능하게 함
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
  }

  /**
   * 스냅샷 생성 (Git commit)
   */
  private async createSnapshot(toolName: string): Promise<void> {
    try {
      const status = await this.git.status();
      
      if (status.files.length > 0) {
        await this.git.add('.');
        await this.git.commit(`Auto-save before executing: ${toolName}`);
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
      
      // 도구 실행 후 변경사항을 커밋 (도구가 수정한 내용 포함)
      await this.createSnapshot(toolName);
      
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
      const log = await this.git.log({ maxCount: 2 });
      if (log.total < 2) {
        return '❌ 되돌릴 커밋이 없습니다.';
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
