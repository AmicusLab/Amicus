import { join } from 'node:path';
import { ConfigManager, SecretStore } from '@amicus/core';

// When running via `bun run --cwd apps/daemon ...`, process.cwd() is `apps/daemon`.
// Most repo-relative data lives at the monorepo root.
export const repoRoot = join(process.cwd(), '..', '..');

export const configManager = new ConfigManager({ repoRoot });
export const secretStore = new SecretStore({ repoRoot });

export async function initializeConfig(): Promise<void> {
  await configManager.load();
  // Only requires CONFIG_ENCRYPTION_KEY if the secrets file exists.
  await secretStore.load();
}
