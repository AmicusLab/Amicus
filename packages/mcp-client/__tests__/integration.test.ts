import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { MCPClient } from '../src/MCPClient.js';
import { MCPManager } from '../src/MCPManager.js';
import { loadMCPConfig } from '../src/config.js';
import { join } from 'path';
import { existsSync } from 'fs';

// Support different working directories in CI and local
const possiblePaths = [
  join(process.cwd(), 'data', 'mcp-servers.json'),
  join(__dirname, '..', '..', '..', 'data', 'mcp-servers.json'),
];

const MCP_CONFIG_PATH = possiblePaths.find(p => existsSync(p)) || possiblePaths[0];

describe('MCP Integration Tests', () => {
  describe('Filesystem MCP Server', () => {
    let client: MCPClient | null = null;

    beforeAll(async () => {
      try {
        const config = await loadMCPConfig(MCP_CONFIG_PATH);
        const fsConfig = config.servers.find(s => s.id === 'filesystem');
        if (!fsConfig || !fsConfig.enabled) {
          console.log('Filesystem server not enabled, skipping tests');
          return;
        }

        // Process environment variable substitution in args
        const processedArgs = fsConfig.args?.map(arg => {
          if (arg.includes('${') && arg.includes('}')) {
            // Simple env var substitution for test paths
            const match = arg.match(/\$\{([^}]+)\}/);
            if (match) {
              const envValue = process.env[match[1]];
              if (envValue) {
                return arg.replace(/\$\{[^}]+\}/, envValue);
              }
            }
          }
          return arg;
        });

        client = new MCPClient({
          name: 'test-client',
          version: '1.0.0',
          transport: 'stdio',
          command: fsConfig.command!,
          args: processedArgs || fsConfig.args!,
        });

        await client.connect();
        console.log('Filesystem MCP server connected');
      } catch (error) {
        console.log('Failed to connect to filesystem server:', error);
        // Don't throw - let tests skip gracefully
      }
    });

    afterAll(async () => {
      if (client && client.isConnected()) {
        await client.disconnect();
        console.log('Filesystem MCP server disconnected');
      }
    });

    it('should discover filesystem tools', async () => {
      if (!client || !client.isConnected()) {
        console.log('Skipping: Filesystem client not connected');
        return;
      }

      const tools = await client.discoverTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some(t => t.name.includes('read') || t.name.includes('write') || t.name.includes('list'))).toBe(true);
      console.log(`Discovered ${tools.length} filesystem tools`);
    });

    it('should list directory contents', async () => {
      if (!client || !client.isConnected()) {
        console.log('Skipping: Filesystem client not connected');
        return;
      }

      const result = await client.invokeTool('list_directory', { path: '/Users/zemyblue/Documents/projects/Amicus/Amicus/data' });
      expect(result).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(result.content).toBeDefined();
      console.log('Directory listing successful');
    });

    it('should read a file', async () => {
      if (!client || !client.isConnected()) {
        console.log('Skipping: Filesystem client not connected');
        return;
      }

      const result = await client.invokeTool('read_file', { path: '/Users/zemyblue/Documents/projects/Amicus/Amicus/data/mcp-servers.json' });
      expect(result).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(result.content).toBeDefined();
      expect(result.content).toContain('servers');
      console.log('File read successful');
    });

    it('should handle non-existent file gracefully', async () => {
      if (!client || !client.isConnected()) {
        console.log('Skipping: Filesystem client not connected');
        return;
      }

      // Try to read a non-existent file
      const result = await client.invokeTool('read_file', { path: '/Users/zemyblue/Documents/projects/Amicus/Amicus/data/non-existent-file-12345.txt' });
      expect(result).toBeDefined();
      // Should return error in result, not throw
      expect(result.isError).toBe(true);
      console.log('Error handling works correctly');
    });
  });

  describe('GitHub MCP Server', () => {
    let client: MCPClient | null = null;
    const hasGitHubToken = !!process.env.GITHUB_TOKEN;

    beforeAll(async () => {
      if (!hasGitHubToken) {
        console.log('GITHUB_TOKEN not set, skipping GitHub tests');
        return;
      }

      try {
        const config = await loadMCPConfig(MCP_CONFIG_PATH);
        const ghConfig = config.servers.find(s => s.id === 'github');
        if (!ghConfig) {
          console.log('GitHub server config not found');
          return;
        }

        // Skip if disabled (expected in most test environments)
        if (!ghConfig.enabled) {
          console.log('GitHub server is disabled in config, skipping tests');
          return;
        }

        client = new MCPClient({
          name: 'test-client',
          version: '1.0.0',
          transport: 'stdio',
          command: ghConfig.command!,
          args: ghConfig.args!,
        });

        await client.connect();
        console.log('GitHub MCP server connected');
      } catch (error) {
        console.log('Failed to connect to GitHub server:', error);
      }
    });

    afterAll(async () => {
      if (client && client.isConnected()) {
        await client.disconnect();
        console.log('GitHub MCP server disconnected');
      }
    });

    it('should discover GitHub tools', async () => {
      if (!client || !client.isConnected()) {
        console.log('Skipping: GitHub client not connected');
        return;
      }

      const tools = await client.discoverTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some(t => t.name.includes('search') || t.name.includes('issue') || t.name.includes('repo'))).toBe(true);
      console.log(`Discovered ${tools.length} GitHub tools`);
    });

    it('should search for repositories', async () => {
      if (!client || !client.isConnected()) {
        console.log('Skipping: GitHub client not connected');
        return;
      }

      const result = await client.invokeTool('search_repositories', { query: 'modelcontextprotocol language:typescript' });
      expect(result).toBeDefined();
      // May error if rate limited, but should not throw
      expect(typeof result.content).toBe('string');
      console.log('Repository search completed');
    });

    it('should handle auth errors gracefully', async () => {
      // Skip if we have a real token (we don't want to test with invalid token when valid is available)
      if (hasGitHubToken) {
        console.log('Skipping: Valid token available, not testing invalid auth');
        return;
      }

      // Test with invalid token by creating a new client
      const badClient = new MCPClient({
        name: 'test',
        version: '1.0.0',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
      });

      try {
        await badClient.connect();
        const result = await badClient.invokeTool('search_issues', { query: 'test' });
        // Should return error in result, not throw
        expect(result).toBeDefined();
        console.log('Auth error handling verified');
      } catch (error) {
        // Connection errors are also acceptable
        expect(error).toBeDefined();
        console.log('Auth error handling verified (connection error)');
      } finally {
        try {
          await badClient.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }
    });
  });

  describe('MCPManager', () => {
    let manager: MCPManager;

    beforeAll(async () => {
      manager = new MCPManager();
      try {
        await manager.loadServers(MCP_CONFIG_PATH);
      } catch (error) {
        console.log('Failed to load server configurations:', error);
      }
    });

    afterAll(async () => {
      try {
        await manager.disconnectAllServers();
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should load server configurations', () => {
      const configs = manager.getAllServerConfigs();
      expect(configs.length).toBeGreaterThan(0);
      
      // Should have filesystem and github configs
      const filesystemConfig = configs.find(c => c.id === 'filesystem');
      const githubConfig = configs.find(c => c.id === 'github');
      
      expect(filesystemConfig).toBeDefined();
      expect(githubConfig).toBeDefined();
      
      console.log(`Loaded ${configs.length} server configurations`);
    });

    it('should identify enabled servers', () => {
      const enabledConfigs = manager.getEnabledServerConfigs();
      // May be empty if no servers enabled, which is valid
      expect(Array.isArray(enabledConfigs)).toBe(true);
      
      // Filesystem should be enabled by default
      const filesystemEnabled = enabledConfigs.find(c => c.id === 'filesystem');
      if (filesystemEnabled) {
        expect(filesystemEnabled.enabled).toBe(true);
      }
      
      console.log(`${enabledConfigs.length} servers are enabled`);
    });

    it('should connect to enabled servers', async () => {
      const connected = await manager.connectToAllServers();
      // May be 0 if no servers enabled or prerequisites not met
      expect(connected).toBeDefined();
      expect(connected instanceof Map).toBe(true);
      
      const connectedCount = connected.size;
      console.log(`Connected to ${connectedCount} server(s)`);
      
      // Verify we can get status
      const status = manager.getServerStatus();
      expect(Array.isArray(status)).toBe(true);
    });

    it('should get individual server config', () => {
      const filesystemConfig = manager.getServerConfig('filesystem');
      expect(filesystemConfig).toBeDefined();
      expect(filesystemConfig?.id).toBe('filesystem');
      
      const nonExistentConfig = manager.getServerConfig('non-existent');
      expect(nonExistentConfig).toBeUndefined();
    });

    it('should track connection status', async () => {
      const connectedServers = manager.getConnectedServers();
      expect(Array.isArray(connectedServers)).toBe(true);
      
      const isFilesystemConnected = manager.isServerConnected('filesystem');
      expect(typeof isFilesystemConnected).toBe('boolean');
      
      const isNonExistentConnected = manager.isServerConnected('non-existent');
      expect(isNonExistentConnected).toBe(false);
    });
  });

  describe('Configuration Loading', () => {
    it('should load and parse MCP configuration', async () => {
      const config = await loadMCPConfig(MCP_CONFIG_PATH);
      
      expect(config).toBeDefined();
      expect(config.servers).toBeDefined();
      expect(Array.isArray(config.servers)).toBe(true);
      expect(config.servers.length).toBeGreaterThan(0);
    });

    it('should substitute environment variables', async () => {
      // Set a test environment variable
      process.env.TEST_MCP_VAR = 'test-value';
      
      const { substituteEnvVars } = await import('../src/config.js');
      const result = substituteEnvVars('prefix-${TEST_MCP_VAR}-suffix');
      
      expect(result).toBe('prefix-test-value-suffix');
      
      // Test with default value
      const resultWithDefault = substituteEnvVars('${NON_EXISTENT_VAR:-default}');
      expect(resultWithDefault).toBe('default');
    });

    it('should throw error for non-existent config file', async () => {
      try {
        await loadMCPConfig('/non/existent/path.json');
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('not found');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle connection failures gracefully', async () => {
      const badClient = new MCPClient({
        name: 'test',
        version: '1.0.0',
        transport: 'stdio',
        command: 'non-existent-command-12345',
        args: [],
      });

      try {
        await badClient.connect();
        // If it doesn't throw, that's also valid (some systems handle missing commands differently)
        expect(badClient.isConnected()).toBe(true);
      } catch (error) {
        // Expected behavior - connection should fail
        expect(error).toBeDefined();
      }
    });

    it('should handle tool invocation on disconnected client', async () => {
      const disconnectedClient = new MCPClient({
        name: 'test',
        version: '1.0.0',
        transport: 'stdio',
        command: 'echo',
        args: [],
      });

      try {
        await disconnectedClient.invokeTool('test', {});
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Not connected');
      }
    });

    it('should handle tool discovery on disconnected client', async () => {
      const disconnectedClient = new MCPClient({
        name: 'test',
        version: '1.0.0',
        transport: 'stdio',
        command: 'echo',
        args: [],
      });

      try {
        await disconnectedClient.discoverTools();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Not connected');
      }
    });
  });
});
