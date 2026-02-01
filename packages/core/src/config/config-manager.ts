import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { EventEmitter } from 'node:events';
import { AmicusConfigSchema, DEFAULT_CONFIG, type AmicusConfig } from './app-config.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isRecord(base) || !isRecord(override)) {
    return (override as T) ?? base;
  }

  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override)) {
    const existing = out[k];
    if (isRecord(existing) && isRecord(v)) {
      out[k] = deepMerge(existing, v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export type ConfigManagerEvents = {
  reloaded: (config: AmicusConfig) => void;
  updated: (config: AmicusConfig) => void;
};

export class ConfigManager extends EventEmitter {
  private config: AmicusConfig = DEFAULT_CONFIG;
  private configPath: string;
  private repoRoot: string;

  constructor(opts?: { configPath?: string; repoRoot?: string }) {
    super();
    this.repoRoot = opts?.repoRoot ?? process.cwd();
    const defaultPath = join(this.repoRoot, 'data', 'config.json');
    const pathFromEnv = process.env.AMICUS_CONFIG_PATH;
    const raw = opts?.configPath ?? pathFromEnv ?? defaultPath;
    this.configPath = isAbsolute(raw) ? raw : join(this.repoRoot, raw);
  }

  getPath(): string {
    return this.configPath;
  }

  getConfig(): AmicusConfig {
    return this.config;
  }

  getSafeConfig(): AmicusConfig {
    // This config schema excludes secrets by design, so returning as-is is safe.
    return this.config;
  }

  async load(): Promise<AmicusConfig> {
    let parsedJson: unknown = {};
    try {
      const raw = await readFile(this.configPath, 'utf-8');
      parsedJson = JSON.parse(raw);
    } catch (err) {
      // Missing file is OK: use defaults.
      parsedJson = {};
    }

    const merged = deepMerge(DEFAULT_CONFIG, parsedJson);
    const validated = AmicusConfigSchema.parse(merged);
    this.config = validated;
    this.emit('reloaded', this.config);
    return this.config;
  }

  async update(patch: unknown): Promise<AmicusConfig> {
    const merged = deepMerge(this.config, patch);
    const validated = AmicusConfigSchema.parse(merged);
    await this.writeConfig(validated);
    this.config = validated;
    this.emit('updated', this.config);
    return this.config;
  }

  private async writeConfig(next: AmicusConfig): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true });
    const tmpPath = `${this.configPath}.tmp`;
    const json = JSON.stringify(next, null, 2) + '\n';
    await writeFile(tmpPath, json, 'utf-8');
    await rename(tmpPath, this.configPath);
  }
}
