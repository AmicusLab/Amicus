import { signal, computed } from '@preact/signals-core';
import type { SystemHealth, Tokenomics, WSMessage } from '@amicus/types/dashboard';

export const systemHealth = signal<SystemHealth | null>(null);
export const tokenomics = signal<Tokenomics | null>(null);
export const isConnected = signal(false);
export const thoughts = signal<Array<{ content: string; timestamp: number }>>([]);

export const healthStatus = computed(() => systemHealth.value?.status ?? 'unknown');
export const uptime = computed(() => {
  const ms = systemHealth.value?.daemon.uptime ?? 0;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
});

export const totalCost = computed(() => {
  return tokenomics.value?.totalCost.usd.toFixed(4) ?? '0.0000';
});

export function handleWSMessage(message: WSMessage): void {
  switch (message.type) {
    case 'connect':
      isConnected.value = true;
      break;
    case 'disconnect':
      isConnected.value = false;
      break;
    case 'thought:new':
      const payload = message.payload as { thought: { content: string; timestamp: number } };
      thoughts.value = [...thoughts.value.slice(-49), payload.thought];
      break;
    case 'system:healthUpdate':
      systemHealth.value = message.payload as SystemHealth;
      break;
    case 'tokenomics:update':
      tokenomics.value = message.payload as Tokenomics;
      break;
  }
}
