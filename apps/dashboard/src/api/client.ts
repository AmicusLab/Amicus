import type { APIResponse, SystemHealth, Tokenomics, LLMProviderStatus, MCPServerStatus } from '@amicus/types/dashboard';

const API_BASE = '/api';
const API_KEY = import.meta.env.VITE_AMICUS_API_KEY || '';

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
  return fetchJSON('/status');
}

export async function getTasks(): Promise<APIResponse<{
  scheduled: Array<{ taskId: string; cronExpression: string }>;
  running: string[];
  count: { scheduled: number; running: number };
}>> {
  return fetchJSON('/tasks');
}

export async function pauseTask(taskId: string): Promise<APIResponse<{ taskId: string; action: string }>> {
  return fetchJSON(`/tasks/${taskId}/pause`, { method: 'POST' });
}

export async function resumeTask(taskId: string): Promise<APIResponse<{ taskId: string; action: string }>> {
  return fetchJSON(`/tasks/${taskId}/resume`, { method: 'POST' });
}

export async function cancelTask(taskId: string): Promise<APIResponse<{ taskId: string; action: string }>> {
  return fetchJSON(`/tasks/${taskId}/cancel`, { method: 'POST' });
}

export async function emergencyStop(): Promise<APIResponse<{ action: string; cancelledCount: number; cancelledIds: string[] }>> {
  return fetchJSON('/tasks/emergency-stop', { method: 'POST' });
}

export async function getTokenomics(): Promise<APIResponse<Tokenomics>> {
  return fetchJSON('/tokenomics');
}

export async function getProviders(): Promise<APIResponse<LLMProviderStatus[]>> {
  return fetchJSON('/llm-providers');
}

export async function getMCPServers(): Promise<APIResponse<MCPServerStatus[]>> {
  return fetchJSON('/mcp-servers');
}
