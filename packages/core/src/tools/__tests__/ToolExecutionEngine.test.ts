import { describe, it, expect, beforeEach } from 'bun:test';
import { ToolExecutionEngine, type EngineConfig } from '../ToolExecutionEngine.js';
import { ToolRegistry, Tool, ErrorCategory, RecoveryStrategy } from '../types.js';
import { ToolExecutionLogger } from '../ToolExecutionLogger.js';
import { z } from 'zod';

describe('ToolExecutionEngine', () => {
  let toolRegistry: ToolRegistry;
  let engine: ToolExecutionEngine;

  const createMockTool = (
    name: string,
    execute: (args: Record<string, unknown>) => Promise<string>
  ): Tool => ({
    name,
    description: `Mock tool: ${name}`,
    schema: z.object({}),
    execute,
  });

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
  });

  describe('성공 케이스', () => {
    it('도구를 성공적으로 실행한다', async () => {
      const tool = createMockTool('test_tool', async () => 'success');
      toolRegistry.register(tool);

      engine = new ToolExecutionEngine({ toolRegistry });
      const result = await engine.execute('test_tool', {});

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('args가 null이어도 안전하게 처리한다', async () => {
      const tool = createMockTool('test_tool', async () => 'success');
      toolRegistry.register(tool);

      engine = new ToolExecutionEngine({ toolRegistry });
      // @ts-expect-error - testing edge case
      const result = await engine.execute('test_tool', null);

      expect(result.success).toBe(true);
    });
  });

  describe('에러 처리', () => {
    it('존재하지 않는 도구는 PERMANENT 에러를 반환한다', async () => {
      engine = new ToolExecutionEngine({ toolRegistry });
      const result = await engine.execute('unknown_tool', {});

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe(ErrorCategory.PERMANENT);
      expect(result.error?.message).toContain('Unknown tool');
    });

    it('validation 에러는 PERMANENT로 분류된다', async () => {
      const tool: Tool<z.infer<z.ZodObject<{ path: z.ZodString }>>> = {
        name: 'read_file',
        description: 'Read a file',
        schema: z.object({ path: z.string() }),
        execute: async () => 'content',
      };
      toolRegistry.register(tool);

      engine = new ToolExecutionEngine({ toolRegistry });
      const result = await engine.execute('read_file', {}); // missing path

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe(ErrorCategory.PERMANENT);
    });

    it('네트워크 에러는 재시도 후 성공할 수 있다', async () => {
      let attempts = 0;
      const tool = createMockTool('network_tool', async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('ECONNREFUSED');
        }
        return 'success';
      });
      toolRegistry.register(tool);

      engine = new ToolExecutionEngine({ toolRegistry, maxExecutionTimeMs: 5000 });
      const result = await engine.execute('network_tool', {});

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });
  });

  describe('타임아웃', () => {
    it('maxExecutionTimeMs 초과 시 실패한다 (네트워크 에러 재시도 누적)', async () => {
      // 타임아웃은 재시도 지연 시간이 누적될 때 발생
      let attempts = 0;
      const tool = createMockTool('slow_network_tool', async () => {
        attempts++;
        throw new Error('ECONNREFUSED'); // 1s, 2s, 4s = 7s total delay
      });
      toolRegistry.register(tool);

      engine = new ToolExecutionEngine({ toolRegistry, maxExecutionTimeMs: 3000 });
      const result = await engine.execute('slow_network_tool', {});

      // 1s + 2s = 3s 후 타임아웃으로 실패
      expect(result.success).toBe(false);
      expect(result.error?.category).toBeOneOf([ErrorCategory.TRANSIENT, ErrorCategory.RETRYABLE]);
    }, 15000);
  });

  describe('로깅', () => {
    it('성공 실행이 로그에 기록된다', async () => {
      const tool = createMockTool('test_tool', async () => 'success');
      toolRegistry.register(tool);

      const logger = new ToolExecutionLogger({ logLevel: 'DEBUG' });
      engine = new ToolExecutionEngine({ toolRegistry, logger });
      await engine.execute('test_tool', {});

      const summary = engine.getLogger().summarize();
      expect(summary.successes).toBe(1);
      expect(summary.failures).toBe(0);
    });

    it('실패 실행이 로그에 기록된다', async () => {
      const tool = createMockTool('fail_tool', async () => {
        throw new Error('validation failed');
      });
      toolRegistry.register(tool);

      engine = new ToolExecutionEngine({ toolRegistry });
      await engine.execute('fail_tool', {});

      const summary = engine.getLogger().summarize();
      expect(summary.failures).toBe(1);
    });
  });
});
