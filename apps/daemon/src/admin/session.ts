import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'amicus_admin_session';

function b64urlEncode(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function b64urlDecodeToBuffer(b64url: string): Buffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64');
}

function sign(input: string, secret: string): string {
  const mac = createHmac('sha256', secret).update(input).digest();
  return b64urlEncode(mac);
}

export type AdminSession = {
  sub: 'admin';
  iat: number;
  exp: number;
};

export function getAdminSessionCookieName(): string {
  return COOKIE_NAME;
}

export function createAdminSessionToken(params: {
  nowMs: number;
  ttlSeconds: number;
  secret: string;
}): string {
  const iat = Math.floor(params.nowMs / 1000);
  const exp = iat + params.ttlSeconds;
  const payload: AdminSession = { sub: 'admin', iat, exp };
  const header = { alg: 'HS256', typ: 'JWT' };
  const input = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(payload))}`;
  const sig = sign(input, params.secret);
  return `${input}.${sig}`;
}

export function verifyAdminSessionToken(params: {
  token: string;
  nowMs: number;
  secret: string;
}): AdminSession | null {
  const parts = params.token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  if (!h || !p || !s) return null;
  const input = `${h}.${p}`;
  const expected = sign(input, params.secret);

  try {
    const a = b64urlDecodeToBuffer(s);
    const b = b64urlDecodeToBuffer(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payloadRaw = b64urlDecodeToBuffer(p).toString('utf-8');
    const payload = JSON.parse(payloadRaw) as AdminSession;
    if (payload.sub !== 'admin') return null;
    if (typeof payload.exp !== 'number') return null;
    const now = Math.floor(params.nowMs / 1000);
    if (now >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
