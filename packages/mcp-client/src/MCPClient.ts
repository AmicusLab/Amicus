import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { readFile } from 'fs/promises';
import type { MCPServerConfig, MCPServersConfig } from './config.js';

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
  private serverId: string | null = null;
  private serverConfig: MCPServerConfig | null = null;

  // Static storage for loaded configs and active connections (for multi-server support)
  private static serversConfig: MCPServersConfig | null = null;
  private static activeConnections: Map<string, MCPClient> = new Map();
  private static retryAttempts: number = 3;
  private static retryDelay: number = 1000;

  constructor(options: MCPClientOptions) {
    this.options = options;
    this.client = new Client({
      name: options.name,
      version: options.version,
    });
  }

  static async loadServersConfig(configPath: string): Promise<MCPServersConfig> {
    const configData = await readFile(configPath, 'utf-8');
    const config: MCPServersConfig = JSON.parse(configData);
    MCPClient.serversConfig = config;
    return config;
  }

  static async connectToServer(serverId: string): Promise<MCPClient> {
    if (!MCPClient.serversConfig) {
      throw new Error('Servers config not loaded. Call loadServersConfig() first.');
    }

    if (MCPClient.activeConnections.has(serverId)) {
      return MCPClient.activeConnections.get(serverId)!;
    }

    const serverConfig = MCPClient.serversConfig.servers.find(s => s.id === serverId);
    if (!serverConfig) {
      throw new Error(`Server configuration not found for: ${serverId}`);
    }

    if (!serverConfig.enabled) {
      throw new Error(`Server ${serverId} is disabled in configuration`);
    }

    const clientOptions: MCPClientOptions = {
      name: serverId,
      version: '1.0.0',
      transport: serverConfig.transport,
    };

    if (serverConfig.command) {
      clientOptions.command = serverConfig.command;
    }
    if (serverConfig.args) {
      clientOptions.args = serverConfig.args;
    }
    if (serverConfig.serverUrl) {
      clientOptions.serverUrl = serverConfig.serverUrl;
    }

    const client = new MCPClient(clientOptions);

    client.serverId = serverId;
    client.serverConfig = serverConfig;

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MCPClient.retryAttempts; attempt++) {
      try {
        await client.connect();
        MCPClient.activeConnections.set(serverId, client);
        return client;
      } catch (error) {
        lastError = error as Error;
        console.error(`Failed to connect to server ${serverId} (attempt ${attempt}/${MCPClient.retryAttempts}):`, error);
        
        if (attempt < MCPClient.retryAttempts) {
          try {
            await client.disconnect();
          } catch {}
          await new Promise(resolve => setTimeout(resolve, MCPClient.retryDelay));
        }
      }
    }

    throw new Error(`Failed to connect to server ${serverId} after ${MCPClient.retryAttempts} attempts: ${lastError?.message}`);
  }

  static async disconnectFromServer(serverId: string): Promise<void> {
    const client = MCPClient.activeConnections.get(serverId);
    if (client) {
      await client.disconnect();
      MCPClient.activeConnections.delete(serverId);
    }
  }

  static async disconnectAllServers(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];
    for (const [serverId, client] of MCPClient.activeConnections) {
      disconnectPromises.push(
        client.disconnect().catch(error => {
          console.error(`Error disconnecting from server ${serverId}:`, error);
        })
      );
    }
    await Promise.all(disconnectPromises);
    MCPClient.activeConnections.clear();
  }

  static getServerStatus(): Array<{ serverId: string; connected: boolean; config: MCPServerConfig | null }> {
    return Array.from(MCPClient.activeConnections.entries()).map(([serverId, client]) => ({
      serverId,
      connected: client.isConnected(),
      config: client.serverConfig,
    }));
  }

  static getConnectedServers(): string[] {
    return Array.from(MCPClient.activeConnections.keys());
  }

  static isServerConnected(serverId: string): boolean {
    const client = MCPClient.activeConnections.get(serverId);
    return client ? client.isConnected() : false;
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
