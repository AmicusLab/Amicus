import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';

type EncryptedSecretsFileV1 = {
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; saltB64: string; iterations: number };
  cipher: { name: 'AES-GCM'; ivB64: string };
  ciphertextB64: string;
};

function toB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromB64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function importPassphraseKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, [
    'deriveKey',
  ]);
}

async function deriveAesKey(params: {
  passphraseKey: CryptoKey;
  salt: Uint8Array;
  iterations: number;
}): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: params.salt,
      iterations: params.iterations,
    },
    params.passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export class SecretStore {
  private secrets: Record<string, string> = {};
  private path: string;
  private repoRoot: string;
  private iterations: number;

  constructor(opts?: { secretsPath?: string; repoRoot?: string; iterations?: number }) {
    this.repoRoot = opts?.repoRoot ?? process.cwd();
    const defaultPath = join(this.repoRoot, 'data', 'secrets.enc.json');
    const raw = opts?.secretsPath ?? process.env.AMICUS_SECRETS_PATH ?? defaultPath;
    this.path = isAbsolute(raw) ? raw : join(this.repoRoot, raw);
    this.iterations = opts?.iterations ?? 200_000;
  }

  getPath(): string {
    return this.path;
  }

  /**
   * Returns the secret value for `key`.
   * Precedence: env var override (if key is an env var name) > encrypted store.
   */
  get(key: string): string | undefined {
    const env = process.env[key];
    if (env) return env;
    return this.secrets[key];
  }

  /**
   * Loads secrets from encrypted storage. If no file exists, loads empty secrets.
   * Requires CONFIG_ENCRYPTION_KEY to decrypt (unless file does not exist).
   */
  async load(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(this.path, 'utf-8');
    } catch {
      this.secrets = {};
      return;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) {
      throw new Error(`Unsupported secrets file format: ${this.path}`);
    }

    const file = parsed as EncryptedSecretsFileV1;
    const passphrase = process.env.CONFIG_ENCRYPTION_KEY;
    if (!passphrase) {
      throw new Error('CONFIG_ENCRYPTION_KEY is required to decrypt persisted secrets');
    }

    const passphraseKey = await importPassphraseKey(passphrase);
    const aesKey = await deriveAesKey({
      passphraseKey,
      salt: fromB64(file.kdf.saltB64),
      iterations: file.kdf.iterations,
    });

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(file.cipher.ivB64) },
      aesKey,
      fromB64(file.ciphertextB64)
    );

    const dec = new TextDecoder();
    const json = dec.decode(plaintext);
    const secretsParsed: unknown = JSON.parse(json);
    if (!isRecord(secretsParsed)) {
      throw new Error('Decrypted secrets payload is invalid');
    }

    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(secretsParsed)) {
      if (typeof v === 'string') out[k] = v;
    }
    this.secrets = out;
  }

  async set(key: string, value: string): Promise<void> {
    this.secrets[key] = value;
    await this.persist();
  }

  async delete(key: string): Promise<void> {
    delete this.secrets[key];
    await this.persist();
  }

  private async persist(): Promise<void> {
    const passphrase = process.env.CONFIG_ENCRYPTION_KEY;
    if (!passphrase) {
      throw new Error('CONFIG_ENCRYPTION_KEY is required to persist secrets');
    }

    const passphraseKey = await importPassphraseKey(passphrase);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const aesKey = await deriveAesKey({ passphraseKey, salt, iterations: this.iterations });
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const enc = new TextEncoder();
    const payload = JSON.stringify(this.secrets);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      enc.encode(payload)
    );

    const file: EncryptedSecretsFileV1 = {
      version: 1,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        saltB64: toB64(salt),
        iterations: this.iterations,
      },
      cipher: {
        name: 'AES-GCM',
        ivB64: toB64(iv),
      },
      ciphertextB64: toB64(new Uint8Array(ciphertext)),
    };

    await mkdir(dirname(this.path), { recursive: true });
    const tmpPath = `${this.path}.tmp`;
    await writeFile(tmpPath, JSON.stringify(file, null, 2) + '\n', 'utf-8');
    await rename(tmpPath, this.path);
  }
}
