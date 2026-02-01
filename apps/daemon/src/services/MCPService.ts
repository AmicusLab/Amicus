import { MCPManager } from '@amicus/mcp-client';
import type { MCPClient } from '@amicus/mcp-client';
import type { Tool } from '@amicus/mcp-client';
import { join } from 'path';
import { configManager, repoRoot } from './ConfigService.js';

function resolveMcpConfigPath(): string {
  const cfg = configManager.getConfig();
  const raw = process.env.MCP_CONFIG_PATH || cfg.mcp.configPath;
  // Preserve existing behavior: allow absolute paths or repo-relative paths.
  return raw.startsWith('/') ? raw : join(repoRoot, raw);
}

interface MCPClientLike {
  discoverTools(): Promise<Tool[]>;
  invokeTool(name: string, params: Record<string, unknown>): Promise<{ content: string; isError?: boolean }>;
}

class MCPService {
  private manager: MCPManager;
  private initialized = false;

  constructor() {
    this.manager = new MCPManager();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.manager.loadServers(resolveMcpConfigPath());
      const connected = await this.manager.connectToAllServers();
      
      console.log(`[MCPService] Connected to ${connected.size} MCP server(s)`);
      this.initialized = true;
    } catch (error) {
      console.error('[MCPService] Failed to initialize:', error);
    }
  }

  getManager(): MCPManager {
    return this.manager;
  }

  getClient(): MCPClientLike | undefined {
    if (!this.initialized) return undefined;
    return new MCPClientWrapper(this.manager);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    if (this.initialized) {
      await this.manager.disconnectAllServers();
      this.initialized = false;
    }
  }
}

class MCPClientWrapper implements MCPClientLike {
  constructor(private manager: MCPManager) {}

  async discoverTools(): Promise<Tool[]> {
    const allTools: Tool[] = [];
    const connectedServers = this.manager.getConnectedServers();
    
    for (const serverId of connectedServers) {
      try {
        const client = await this.manager.connectToServer(serverId);
        const tools = await client.discoverTools();
        allTools.push(...tools);
      } catch (error) {
        console.warn(`[MCPService] Failed to discover tools from ${serverId}:`, error);
      }
    }
    
    return allTools;
  }

  async invokeTool(name: string, params: Record<string, unknown>): Promise<{ content: string; isError?: boolean }> {
    const connectedServers = this.manager.getConnectedServers();
    
    for (const serverId of connectedServers) {
      try {
        const client = await this.manager.connectToServer(serverId);
        const tools = await client.discoverTools();
        const toolExists = tools.some(t => t.name === name);
        
        if (toolExists) {
          return await client.invokeTool(name, params);
        }
      } catch (error) {
        console.warn(`[MCPService] Failed to invoke tool on ${serverId}:`, error);
      }
    }
    
    return { content: `Tool '${name}' not found on any connected server`, isError: true };
  }
}

export const mcpService = new MCPService();
