import type { APIResponse, SystemHealth, Tokenomics, TokenUsage } from '@amicus/types/dashboard';
import type { Message, ChatConfig } from '@amicus/types/chat';

const API_BASE = process.env.AMICUS_API_URL || 'http://localhost:3000';
const API_KEY = process.env.AMICUS_API_KEY;

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers as Record<string, string>,
  };

  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export async function getStatus(): Promise<APIResponse<SystemHealth>> {
  return fetchJSON('/api/status');
}

export async function getTasks(): Promise<APIResponse<{
  scheduled: Array<{ taskId: string; cronExpression: string }>;
  running: string[];
  count: { scheduled: number; running: number };
}>> {
  return fetchJSON('/api/tasks');
}

export async function getTokenomics(): Promise<APIResponse<Tokenomics>> {
  return fetchJSON('/api/tokenomics');
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function waitForDaemon(maxRetries = 30, interval = 1000): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (await healthCheck()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

export async function sendChat(
  messages: Message[],
  config?: ChatConfig
): Promise<{ response: string; usage: TokenUsage }> {
  return fetchJSON('/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, config }),
  });
}

export async function undoChat(): Promise<{ message: string }> {
  return fetchJSON('/chat/undo', {
    method: 'POST',
  });
}
