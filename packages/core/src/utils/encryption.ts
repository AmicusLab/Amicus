/**
 * Encryption utilities for "enc:v1:" format
 * Uses AES-256-GCM with PBKDF2 (200k iterations)
 */

const ENCRYPTION_PREFIX = 'enc:v1:';
const ITERATIONS = 200_000;

function toB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromB64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
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

/**
 * Encrypts plaintext using AES-256-GCM with PBKDF2
 * Returns format: "enc:v1:{base64(salt:iv:ciphertext)}"
 */
export async function encrypt(plaintext: string, key: string): Promise<string> {
  if (!plaintext) {
    throw new Error('Plaintext cannot be empty');
  }
  if (!key) {
    throw new Error('Encryption key cannot be empty');
  }

  const passphraseKey = await importPassphraseKey(key);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const aesKey = await deriveAesKey({ passphraseKey, salt, iterations: ITERATIONS });
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(plaintext)
  );

  // Combine salt + iv + ciphertext into single buffer
  const saltLen = salt.length;
  const ivLen = iv.length;
  const cipherBytes = new Uint8Array(ciphertext);
  
  const combined = new Uint8Array(saltLen + ivLen + cipherBytes.length);
  combined.set(salt, 0);
  combined.set(iv, saltLen);
  combined.set(cipherBytes, saltLen + ivLen);

  return `${ENCRYPTION_PREFIX}${toB64(combined)}`;
}

/**
 * Decrypts an "enc:v1:" formatted encrypted string
 * Throws error if format is invalid or key is wrong
 */
export async function decrypt(encrypted: string, key: string): Promise<string> {
  if (!encrypted) {
    throw new Error('Encrypted value cannot be empty');
  }
  if (!key) {
    throw new Error('Decryption key cannot be empty');
  }

  if (!encrypted.startsWith(ENCRYPTION_PREFIX)) {
    throw new Error(`Invalid encrypted format: expected "${ENCRYPTION_PREFIX}" prefix`);
  }

  const b64Payload = encrypted.slice(ENCRYPTION_PREFIX.length);
  if (!b64Payload) {
    throw new Error('Invalid encrypted format: empty payload');
  }

  let combined: Uint8Array;
  try {
    combined = fromB64(b64Payload);
  } catch {
    throw new Error('Invalid encrypted format: payload too short');
  }

  // Extract salt (16 bytes), iv (12 bytes), and ciphertext
  if (combined.length < 28) {
    throw new Error('Invalid encrypted format: payload too short');
  }

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);

  try {
    const passphraseKey = await importPassphraseKey(key);
    const aesKey = await deriveAesKey({ passphraseKey, salt, iterations: ITERATIONS });

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(plaintext);
  } catch (error) {
    throw new Error('Decryption failed: invalid key or corrupted data');
  }
}

/**
 * Checks if a value is encrypted (starts with "enc:v1:")
 */
export function isEncrypted(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return value.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Masks encrypted values as "[ENCRYPTED]"
 * Returns plaintext values unchanged
 */
export function maskEncrypted(value: string): string {
  if (typeof value !== 'string') {
    return String(value);
  }
  if (isEncrypted(value)) {
    return '[ENCRYPTED]';
  }
  return value;
}
