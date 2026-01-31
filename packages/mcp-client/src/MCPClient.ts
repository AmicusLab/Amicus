import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export interface MCPClientOptions {
  name: string;
  version: string;
  transport: 'stdio' | 'http';
  serverUrl?: string;
  command?: string;
  args?: string[];
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | StreamableHTTPClientTransport | null = null;
  private options: MCPClientOptions;

  constructor(options: MCPClientOptions) {
    this.options = options;
    this.client = new Client({
      name: options.name,
      version: options.version,
    });
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.transport) {
      throw new Error('Already connected to MCP server');
    }

    if (this.options.transport === 'stdio') {
      if (!this.options.command) {
        throw new Error('Command is required for stdio transport');
      }
      this.transport = new StdioClientTransport({
        command: this.options.command,
        args: this.options.args || [],
      });
    } else if (this.options.transport === 'http') {
      if (!this.options.serverUrl) {
        throw new Error('Server URL is required for HTTP transport');
      }
      this.transport = new StreamableHTTPClientTransport(
        new URL(this.options.serverUrl)
      );
    } else {
      throw new Error(`Unsupported transport: ${this.options.transport}`);
    }

    await this.client.connect(this.transport as StdioClientTransport);
  }

  /**
   * Disconnect from server
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.client.close();
      this.transport = null;
    }
  }

  /**
   * Discover available tools from the MCP server
   */
  async discoverTools(): Promise<Tool[]> {
    if (!this.transport) {
      throw new Error('Not connected to MCP server');
    }

    const response = await this.client.listTools();
    
    return response.tools.map((tool: unknown) => {
      const t = tool as { name: string; description?: string; inputSchema?: Record<string, unknown> };
      return {
        name: t.name,
        description: t.description ?? '',
        inputSchema: t.inputSchema ?? {},
      };
    });
  }

  /**
   * Invoke a tool on the MCP server
   */
  async invokeTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    if (!this.transport) {
      throw new Error('Not connected to MCP server');
    }

    const result = await this.client.callTool({
      name,
      arguments: params,
    });

    let content = '';
    const resultContent = result.content as Array<{ type?: string; text?: string }> | undefined;
    if (resultContent && resultContent.length > 0) {
      const firstContent = resultContent[0];
      if (firstContent && typeof firstContent.text === 'string') {
        content = firstContent.text;
      } else {
        content = JSON.stringify(resultContent);
      }
    } else if (result.structuredContent) {
      content = JSON.stringify(result.structuredContent);
    }

    return {
      content,
      isError: (result.isError as boolean | undefined) ?? false,
    };
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.transport !== null;
  }
}
