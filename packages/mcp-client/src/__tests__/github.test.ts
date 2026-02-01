import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { MCPManager } from '../MCPManager.js';
import { MCPClient } from '../MCPClient.js';
import { join } from 'path';

const CONFIG_PATH = join(__dirname, '..', '..', '__tests__', 'test-mcp-servers.json');

describe('GitHub MCP Integration', () => {
  let manager: MCPManager;

  beforeEach(() => {
    manager = new MCPManager();
  });

  afterEach(async () => {
    await MCPClient.disconnectAllServers();
  });

  test('should load GitHub server config from mcp-servers.json', async () => {
    await manager.loadServers(CONFIG_PATH);
    
    const githubConfig = manager.getServerConfig('github');
    
    expect(githubConfig).toBeDefined();
    expect(githubConfig?.id).toBe('github');
    expect(githubConfig?.name).toBe('GitHub API');
    expect(githubConfig?.enabled).toBe(false);
    expect(githubConfig?.transport).toBe('stdio');
    expect(githubConfig?.command).toBe('npx');
    expect(githubConfig?.args).toContain('@modelcontextprotocol/server-github');
  });

  test('should have filesystem server in enabled configs', async () => {
    await manager.loadServers(CONFIG_PATH);
    
    const enabledConfigs = manager.getEnabledServerConfigs();
    const filesystemConfig = enabledConfigs.find(config => config.id === 'filesystem');
    
    expect(filesystemConfig).toBeDefined();
    expect(filesystemConfig?.enabled).toBe(true);
  });

  test.skipIf(!process.env.GITHUB_TOKEN)('should connect to GitHub server with valid token', async () => {
    console.log('⚠️  Skipping GitHub connection test - GITHUB_TOKEN not set');
    
    await manager.loadServers(CONFIG_PATH);
    
    const client = await manager.connectToServer('github');
    
    expect(client).toBeDefined();
    expect(manager.isServerConnected('github')).toBe(true);
    
    await manager.disconnectFromServer('github');
  });

  test('should fail gracefully when connecting to disabled server', async () => {
    await manager.loadServers(CONFIG_PATH);
    
    try {
      await manager.connectToServer('github');
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage.toLowerCase()).toContain('disabled');
    }
  });

  test.skipIf(!process.env.GITHUB_TOKEN)('should discover GitHub tools after connection', async () => {
    console.log('⚠️  Skipping GitHub tool discovery test - GITHUB_TOKEN not set');
    
    await manager.loadServers(CONFIG_PATH);
    const client = await manager.connectToServer('github');
    
    const tools = await client.discoverTools();
    
    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    
    const toolNames = tools.map(tool => tool.name);
    console.log('📋 Available GitHub tools:', toolNames);
    
    const hasIssueTool = toolNames.some(name => name.toLowerCase().includes('issue'));
    const hasPRTool = toolNames.some(name => 
      name.toLowerCase().includes('pull') || name.toLowerCase().includes('pr')
    );
    
    expect(hasIssueTool || hasPRTool).toBe(true);
    
    await manager.disconnectFromServer('github');
  });

  test('should handle connection errors gracefully', async () => {
    await manager.loadServers(CONFIG_PATH);
    
    try {
      await manager.connectToServer('non-existent-server');
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage.length).toBeGreaterThan(0);
    }
  });

  test('should track server connection status', async () => {
    await manager.loadServers(CONFIG_PATH);
    
    expect(manager.isServerConnected('github')).toBe(false);
    expect(manager.isServerConnected('filesystem')).toBe(false);
    
    const status = manager.getServerStatus();
    expect(status.length).toBe(0);
  });

  test('should support multiple simultaneous MCP servers', async () => {
    await manager.loadServers(CONFIG_PATH);
    
    const allConfigs = manager.getAllServerConfigs();
    
    expect(allConfigs.length).toBeGreaterThanOrEqual(2);
    
    const serverIds = allConfigs.map(config => config.id);
    expect(serverIds).toContain('filesystem');
    expect(serverIds).toContain('github');
    
    const serverNames = allConfigs.map(config => config.name);
    expect(serverNames).toContain('Local Filesystem');
    expect(serverNames).toContain('GitHub API');
  });

  test('should load filesystem server config', async () => {
    await manager.loadServers(CONFIG_PATH);
    
    const fsConfig = manager.getServerConfig('filesystem');
    
    expect(fsConfig).toBeDefined();
    expect(fsConfig?.id).toBe('filesystem');
    expect(fsConfig?.name).toBe('Local Filesystem');
    expect(fsConfig?.enabled).toBe(true);
    expect(fsConfig?.transport).toBe('stdio');
    expect(fsConfig?.command).toBe('npx');
    expect(fsConfig?.args).toContain('@modelcontextprotocol/server-filesystem');
  });
});
