import { z } from 'zod';

// NOTE: This schema intentionally excludes secrets (API keys, passwords, tokens).
// Secrets are managed by the daemon via env vars and/or encrypted secret storage.

export const ProviderEntrySchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  package: z.string().min(1),
  envKey: z.string().min(1).optional(),
  baseURL: z.string().min(1).optional(),
});

export const LLMConfigSchema = z.object({
  providers: z.array(ProviderEntrySchema).default([]),
  defaultModel: z.string().min(1).nullable().default(null),
  dailyBudget: z.number().finite().nonnegative().default(10.0),
  budgetAlertThreshold: z.number().finite().min(0).max(1).default(0.8),
});

export const MCPConfigSchema = z.object({
  configPath: z.string().min(1).default('./data/mcp-servers.json'),
});

export const DaemonConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
});

export const AuthConfigSchema = z.object({
  // Whether normal API endpoints require auth. If enabled, daemon will accept either:
  // - Bearer API key (server/cli usage)
  // - httpOnly session cookie (dashboard/admin usage)
  enabled: z.boolean().default(false),
});

export const AdminConfigSchema = z.object({
  sessionTtlSeconds: z.number().int().min(60).max(60 * 60 * 24).default(60 * 30),
});

export const AmicusConfigSchema = z.object({
  daemon: DaemonConfigSchema.default({ port: 3000 }),
  llm: LLMConfigSchema.default({
    providers: [],
    defaultModel: null,
    dailyBudget: 10.0,
    budgetAlertThreshold: 0.8,
  }),
  mcp: MCPConfigSchema.default({ configPath: './data/mcp-servers.json' }),
  auth: AuthConfigSchema.default({ enabled: false }),
  admin: AdminConfigSchema.default({ sessionTtlSeconds: 60 * 30 }),
});

export type AmicusConfig = z.infer<typeof AmicusConfigSchema>;

export const DEFAULT_CONFIG: AmicusConfig = AmicusConfigSchema.parse({});
