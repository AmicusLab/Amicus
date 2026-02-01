import { randomBytes } from 'node:crypto';

type PairingState = {
  code: string;
  expiresAtMs: number;
  used: boolean;
};

let state: PairingState | null = null;

function generateCode(): string {
  // 8 bytes -> 16 hex chars
  return randomBytes(8).toString('hex');
}

export function initPairing(params?: { nowMs?: number; ttlSeconds?: number }): PairingState {
  const nowMs = params?.nowMs ?? Date.now();
  const ttlSeconds = params?.ttlSeconds ?? 60 * 10;
  state = {
    code: generateCode(),
    expiresAtMs: nowMs + ttlSeconds * 1000,
    used: false,
  };
  return state;
}

export function getPairingState(): PairingState | null {
  return state;
}

export function verifyPairingCode(code: string, nowMs = Date.now()): { ok: true } | { ok: false; reason: string } {
  if (!state) return { ok: false, reason: 'Pairing not initialized' };
  if (state.used) return { ok: false, reason: 'Pairing code already used' };
  if (nowMs > state.expiresAtMs) return { ok: false, reason: 'Pairing code expired' };
  if (code !== state.code) return { ok: false, reason: 'Invalid pairing code' };
  state.used = true;
  return { ok: true };
}
