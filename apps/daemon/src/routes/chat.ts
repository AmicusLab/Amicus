import { Hono } from 'hono';
import type { ChatConfig, Message, MessageRole } from '@amicus/types/chat';
import { ChatEngine } from '@amicus/core';
import { providerService } from '../services/ProviderService.js';
import { ToolExecutor } from '../services/ToolExecutor.js';
import { MCPClient } from '@amicus/mcp-client';

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

async function initializeMCP() {
  if (mcpClient) return;

  mcpClient = new MCPClient({
    name: 'amicus-daemon',
    version: '0.1.0',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  });

  await mcpClient.connect();
  toolExecutor = new ToolExecutor(mcpClient);
}

export const chatRoutes = new Hono();

let chatEngine: ChatEngine | null = null;

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
    if (!providerService.isInitialized()) {
      await providerService.initialize();
    }

    if (!chatEngine) {
      chatEngine = new ChatEngine({
        providerRegistry: providerService.getRegistry(),
      });
    }

    await initializeMCP();

    if (!toolExecutor) {
      throw new Error('Tool executor initialization failed');
    }

    const messages = [...body.messages];
    let result = await chatEngine.chat(messages, body.config);

    if (result.response.type === 'tool_call') {
      const toolResult = await toolExecutor.execute(
        result.response.toolCall.tool,
        result.response.toolCall.args
      );

      messages.push({
        role: 'assistant',
        content: JSON.stringify(toolResult),
      });

      result = await chatEngine.chat(messages, body.config);

      if (result.response.type === 'tool_call') {
        return c.json({
          response: 'Error: Multiple sequential tool calls not supported in this version',
          usage: result.usage,
        });
      }
    }

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
