import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MCPManager } from '../src/MCPManager.js';
import { MCPClient, ToolResult } from '../src/MCPClient.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MCP_CONFIG_PATH = join(__dirname, '..', '..', '..', 'data', 'mcp-servers.json');
const GITHUB_SERVER_ID = 'github';
const FILESYSTEM_SERVER_ID = 'filesystem';

describe('GitHub MCP Integration', () => {
  let manager: MCPManager;

  beforeEach(() => {
    manager = new MCPManager();
  });

  afterEach(async () => {
    await MCPClient.disconnectAllServers();
  });

  describe('Configuration Loading', () => {
    it('should load GitHub server config from mcp-servers.json', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);

      const githubConfig = manager.getServerConfig(GITHUB_SERVER_ID);
      expect(githubConfig).toBeDefined();
      expect(githubConfig?.id).toBe(GITHUB_SERVER_ID);
      expect(githubConfig?.name).toBe('GitHub API');
      expect(githubConfig?.enabled).toBe(false);
      expect(githubConfig?.transport).toBe('stdio');
      expect(githubConfig?.command).toBe('npx');
      expect(githubConfig?.args).toContain('@modelcontextprotocol/server-github');
    });

    it('should load filesystem server config', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);

      const fsConfig = manager.getServerConfig(FILESYSTEM_SERVER_ID);
      expect(fsConfig).toBeDefined();
      expect(fsConfig?.id).toBe(FILESYSTEM_SERVER_ID);
      expect(fsConfig?.name).toBe('Local Filesystem');
      expect(fsConfig?.enabled).toBe(true);
      expect(fsConfig?.transport).toBe('stdio');
      expect(fsConfig?.command).toBe('npx');
      expect(fsConfig?.args).toContain('@modelcontextprotocol/server-filesystem');
    });
  });

  describe('Connection Management', () => {
    it.skipIf(!process.env.GITHUB_TOKEN)('should connect to GitHub server with valid token', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);

      const client = await manager.connectToServer(GITHUB_SERVER_ID);
      expect(client).toBeDefined();
      expect(manager.isServerConnected(GITHUB_SERVER_ID)).toBe(true);
    });

    it.skipIf(!process.env.GITHUB_TOKEN)('should disconnect from GitHub server', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);
      await manager.connectToServer(GITHUB_SERVER_ID);

      await manager.disconnectFromServer(GITHUB_SERVER_ID);
      expect(manager.isServerConnected(GITHUB_SERVER_ID)).toBe(false);
    });

    it('should fail when connecting to disabled server', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);

      await expect(manager.connectToServer(GITHUB_SERVER_ID)).rejects.toThrow('disabled');
    });
  });

  describe('Tool Discovery', () => {
    it.skipIf(!process.env.GITHUB_TOKEN)('should discover GitHub tools after connection', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);
      const client = await manager.connectToServer(GITHUB_SERVER_ID);

      const tools = await client.discoverTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);

      const toolNames = tools.map((t) => t.name);
      const expectedTools = [
        'create_issue',
        'get_issue',
        'update_issue',
        'list_issues',
        'search_code',
        'create_pull_request',
        'get_pull_request',
        'list_pull_requests'
      ];

      const hasExpectedTools = expectedTools.some((tool) => toolNames.includes(tool));
      expect(hasExpectedTools).toBe(true);
    });

    it.skipIf(!process.env.GITHUB_TOKEN)('should have proper tool schemas', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);
      const client = await manager.connectToServer(GITHUB_SERVER_ID);

      const tools = await client.discoverTools();
      expect(tools.length).toBeGreaterThan(0);

      const firstTool = tools[0];
      expect(firstTool).toHaveProperty('name');
      expect(firstTool).toHaveProperty('description');
      expect(firstTool).toHaveProperty('inputSchema');
      expect(firstTool.inputSchema).toHaveProperty('type');
      expect(firstTool.inputSchema.type).toBe('object');
    });
  });

  describe('Tool Invocation', () => {
    it.skipIf(!process.env.GITHUB_TOKEN)('should invoke list_issues tool', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);
      const client = await manager.connectToServer(GITHUB_SERVER_ID);

      const result = await client.invokeTool('list_issues', {
        owner: 'octocat',
        repo: 'Hello-World',
        state: 'open'
      });

      expect(result).toBeDefined();
      expect(result.isError).toBe(false);
    });

    it.skipIf(!process.env.GITHUB_TOKEN)('should handle invalid repository gracefully', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);
      const client = await manager.connectToServer(GITHUB_SERVER_ID);

      const result = await client.invokeTool('list_issues', {
        owner: 'nonexistent-repo-xyz123',
        repo: 'nonexistent',
        state: 'open'
      });

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it.skipIf(!process.env.GITHUB_TOKEN)('should handle multiple requests without crashing', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);
      const client = await manager.connectToServer(GITHUB_SERVER_ID);

      const requests = Array(3).fill(null).map(() =>
        client.invokeTool('list_issues', {
          owner: 'octocat',
          repo: 'Hello-World',
          state: 'open'
        })
      );

      const results = await Promise.all(requests);

      const hasSuccess = results.some((r) => !r.isError);
      expect(hasSuccess).toBe(true);
    });
  });

  describe('Server Status', () => {
    it('should show GitHub server as disconnected initially', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);

      expect(manager.isServerConnected(GITHUB_SERVER_ID)).toBe(false);
    });

    it.skipIf(!process.env.GITHUB_TOKEN)('should show GitHub server as connected after connection', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);
      await manager.connectToServer(GITHUB_SERVER_ID);

      const status = manager.getServerStatus();
      const githubStatus = status.find((s) => s.serverId === GITHUB_SERVER_ID);
      expect(githubStatus?.connected).toBe(true);
    });
  });

  describe('Integration with MCPManager', () => {
    it('should include filesystem server in enabled servers', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);

      const enabledServers = manager.getEnabledServerConfigs();
      const filesystemEnabled = enabledServers.some((s) => s.id === FILESYSTEM_SERVER_ID);
      expect(filesystemEnabled).toBe(true);
    });

    it('should not include disabled servers in enabled list', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);

      const enabledServers = manager.getEnabledServerConfigs();
      const githubEnabled = enabledServers.some((s) => s.id === GITHUB_SERVER_ID);
      expect(githubEnabled).toBe(false);
    });

    it.skipIf(!process.env.GITHUB_TOKEN)('should connect to enabled servers via connectToAllServers', async () => {
      await manager.loadServers(MCP_CONFIG_PATH);
      const connected = await manager.connectToAllServers();

      // Only filesystem should be connected (GitHub is disabled)
      expect(connected.has(FILESYSTEM_SERVER_ID)).toBe(true);
      expect(connected.has(GITHUB_SERVER_ID)).toBe(false);
    });
  });
});
