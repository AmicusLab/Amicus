export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface WriteFileArgs extends Record<string, unknown> {
  path: string;
  content: string;
}

type MCPClientLike = {
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  invokeTool?: (
    name: string,
    params: Record<string, unknown>
  ) => Promise<{ content: string; isError?: boolean }>;
};

function isWriteFileArgs(args: Record<string, unknown>): args is WriteFileArgs {
  return typeof args.path === 'string' && typeof args.content === 'string';
}

export class ToolExecutor {
  constructor(private mcpClient: MCPClientLike) {}

  async execute(tool: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
    if (tool !== 'write_file') {
      return { success: false, error: `Unsupported tool: ${tool}` };
    }

    if (!isWriteFileArgs(args)) {
      return { success: false, error: 'Invalid args for write_file (expected { path: string, content: string })' };
    }

    try {
      if (this.mcpClient.callTool) {
        const result = await this.mcpClient.callTool('write_file', args);
        return { success: true, result };
      }

      if (this.mcpClient.invokeTool) {
        const result = await this.mcpClient.invokeTool('write_file', args);
        if (result.isError) {
          return { success: false, result, error: result.content || 'MCP tool returned error' };
        }
        return { success: true, result };
      }

      return { success: false, error: 'MCP client does not support tool invocation' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
