import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { execFileSync } from 'node:child_process';
import { SafeMCPClient } from './SafeMCPClient.js';
import type { MCPClient, ToolResult } from './MCPClient.js';

const TEST_ROOT = join(import.meta.dir, '..', '..', '__test_temp__', 'safe-mcp-client');

function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env): string {
  const out = execFileSync('git', args, { cwd, env, stdio: 'pipe' });
  return out.toString('utf-8');
}

async function initRepo(repoDir: string): Promise<void> {
  git(repoDir, ['init']);
  git(repoDir, ['config', 'user.email', 'test@example.com']);
  git(repoDir, ['config', 'user.name', 'Test User']);
}

describe('SafeMCPClient', () => {
  const createdDirs: string[] = [];

  beforeEach(async () => {
    await mkdir(TEST_ROOT, { recursive: true });
  });

  afterEach(async () => {
    while (createdDirs.length > 0) {
      const dir = createdDirs.pop();
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  test('should auto-commit then execute tool', async () => {
    const repoDir = await mkdtemp(join(TEST_ROOT, 'repo-'));
    createdDirs.push(repoDir);
    await initRepo(repoDir);

    await writeFile(join(repoDir, 'hello.txt'), 'hello');

    const invokeTool = mock(async () => ({ content: 'ok', isError: false } satisfies ToolResult));
    const mcpClient = { invokeTool } as unknown as MCPClient;
    const client = new SafeMCPClient(mcpClient, { cwd: repoDir });

    const result = await client.callTool('write_file', { path: 'x', content: 'y' });

    expect(result.content).toBe('ok');
    expect(invokeTool).toHaveBeenCalledWith('write_file', { path: 'x', content: 'y' });

    const subject = git(repoDir, ['log', '-1', '--format=%s']).trim();
    expect(subject).toBe('Amicus auto-commit before write_file');
  });

  test('should throw when git is not installed and not execute tool', async () => {
    const repoDir = await mkdtemp(join(TEST_ROOT, 'repo-'));
    createdDirs.push(repoDir);

    const invokeTool = mock(async () => ({ content: 'ok', isError: false } satisfies ToolResult));
    const mcpClient = { invokeTool } as unknown as MCPClient;

    const env = { ...process.env, PATH: '/__nonexistent__' };
    const client = new SafeMCPClient(mcpClient, { cwd: repoDir, env });

    await expect(client.callTool('write_file', { any: 'thing' })).rejects.toThrow('Git not installed');
    expect(invokeTool).not.toHaveBeenCalled();
  });

  test('should abort when there are no changes to commit and not execute tool', async () => {
    const repoDir = await mkdtemp(join(TEST_ROOT, 'repo-'));
    createdDirs.push(repoDir);
    await initRepo(repoDir);

    const invokeTool = mock(async () => ({ content: 'ok', isError: false } satisfies ToolResult));
    const mcpClient = { invokeTool } as unknown as MCPClient;
    const client = new SafeMCPClient(mcpClient, { cwd: repoDir });

    await expect(client.callTool('write_file', { any: 'thing' })).rejects.toThrow('No changes to commit');
    expect(invokeTool).not.toHaveBeenCalled();
  });
});
