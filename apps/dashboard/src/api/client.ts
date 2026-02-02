import type { APIResponse, SystemHealth, Tokenomics, LLMProviderStatus, MCPServerStatus } from '@amicus/types/dashboard';

const API_BASE = '/api';

const ADMIN_BASE = '/admin';

async function fetchJSONFromBase<T>(base: string, path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  return fetchJSONFromBase(API_BASE, path, options);
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

// --- Admin API (cookie-based) ---

export type AdminProviderView = {
  id: string;
  enabled: boolean;
  loaded: boolean;
  available: boolean;
  modelCount: number;
  error?: string;
};

export async function adminGetSession(): Promise<APIResponse<{ role: string }>> {
  return fetchJSONFromBase(ADMIN_BASE, '/session');
}

export async function adminPair(code: string): Promise<APIResponse<{ message: string }>> {
  return fetchJSONFromBase(ADMIN_BASE, '/pair', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function adminLogin(password: string): Promise<APIResponse<{ message: string }>> {
  return fetchJSONFromBase(ADMIN_BASE, '/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function adminLogout(): Promise<APIResponse<{ message: string }>> {
  return fetchJSONFromBase(ADMIN_BASE, '/logout', { method: 'POST' });
}

export async function adminGetConfig(): Promise<APIResponse<Record<string, unknown>>> {
  return fetchJSONFromBase(ADMIN_BASE, '/config');
}

export async function adminPatchConfig(patch: Record<string, unknown>): Promise<APIResponse<Record<string, unknown>>> {
  return fetchJSONFromBase(ADMIN_BASE, '/config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function adminReloadConfig(): Promise<APIResponse<{ message: string }>> {
  return fetchJSONFromBase(ADMIN_BASE, '/config/reload', { method: 'POST' });
}

export async function adminListProviders(): Promise<APIResponse<AdminProviderView[]>> {
  return fetchJSONFromBase(ADMIN_BASE, '/providers');
}

export async function adminSetProviderEnabled(id: string, enabled: boolean): Promise<APIResponse<{ id: string; enabled: boolean }>> {
  return fetchJSONFromBase(ADMIN_BASE, `/providers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export async function adminSetProviderApiKey(id: string, apiKey: string): Promise<APIResponse<{ id: string; updated: boolean }>> {
  return fetchJSONFromBase(ADMIN_BASE, `/providers/${id}/apikey`, {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export async function adminUnlinkProvider(id: string): Promise<APIResponse<{ id: string; unlinked: boolean }>> {
  return fetchJSONFromBase(ADMIN_BASE, `/providers/${id}/unlink`, {
    method: 'DELETE',
  });
}

export async function adminGetAudit(limit = 50): Promise<APIResponse<Array<{ timestamp: string; eventId: string; actor: string; action: string; resource: string; result: string; message?: string }>>> {
  return fetchJSONFromBase(ADMIN_BASE, `/audit?limit=${encodeURIComponent(String(limit))}`);
}

export async function adminRenewPairing(): Promise<APIResponse<{ code: string; expiresAtMs: number }>> {
  return fetchJSONFromBase(ADMIN_BASE, '/pairing/renew', { method: 'POST' });
}

export async function adminSetPassword(password: string): Promise<APIResponse<{ message: string }>> {
  return fetchJSONFromBase(ADMIN_BASE, '/password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export type APIKeyValidationResult = {
  valid: boolean;
  providerId: string;
  error?: string;
  details?: {
    statusCode?: number;
    message?: string;
  };
};

export async function adminValidateProviderApiKey(id: string, apiKey: string): Promise<APIResponse<APIKeyValidationResult>> {
  return fetchJSONFromBase(ADMIN_BASE, `/providers/${id}/validate`, {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export async function adminTestProviderConnection(id: string): Promise<APIResponse<APIKeyValidationResult>> {
  return fetchJSONFromBase(ADMIN_BASE, `/providers/${id}/test`, {
    method: 'POST',
  });
}
