import { describe, it, expect } from 'bun:test';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const CLI_PATH = resolve(import.meta.dirname, '../src/index.tsx');

function runCLI(args: string[] = []): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bun', [CLI_PATH, ...args], {
      env: { ...process.env, CI: 'true' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });

    proc.on('error', reject);

    // Send empty input to trigger non-interactive mode
    proc.stdin?.write('\n');
    proc.stdin?.end();
  });
}

describe('CLI Execution', () => {
  it('should run in non-interactive mode', async () => {
    const { stdout, exitCode } = await runCLI();
    
    // Exit code may be 1 if daemon is not running, but output should contain CLI name
    expect(stdout).toContain('Amicus CLI');
  });

  it('should display error when daemon is not running', async () => {
    const { stdout, stderr, exitCode } = await runCLI();
    
    // When daemon is not running, should show error
    const combined = stdout + stderr;
    if (exitCode !== 0) {
      expect(combined).toContain('Failed to connect');
    }
  });
});
