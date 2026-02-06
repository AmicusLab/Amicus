import { Hono } from 'hono';
import type { ChatConfig, Message, MessageRole } from '@amicus/types/chat';
import {
  ChatEngine,
  SimpleToolRegistry,
  createFileTool,
  TOOL_EXECUTION_PROMPT,
} from '@amicus/core';
import { providerService } from '../services/ProviderService.js';
import { ToolExecutor } from '../services/ToolExecutor.js';
import { MCPClient, SafeMCPClient } from '@amicus/mcp-client';

type ChatRequestBody = {
  messages: Message[];
  config?: ChatConfig;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMessageRole(value: unknown): value is MessageRole {
  return value === 'user' || value === 'assistant' || value === 'system';
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value)) return false;
  return isMessageRole(value.role) && typeof value.content === 'string';
}

function parseChatRequestBody(value: unknown): ChatRequestBody | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.messages)) return null;
  if (!value.messages.every(isMessage)) return null;

  const config = value.config;
  if (config !== undefined && !isRecord(config)) return null;

  return {
    messages: value.messages,
    ...(config !== undefined ? { config: config as ChatConfig } : {}),
  };
}

let mcpClient: MCPClient | null = null;
let toolExecutor: ToolExecutor | null = null;
let chatEngine: ChatEngine | null = null;

let initializationPromise: Promise<void> | null = null;

async function initializeServices() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    if (!providerService.isInitialized()) {
      await providerService.initialize();
    }

    if (!chatEngine) {
      const toolRegistry = new SimpleToolRegistry();
      toolRegistry.register(createFileTool as import('@amicus/core').Tool);

      chatEngine = new ChatEngine({
        providerRegistry: providerService.getRegistry(),
        toolRegistry,
      });
    }

    if (!mcpClient) {
      mcpClient = new MCPClient({
        name: 'amicus-daemon',
        version: '0.1.0',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
      });

      await mcpClient.connect();

      const safeMcpClient = new SafeMCPClient(mcpClient);
      toolExecutor = new ToolExecutor(safeMcpClient);
    }
  })();

  return initializationPromise;
}

export const chatRoutes = new Hono();

chatRoutes.post('/', async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const body = parseChatRequestBody(rawBody);
  if (!body) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  try {
    await initializeServices();

    if (!chatEngine || !toolExecutor) {
      throw new Error('Service initialization failed');
    }

    const messages = [...body.messages];
    const result = await chatEngine.chat(messages, {
      ...body.config,
      systemPrompt: body.config?.systemPrompt ?? TOOL_EXECUTION_PROMPT,
    });

    if (result.response.type !== 'text') {
      return c.json({
        response: 'Error: Unexpected response type',
        usage: result.usage,
      });
    }

    return c.json({
      response: result.response.content,
      usage: result.usage,
    });
  } catch (error) {
    console.error('[Chat] Request failed:', error);
    return c.json({ error: 'LLM API call failed' }, 500);
  }
});

chatRoutes.post('/undo', async (c) => {
  try {
    await initializeServices();

    if (!chatEngine) {
      throw new Error('ChatEngine not initialized');
    }

    const result = await chatEngine.undo();
    return c.json({ message: result });
  } catch (error) {
    console.error('[Chat] Undo failed:', error);
    return c.json({ error: 'Undo operation failed' }, 500);
  }
});
