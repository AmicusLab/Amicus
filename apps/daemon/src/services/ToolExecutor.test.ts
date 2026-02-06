import { describe, it, expect } from 'bun:test';
import { ToolExecutor } from './ToolExecutor.js';

describe('ToolExecutor', () => {
  it('executes write_file via MCP callTool and returns success', async () => {
    let calledWith: unknown = undefined;

    const executor = new ToolExecutor({
      callTool: async (name, args) => {
        calledWith = { name, args };
        return { bytesWritten: String((args as { content?: unknown }).content ?? '').length };
      },
    });

    const result = await executor.execute('write_file', {
      path: 'data/test.txt',
      content: 'hello',
    });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ bytesWritten: 5 });
    expect(calledWith).toEqual({
      name: 'write_file',
      args: { path: 'data/test.txt', content: 'hello' },
    });
  });

  it('returns structured error when MCP client throws', async () => {
    const executor = new ToolExecutor({
      callTool: async () => {
        throw new Error('MCP error');
      },
    });

    const result = await executor.execute('write_file', {
      path: 'data/test.txt',
      content: 'hello',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('MCP error');
  });

  it('rejects unsupported tools', async () => {
    const executor = new ToolExecutor({
      callTool: async () => ({ ok: true }),
    });

    const result = await executor.execute('read_file', { path: 'x', content: 'y' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unsupported tool: read_file');
  });

  it('validates write_file args', async () => {
    const executor = new ToolExecutor({
      callTool: async () => ({ ok: true }),
    });

    const result = await executor.execute('write_file', { path: 123, content: false } as unknown as Record<string, unknown>);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid args for write_file');
  });
});
