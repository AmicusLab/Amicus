import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { APIResponse, LLMProviderStatus, MCPServerStatus } from '@amicus/types/dashboard';
import { providerService } from '../services/ProviderService.js';
import { mcpService } from '../services/MCPService.js';

export const providerRoutes = new Hono();

function response<T>(data: T): APIResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: randomUUID(),
      timestamp: Date.now(),
      duration: 0,
    },
  };
}

providerRoutes.get('/llm-providers', (c) => {
  const statuses = providerService.getProviderStatuses();
  return c.json(response<LLMProviderStatus[]>(statuses));
});

providerRoutes.get('/mcp-servers', async (c) => {
  const manager = mcpService.getManager();
  const allServerConfigs = manager.getAllServerConfigs();
  const connectedServers = manager.getConnectedServers();
  
  const statuses: MCPServerStatus[] = await Promise.all(
    allServerConfigs.map(async (serverConfig) => {
      const isConnected = connectedServers.includes(serverConfig.id);
      let toolCount = 0;
      
      if (isConnected) {
        try {
          const client = await manager.connectToServer(serverConfig.id);
          const tools = await client.discoverTools();
          toolCount = tools.length;
        } catch (error) {
          console.warn(`[ProviderRoutes] Failed to discover tools from ${serverConfig.id}:`, error);
        }
      }
      
      const status: MCPServerStatus = {
        id: serverConfig.id,
        name: serverConfig.name,
        enabled: serverConfig.enabled,
        connected: isConnected,
        toolCount,
      };
      
      return status;
    })
  );
  
  return c.json(response<MCPServerStatus[]>(statuses));
});
