import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigManager } from './config-manager.js';
import { encrypt } from '../utils/encryption.js';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;
  const testKey = 'test-encryption-key-32-chars-long!!';

  beforeEach(async () => {
    tempDir = join(tmpdir(), `amicus-config-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    configManager = new ConfigManager({ repoRoot: tempDir });
    process.env.CONFIG_ENCRYPTION_KEY = testKey;
  });

  afterEach(async () => {
    delete process.env.CONFIG_ENCRYPTION_KEY;
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('constructor', () => {
    it('should use default path when no options provided', () => {
      const cm = new ConfigManager({ repoRoot: tempDir });
      expect(cm.getPath()).toBe(join(tempDir, 'data', 'amicus.json'));
    });

    it('should use custom path from options', () => {
      const cm = new ConfigManager({
        repoRoot: tempDir,
        configPath: 'custom/config.json',
      });
      expect(cm.getPath()).toBe(join(tempDir, 'custom', 'config.json'));
    });

    it('should use absolute path as-is', () => {
      const absolutePath = '/absolute/path/to/config.json';
      const cm = new ConfigManager({
        repoRoot: tempDir,
        configPath: absolutePath,
      });
      expect(cm.getPath()).toBe(absolutePath);
    });

    it('should use AMICUS_CONFIG_PATH environment variable', () => {
      process.env.AMICUS_CONFIG_PATH = 'env/config.json';
      const cm = new ConfigManager({ repoRoot: tempDir });
      expect(cm.getPath()).toBe(join(tempDir, 'env', 'config.json'));
      delete process.env.AMICUS_CONFIG_PATH;
    });
  });

  describe('load', () => {
    it('should return default config when file does not exist', async () => {
      const config = await configManager.load();
      expect(config).toBeDefined();
      expect(config.admin).toBeDefined();
      expect(config.llm.providers).toEqual([]);
    });

    it('should load and decrypt encrypted values', async () => {
      const encryptedApiKey = await encrypt('sk-test123', testKey);
      const configData = {
        llm: {
          providers: [
            {
              id: 'openai',
              package: '@amicus/llm-openai',
              enabled: true,
              apiKey: encryptedApiKey,
            },
          ],
        },
      };

      const configPath = join(tempDir, 'data', 'amicus.json');
      await mkdir(join(tempDir, 'data'), { recursive: true });
      await writeFile(configPath, JSON.stringify(configData, null, 2));

      const config = await configManager.load();
      expect(config.llm.providers[0].apiKey).toBe('sk-test123');
    });

    it('should throw error when decryption fails', async () => {
      const configData = {
        llm: {
          providers: [
            {
              id: 'openai',
              package: '@amicus/llm-openai',
              enabled: true,
              apiKey: 'enc:v1:invalid-data',
            },
          ],
        },
      };

      const configPath = join(tempDir, 'data', 'amicus.json');
      await mkdir(join(tempDir, 'data'), { recursive: true });
      await writeFile(configPath, JSON.stringify(configData, null, 2));

      expect(async () => await configManager.load()).toThrow(
        'CONFIG_ENCRYPTION_KEY missing or invalid'
      );
    });

    it('should preserve non-encrypted values', async () => {
      const configData = {
        admin: {
          sessionTtlSeconds: 3600,
        },
        llm: {
          providers: [
            {
              id: 'local',
              package: '@amicus/llm-local',
              enabled: true,
            },
          ],
        },
      };

      const configPath = join(tempDir, 'data', 'amicus.json');
      await mkdir(join(tempDir, 'data'), { recursive: true });
      await writeFile(configPath, JSON.stringify(configData, null, 2));

      const config = await configManager.load();
      expect(config.admin.sessionTtlSeconds).toBe(3600);
      expect(config.llm.providers[0].id).toBe('local');
    });
  });

  describe('getSafeConfig', () => {
    it('should mask encrypted values', async () => {
      const encryptedApiKey = await encrypt('sk-secret', testKey);
      const configData = {
        llm: {
          providers: [
            {
              id: 'openai',
              package: '@amicus/llm-openai',
              enabled: true,
              apiKey: encryptedApiKey,
            },
          ],
        },
      };

      const configPath = join(tempDir, 'data', 'amicus.json');
      await mkdir(join(tempDir, 'data'), { recursive: true });
      await writeFile(configPath, JSON.stringify(configData, null, 2));

      await configManager.load();
      const safeConfig = await configManager.getSafeConfig();
      expect(safeConfig.llm.providers[0].apiKey).toBe('[ENCRYPTED]');
    });

    it('should preserve plaintext values in safe config', async () => {
      const configData = {
        admin: {
          sessionTtlSeconds: 3600,
        },
      };

      const configPath = join(tempDir, 'data', 'amicus.json');
      await mkdir(join(tempDir, 'data'), { recursive: true });
      await writeFile(configPath, JSON.stringify(configData, null, 2));

      await configManager.load();
      const safeConfig = await configManager.getSafeConfig();
      expect(safeConfig.admin.sessionTtlSeconds).toBe(3600);
    });
  });

  describe('update', () => {
    it('should encrypt sensitive fields on update', async () => {
      await configManager.load();

      await configManager.update({
        llm: {
          providers: [
            {
              id: 'openai',
              package: '@amicus/llm-openai',
              enabled: true,
              apiKey: 'sk-test123',
            },
          ],
        },
      });

      const configPath = join(tempDir, 'data', 'amicus.json');
      const rawContent = await readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(rawContent);

      expect(savedConfig.llm.providers[0].apiKey.startsWith('enc:v1:')).toBe(true);
      expect(savedConfig.llm.providers[0].apiKey).not.toContain('sk-test123');
    });

    it('should encrypt accessToken and refreshToken', async () => {
      await configManager.load();

      await configManager.update({
        llm: {
          providers: [
            {
              id: 'google',
              package: '@amicus/llm-google',
              enabled: true,
              accessToken: 'access-token-123',
              refreshToken: 'refresh-token-456',
            },
          ],
        },
      });

      const configPath = join(tempDir, 'data', 'amicus.json');
      const rawContent = await readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(rawContent);

      expect(savedConfig.llm.providers[0].accessToken.startsWith('enc:v1:')).toBe(true);
      expect(savedConfig.llm.providers[0].refreshToken.startsWith('enc:v1:')).toBe(true);
    });

    it('should not re-encrypt already encrypted values', async () => {
      const encryptedApiKey = await encrypt('sk-test123', testKey);
      await configManager.load();

      await configManager.update({
        llm: {
          providers: [
            {
              id: 'openai',
              package: '@amicus/llm-openai',
              enabled: true,
              apiKey: encryptedApiKey,
            },
          ],
        },
      });

      const configPath = join(tempDir, 'data', 'amicus.json');
      const rawContent = await readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(rawContent);

      expect(savedConfig.llm.providers[0].apiKey).toBe(encryptedApiKey);
    });

    it('should emit updated event', async () => {
      await configManager.load();

      let eventEmitted = false;
      configManager.on('updated', () => {
        eventEmitted = true;
      });

      await configManager.update({
        admin: { sessionTtlSeconds: 7200 },
      });

      expect(eventEmitted).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return current config without masking', async () => {
      await configManager.load();

      await configManager.update({
        llm: {
          providers: [
            {
              id: 'openai',
              package: '@amicus/llm-openai',
              enabled: true,
              apiKey: 'sk-test123',
            },
          ],
        },
      });

      const config = configManager.getConfig();
      expect(config.llm.providers[0].apiKey).toBe('sk-test123');
    });
  });

  describe('events', () => {
    it('should emit reloaded event on load', async () => {
      let eventEmitted = false;
      configManager.on('reloaded', () => {
        eventEmitted = true;
      });

      await configManager.load();
      expect(eventEmitted).toBe(true);
    });
  });
});
