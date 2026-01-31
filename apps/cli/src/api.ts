import type { APIResponse, SystemHealth, Tokenomics } from '@amicus/types/dashboard';

const API_BASE = process.env.AMICUS_API_URL || 'http://localhost:3000';

async function fetchJSON<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
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
