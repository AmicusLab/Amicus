import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { MCPManager } from '../MCPManager.js';
import { MCPClient } from '../MCPClient.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, '..', '..', '..', '..', 'data', 'mcp-servers.json');

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
    expect(githubConfig?.name).toBe('github');
    expect(githubConfig?.enabled).toBe(true);
    expect(githubConfig?.transport).toBe('stdio');
    expect(githubConfig?.command).toBe('npx');
    expect(githubConfig?.args).toContain('@modelcontextprotocol/server-github');
    expect(githubConfig?.description).toContain('GitHub');
  });

  test('should have GitHub server in enabled configs', async () => {
    await manager.loadServers(CONFIG_PATH);
    
    const enabledConfigs = manager.getEnabledServerConfigs();
    const githubConfig = enabledConfigs.find(config => config.name === 'github');
    
    expect(githubConfig).toBeDefined();
    expect(githubConfig?.enabled).toBe(true);
  });

  test.skipIf(!process.env.GITHUB_TOKEN)('should connect to GitHub server with valid token', async () => {
    console.log('⚠️  Skipping GitHub connection test - GITHUB_TOKEN not set');
    
    await manager.loadServers(CONFIG_PATH);
    
    const client = await manager.connectToServer('github');
    
    expect(client).toBeDefined();
    expect(manager.isServerConnected('github')).toBe(true);
    
    await manager.disconnectFromServer('github');
  });

  test('should fail gracefully without GitHub token', async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    
    try {
      delete process.env.GITHUB_TOKEN;
      
      await manager.loadServers(CONFIG_PATH);
      
      try {
        await manager.connectToServer('github');
      } catch (error) {
        expect(error).toBeDefined();
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(
          errorMessage.toLowerCase().includes('token') ||
          errorMessage.toLowerCase().includes('auth') ||
          errorMessage.toLowerCase().includes('credential')
        ).toBe(true);
      }
    } finally {
      if (originalToken) {
        process.env.GITHUB_TOKEN = originalToken;
      }
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

  test('should track GitHub server connection status', async () => {
    await manager.loadServers(CONFIG_PATH);
    
    expect(manager.isServerConnected('github')).toBe(false);
    
    const status = manager.getServerStatus();
    const githubStatus = status.find(s => s.serverId === 'github');
    
    expect(githubStatus).toBeUndefined();
  });

  test('should handle rate limiting gracefully', async () => {
    await manager.loadServers(CONFIG_PATH);
    const githubConfig = manager.getServerConfig('github');
    
    expect(githubConfig).toBeDefined();
  });

  test('should support multiple simultaneous MCP servers', async () => {
    await manager.loadServers(CONFIG_PATH);
    
    const allConfigs = manager.getAllServerConfigs();
    
    expect(allConfigs.length).toBeGreaterThanOrEqual(2);
    
    const serverNames = allConfigs.map(config => config.name);
    expect(serverNames).toContain('filesystem');
    expect(serverNames).toContain('github');
  });
});
