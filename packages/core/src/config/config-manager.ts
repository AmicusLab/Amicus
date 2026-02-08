import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { EventEmitter } from 'node:events';
import { AmicusConfigSchema, DEFAULT_CONFIG, type AmicusConfig } from './app-config.js';
import { encrypt, decrypt, maskEncrypted, isEncrypted } from '../utils/encryption.js';

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

function isSensitiveField(key: string): boolean {
  const sensitivePatterns = ['apiKey', 'accessToken', 'refreshToken', 'password'];
  return sensitivePatterns.some((pattern) =>
    key.toLowerCase().includes(pattern.toLowerCase())
  );
}

async function decryptEncryptedValues(
  obj: unknown,
  encryptionKey: string
): Promise<unknown> {
  if (typeof obj === 'string') {
    if (isEncrypted(obj)) {
      return await decrypt(obj, encryptionKey);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return Promise.all(
      obj.map((item) => decryptEncryptedValues(item, encryptionKey))
    );
  }
  if (isRecord(obj)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await decryptEncryptedValues(value, encryptionKey);
    }
    return result;
  }
  return obj;
}

async function encryptSensitiveFields(
  obj: unknown,
  encryptionKey: string
): Promise<unknown> {
  if (typeof obj === 'string') {
    return isEncrypted(obj) ? obj : obj;
  }
  if (Array.isArray(obj)) {
    return Promise.all(
      obj.map((item) => encryptSensitiveFields(item, encryptionKey))
    );
  }
  if (isRecord(obj)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && isSensitiveField(key) && !isEncrypted(value)) {
        result[key] = await encrypt(value, encryptionKey);
      } else if (isRecord(value) || Array.isArray(value)) {
        result[key] = await encryptSensitiveFields(value, encryptionKey);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return obj;
}

async function maskSensitiveFields(obj: unknown): Promise<unknown> {
  if (typeof obj === 'string') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => maskSensitiveFields(item)));
  }
  if (isRecord(obj)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && isSensitiveField(key)) {
        result[key] = '[ENCRYPTED]';
      } else if (isRecord(value) || Array.isArray(value)) {
        result[key] = await maskSensitiveFields(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return obj;
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
    const defaultPath = join(this.repoRoot, 'data', 'amicus.json');
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

  async getSafeConfig(): Promise<AmicusConfig> {
    return (await maskSensitiveFields(this.config)) as AmicusConfig;
  }

  async load(): Promise<AmicusConfig> {
    let parsedJson: unknown = {};
    try {
      const raw = await readFile(this.configPath, 'utf-8');
      parsedJson = JSON.parse(raw);
    } catch {
      parsedJson = {};
    }

    const encryptionKey = process.env.CONFIG_ENCRYPTION_KEY;
    if (encryptionKey) {
      try {
        parsedJson = await decryptEncryptedValues(parsedJson, encryptionKey);
      } catch {
        throw new Error('CONFIG_ENCRYPTION_KEY missing or invalid');
      }
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

    const encryptionKey = process.env.CONFIG_ENCRYPTION_KEY;
    let configToWrite = validated;
    if (encryptionKey) {
      configToWrite = (await encryptSensitiveFields(
        validated,
        encryptionKey
      )) as AmicusConfig;
    }

    await this.writeConfig(configToWrite);
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
