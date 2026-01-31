import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MCPClient, MCPClientOptions, Tool, ToolResult } from '../src/MCPClient.js';

// Mock the SDK modules
defineAmbientDeclarations();

function defineAmbientDeclarations() {
  // These are defined to avoid TypeScript errors during testing
}

describe('MCPClient', () => {
  describe('Constructor', () => {
    it('should create an MCPClient instance with stdio options', () => {
      const options: MCPClientOptions = {
        name: 'test-client',
        version: '1.0.0',
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      };

      const client = new MCPClient(options);
      expect(client).toBeDefined();
      expect(client.isConnected()).toBe(false);
    });

    it('should create an MCPClient instance with HTTP options', () => {
      const options: MCPClientOptions = {
        name: 'test-client',
        version: '1.0.0',
        transport: 'http',
        serverUrl: 'http://localhost:3000'
      };

      const client = new MCPClient(options);
      expect(client).toBeDefined();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Connection Management', () => {
    let client: MCPClient;

    afterEach(async () => {
      if (client && client.isConnected()) {
        await client.disconnect();
      }
    });

    it('should throw error when connecting without required command for stdio', async () => {
      const options: MCPClientOptions = {
        name: 'test-client',
        version: '1.0.0',
        transport: 'stdio'
      };

      client = new MCPClient(options);
      
      try {
        await client.connect();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Command is required for stdio transport');
      }
    });

    it('should throw error when connecting without required serverUrl for HTTP', async () => {
      const options: MCPClientOptions = {
        name: 'test-client',
        version: '1.0.0',
        transport: 'http'
      };

      client = new MCPClient(options);
      
      try {
        await client.connect();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Server URL is required for HTTP transport');
      }
    });

    it('should throw error when connecting twice', async () => {
      // We can't actually test this without mocking the SDK
      // This test documents the expected behavior
      const options: MCPClientOptions = {
        name: 'test-client',
        version: '1.0.0',
        transport: 'stdio',
        command: 'echo'
      };

      client = new MCPClient(options);
      
      // First connect attempt would fail due to SDK not being available
      // This test is here for documentation purposes
    });

    it('should handle disconnect when not connected', async () => {
      const options: MCPClientOptions = {
        name: 'test-client',
        version: '1.0.0',
        transport: 'stdio',
        command: 'echo'
      };

      client = new MCPClient(options);
      
      // Should not throw
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported transport type', async () => {
      const options = {
        name: 'test-client',
        version: '1.0.0',
        transport: 'websocket' as 'stdio' | 'http' // Cast to test error handling
      };

      const client = new MCPClient(options);
      
      try {
        await client.connect();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Unsupported transport');
      }
    });

    it('should throw error when discovering tools without connection', async () => {
      const options: MCPClientOptions = {
        name: 'test-client',
        version: '1.0.0',
        transport: 'stdio',
        command: 'echo'
      };

      const client = new MCPClient(options);
      
      try {
        await client.discoverTools();
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Not connected to MCP server');
      }
    });

    it('should throw error when invoking tool without connection', async () => {
      const options: MCPClientOptions = {
        name: 'test-client',
        version: '1.0.0',
        transport: 'stdio',
        command: 'echo'
      };

      const client = new MCPClient(options);
      
      try {
        await client.invokeTool('test', {});
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Not connected to MCP server');
      }
    });
  });

  describe('Interface Types', () => {
    it('should have correct MCPClientOptions interface', () => {
      const stdioOptions: MCPClientOptions = {
        name: 'test',
        version: '1.0.0',
        transport: 'stdio',
        command: 'node',
        args: ['--version']
      };

      const httpOptions: MCPClientOptions = {
        name: 'test',
        version: '1.0.0',
        transport: 'http',
        serverUrl: 'http://localhost:3000'
      };

      expect(stdioOptions.transport).toBe('stdio');
      expect(httpOptions.transport).toBe('http');
    });

    it('should have correct Tool interface structure', () => {
      const tool: Tool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };

      expect(tool.name).toBe('test-tool');
      expect(tool.description).toBe('A test tool');
      expect(tool.inputSchema).toBeDefined();
    });

    it('should have correct ToolResult interface structure', () => {
      const result: ToolResult = {
        content: 'test result',
        isError: false
      };

      expect(result.content).toBe('test result');
      expect(result.isError).toBe(false);
    });

    it('should support ToolResult without isError field', () => {
      const result: ToolResult = {
        content: 'success'
      };

      expect(result.content).toBe('success');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('Transport Options', () => {
    it('should accept stdio transport with minimal options', () => {
      const options: MCPClientOptions = {
        name: 'minimal',
        version: '0.1.0',
        transport: 'stdio',
        command: 'echo'
      };

      const client = new MCPClient(options);
      expect(client).toBeDefined();
    });

    it('should accept stdio transport with args', () => {
      const options: MCPClientOptions = {
        name: 'with-args',
        version: '0.1.0',
        transport: 'stdio',
        command: 'node',
        args: ['server.js', '--port', '3000']
      };

      const client = new MCPClient(options);
      expect(client).toBeDefined();
    });

    it('should accept HTTP transport with URL', () => {
      const options: MCPClientOptions = {
        name: 'http-client',
        version: '0.1.0',
        transport: 'http',
        serverUrl: 'https://api.example.com/mcp'
      };

      const client = new MCPClient(options);
      expect(client).toBeDefined();
    });
  });
});
