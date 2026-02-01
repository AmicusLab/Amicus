import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MCPManager } from './MCPManager.js';
import { MCPClient } from './MCPClient.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import type { MCPServersConfig } from './config.js';

const TEST_DIR = join(import.meta.dir, '..', '..', '__test_temp__');
const TEST_CONFIG_PATH = join(TEST_DIR, 'test-mcp-servers.json');

describe('MCPManager', () => {
  let manager: MCPManager;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    
    const testConfig: MCPServersConfig = {
      servers: [
        {
          id: 'test-server-1',
          name: 'test-server-1',
          enabled: true,
          transport: 'stdio',
          command: 'echo',
          args: ['test'],
          description: 'Test server 1',
        },
        {
          id: 'test-server-2',
          name: 'test-server-2',
          enabled: false,
          transport: 'stdio',
          command: 'echo',
          args: ['test'],
          description: 'Test server 2 (disabled)',
        },
      ],
    };
    
    await writeFile(TEST_CONFIG_PATH, JSON.stringify(testConfig, null, 2));
    manager = new MCPManager();
  });

  afterEach(async () => {
    await MCPClient.disconnectAllServers();
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('loadServers', () => {
    it('should load server configuration from file', async () => {
      await manager.loadServers(TEST_CONFIG_PATH);
      
      const configs = manager.getAllServerConfigs();
      expect(configs).toHaveLength(2);
      expect(configs[0]?.name).toBe('test-server-1');
      expect(configs[1]?.name).toBe('test-server-2');
    });

    it('should throw error when config file does not exist', async () => {
      await expect(manager.loadServers('/nonexistent/config.json')).rejects.toThrow();
    });
  });

  describe('connectToServer', () => {
    it('should throw error when server config is not loaded', async () => {
      await expect(manager.connectToServer('test-server-1')).rejects.toThrow('not found in configuration');
    });

    it('should throw error when server is not found', async () => {
      await manager.loadServers(TEST_CONFIG_PATH);
      await expect(manager.connectToServer('nonexistent-server')).rejects.toThrow('not found in configuration');
    });

    it('should throw error when server is disabled', async () => {
      await manager.loadServers(TEST_CONFIG_PATH);
      await MCPClient.loadServersConfig(TEST_CONFIG_PATH);
      await expect(manager.connectToServer('test-server-2')).rejects.toThrow('disabled');
    });
  });

  describe('connectToAllServers', () => {
    it('should connect to all enabled servers', async () => {
      await manager.loadServers(TEST_CONFIG_PATH);
      
      const connected = await manager.connectToAllServers();
      expect(connected.size).toBe(0);
    });
  });

  describe('getServerStatus', () => {
    it('should return empty array when no servers are connected', () => {
      const status = manager.getServerStatus();
      expect(status).toEqual([]);
    });
  });

  describe('getConnectedServers', () => {
    it('should return empty array initially', () => {
      expect(manager.getConnectedServers()).toEqual([]);
    });
  });

  describe('isServerConnected', () => {
    it('should return false for unconnected server', () => {
      expect(manager.isServerConnected('test-server-1')).toBe(false);
    });
  });

  describe('getServerConfig', () => {
    it('should return config for existing server', async () => {
      await manager.loadServers(TEST_CONFIG_PATH);
      
      const config = manager.getServerConfig('test-server-1');
      expect(config).toBeDefined();
      expect(config?.name).toBe('test-server-1');
      expect(config?.enabled).toBe(true);
    });

    it('should return undefined for non-existing server', async () => {
      await manager.loadServers(TEST_CONFIG_PATH);
      
      const config = manager.getServerConfig('nonexistent');
      expect(config).toBeUndefined();
    });
  });

  describe('getEnabledServerConfigs', () => {
    it('should return only enabled server configs', async () => {
      await manager.loadServers(TEST_CONFIG_PATH);
      
      const configs = manager.getEnabledServerConfigs();
      expect(configs).toHaveLength(1);
      expect(configs[0]?.name).toBe('test-server-1');
    });
  });
});
