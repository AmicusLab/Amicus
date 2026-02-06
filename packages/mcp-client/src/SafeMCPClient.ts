import { execFileSync } from 'node:child_process';
import type { MCPClient, ToolResult } from './MCPClient.js';

export interface SafeMCPClientOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export class SafeMCPClient {
  private client: MCPClient;
  private cwd: string;
  private env: NodeJS.ProcessEnv;

  constructor(client: MCPClient, options: SafeMCPClientOptions = {}) {
    this.client = client;
    this.cwd = options.cwd ?? process.cwd();
    this.env = options.env ?? process.env;
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    await this.gitCommit(name);
    return this.client.invokeTool(name, params);
  }

  private async gitCommit(toolName: string): Promise<void> {
    this.assertGitAvailable();
    this.assertInsideWorkTree();

    try {
      execFileSync('git', ['add', '-A'], {
        cwd: this.cwd,
        env: this.env,
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`Git staging failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Do not allow empty commits.
    try {
      execFileSync('git', ['diff', '--cached', '--quiet'], {
        cwd: this.cwd,
        env: this.env,
        stdio: 'pipe',
      });

      // Exit code 0 means no staged diff.
      throw new Error('No changes to commit');
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      if (status !== 1) {
        if (error instanceof Error && error.message === 'No changes to commit') {
          throw error;
        }
        throw new Error('Git commit failed');
      }
    }

    try {
      execFileSync('git', ['commit', '-m', `Amicus auto-commit before ${toolName}`], {
        cwd: this.cwd,
        env: this.env,
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(`Git commit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private assertGitAvailable(): void {
    try {
      execFileSync('git', ['--version'], {
        cwd: this.cwd,
        env: this.env,
        stdio: 'pipe',
      });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === 'ENOENT') {
        throw new Error('Git not installed');
      }
      throw new Error(`Git command failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private assertInsideWorkTree(): void {
    try {
      const out = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: this.cwd,
        env: this.env,
        stdio: 'pipe',
      });
      const text = out.toString('utf-8').trim();
      if (text !== 'true') {
        throw new Error('Not a git repository');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'Not a git repository') {
        throw error;
      }
      throw new Error('Not a git repository');
    }
  }
}
