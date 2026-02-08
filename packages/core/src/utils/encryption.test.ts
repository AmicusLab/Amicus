import { describe, it, expect } from 'bun:test';
import { encrypt, decrypt, isEncrypted, maskEncrypted } from './encryption';

describe('encryption', () => {
  const testKey = 'test-encryption-key-32-chars-long!!';
  const testPlaintext = 'my-secret-api-key-12345';

  describe('encrypt', () => {
    it('should encrypt plaintext and return enc:v1: format', async () => {
      const encrypted = await encrypt(testPlaintext, testKey);
      
      expect(encrypted).toStartWith('enc:v1:');
      expect(encrypted.length).toBeGreaterThan('enc:v1:'.length);
    });

    it('should produce different ciphertext for same plaintext (random IV/salt)', async () => {
      const encrypted1 = await encrypt(testPlaintext, testKey);
      const encrypted2 = await encrypt(testPlaintext, testKey);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for empty plaintext', async () => {
      await expect(encrypt('', testKey)).rejects.toThrow('Plaintext cannot be empty');
    });

    it('should throw error for empty key', async () => {
      await expect(encrypt(testPlaintext, '')).rejects.toThrow('Encryption key cannot be empty');
    });

    it('should handle unicode characters', async () => {
      const unicodeText = 'Hello 世界 🌍 ñoño';
      const encrypted = await encrypt(unicodeText, testKey);
      
      expect(encrypted).toStartWith('enc:v1:');
    });

    it('should handle long plaintext', async () => {
      const longText = 'a'.repeat(10000);
      const encrypted = await encrypt(longText, testKey);
      
      expect(encrypted).toStartWith('enc:v1:');
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted value back to original', async () => {
      const encrypted = await encrypt(testPlaintext, testKey);
      const decrypted = await decrypt(encrypted, testKey);
      
      expect(decrypted).toBe(testPlaintext);
    });

    it('should throw error for invalid format (no prefix)', async () => {
      await expect(decrypt('invalid-data', testKey)).rejects.toThrow('Invalid encrypted format');
    });

    it('should throw error for empty payload after prefix', async () => {
      await expect(decrypt('enc:v1:', testKey)).rejects.toThrow('empty payload');
    });

    it('should throw error for malformed base64', async () => {
      await expect(decrypt('enc:v1:!!!invalid!!!', testKey)).rejects.toThrow('payload too short');
    });

    it('should throw error for payload too short', async () => {
      await expect(decrypt('enc:v1:YXNkZg==', testKey)).rejects.toThrow('payload too short');
    });

    it('should throw error for wrong key', async () => {
      const encrypted = await encrypt(testPlaintext, testKey);
      const wrongKey = 'wrong-key-32-chars-long!!!';
      
      await expect(decrypt(encrypted, wrongKey)).rejects.toThrow('Decryption failed');
    });

    it('should throw error for empty encrypted value', async () => {
      await expect(decrypt('', testKey)).rejects.toThrow('Encrypted value cannot be empty');
    });

    it('should throw error for empty key', async () => {
      const encrypted = await encrypt(testPlaintext, testKey);
      await expect(decrypt(encrypted, '')).rejects.toThrow('Decryption key cannot be empty');
    });

    it('should handle unicode roundtrip', async () => {
      const unicodeText = 'Hello 世界 🌍 ñoño';
      const encrypted = await encrypt(unicodeText, testKey);
      const decrypted = await decrypt(encrypted, testKey);
      
      expect(decrypted).toBe(unicodeText);
    });

    it('should handle long text roundtrip', async () => {
      const longText = 'b'.repeat(10000);
      const encrypted = await encrypt(longText, testKey);
      const decrypted = await decrypt(encrypted, testKey);
      
      expect(decrypted).toBe(longText);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for enc:v1: prefixed value', () => {
      expect(isEncrypted('enc:v1:abc123')).toBe(true);
    });

    it('should return false for plaintext', () => {
      expect(isEncrypted('plaintext')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isEncrypted(null as unknown as string)).toBe(false);
      expect(isEncrypted(undefined as unknown as string)).toBe(false);
      expect(isEncrypted(123 as unknown as string)).toBe(false);
    });

    it('should return false for similar but incorrect prefix', () => {
      expect(isEncrypted('enc:v2:abc')).toBe(false);
      expect(isEncrypted('ENC:V1:abc')).toBe(false);
      expect(isEncrypted('enc:v1')).toBe(false);
    });
  });

  describe('maskEncrypted', () => {
    it('should return [ENCRYPTED] for encrypted value', () => {
      expect(maskEncrypted('enc:v1:abc123')).toBe('[ENCRYPTED]');
    });

    it('should return plaintext unchanged', () => {
      expect(maskEncrypted('plaintext')).toBe('plaintext');
    });

    it('should handle empty string', () => {
      expect(maskEncrypted('')).toBe('');
    });

    it('should convert non-string to string', () => {
      expect(maskEncrypted(null as unknown as string)).toBe('null');
      expect(maskEncrypted(undefined as unknown as string)).toBe('undefined');
      expect(maskEncrypted(123 as unknown as string)).toBe('123');
    });
  });

  describe('roundtrip', () => {
    it('should encrypt and decrypt various strings correctly', async () => {
      const testCases = [
        'simple',
        'with spaces and symbols !@#$%',
        'unicode: 你好世界',
        'numbers: 1234567890',
        'mixed: Hello 世界 123!',
        '', // empty will throw, tested separately
      ];

      for (const text of testCases) {
        if (!text) continue; // Skip empty
        const encrypted = await encrypt(text, testKey);
        const decrypted = await decrypt(encrypted, testKey);
        expect(decrypted).toBe(text);
      }
    });
  });
});
