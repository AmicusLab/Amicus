export interface MCPServerConfig {
  name: string;
  enabled: boolean;
  transport: 'stdio' | 'http';
  command?: string;
  serverUrl?: string;
  args?: string[];
  description?: string;
  rootPath?: string;
}

export interface MCPServersConfig {
  servers: MCPServerConfig[];
  defaultServer?: string;
}
