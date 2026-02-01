import { MCPClient } from './MCPClient.js';
import type { MCPServerConfig } from './config.js';

export interface ServerStatus {
  serverId: string;
  connected: boolean;
  config: MCPServerConfig | null;
}

export class MCPManager {
  private configPath: string | null = null;
  private serverConfigs: Map<string, MCPServerConfig> = new Map();

  async loadServers(configPath: string): Promise<void> {
    this.configPath = configPath;
    const config = await MCPClient.loadServersConfig(configPath);
    
    this.serverConfigs.clear();
    for (const serverConfig of config.servers) {
      this.serverConfigs.set(serverConfig.id, serverConfig);
    }
  }

  async connectToServer(serverId: string): Promise<MCPClient> {
    if (!this.serverConfigs.has(serverId)) {
      throw new Error(`Server ${serverId} not found in configuration`);
    }

    return MCPClient.connectToServer(serverId);
  }

  async connectToAllServers(): Promise<Map<string, MCPClient>> {
    const results = new Map<string, MCPClient>();
    const errors: Array<{ serverId: string; error: Error }> = [];

    for (const [serverId, config] of this.serverConfigs) {
      if (!config.enabled) {
        continue;
      }

      try {
        const client = await this.connectToServer(serverId);
        results.set(serverId, client);
      } catch (error) {
        errors.push({ serverId, error: error as Error });
        console.error(`Failed to connect to server ${serverId}:`, error);
      }
    }

    if (errors.length > 0) {
      console.warn(`Failed to connect to ${errors.length} server(s):`, 
        errors.map(e => e.serverId).join(', '));
    }

    return results;
  }

  async disconnectFromServer(serverId: string): Promise<void> {
    await MCPClient.disconnectFromServer(serverId);
  }

  async disconnectAllServers(): Promise<void> {
    await MCPClient.disconnectAllServers();
  }

  getServerStatus(): ServerStatus[] {
    return MCPClient.getServerStatus();
  }

  getConnectedServers(): string[] {
    return MCPClient.getConnectedServers();
  }

  isServerConnected(serverId: string): boolean {
    return MCPClient.isServerConnected(serverId);
  }

  getServerConfig(serverId: string): MCPServerConfig | undefined {
    return this.serverConfigs.get(serverId);
  }

  getAllServerConfigs(): MCPServerConfig[] {
    return Array.from(this.serverConfigs.values());
  }

  getEnabledServerConfigs(): MCPServerConfig[] {
    return this.getAllServerConfigs().filter(config => config.enabled);
  }
}
