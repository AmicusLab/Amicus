import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { APIResponse } from '@amicus/types/dashboard';
import { adminAuthMiddleware } from '../middleware/admin-auth.js';
import { configManager, secretStore } from '../services/ConfigService.js';
import { initPairing, verifyPairingCode } from '../admin/pairing.js';
import { upsertEnvVar } from '../services/EnvService.js';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
} from '../admin/session.js';
import { providerService } from '../services/ProviderService.js';
import { writeAudit, readAudit } from '../services/AuditLogService.js';

const defaultModelsByProvider: Record<string, string> = {
  anthropic: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4-turbo',
  google: 'gemini-1.5-pro',
  groq: 'llama-3.3-70b-versatile',
  zai: 'glm-4.7',
  'zai-coding-plan': 'glm-4.7',
  'kimi-for-coding': 'kimi-for-coding',
  openrouter: 'openai/gpt-4-turbo',
  moonshot: 'moonshot-v1-128k',
  minimax: 'abab5.5-chat',
};

export const adminRoutes = new Hono();

// Simple in-memory rate limiter for auth endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    // Reset or create new record
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

function ok<T>(data: T): APIResponse<T> {
  return {
    success: true,
    data,
    meta: { requestId: randomUUID(), timestamp: Date.now(), duration: 0 },
  };
}

function fail(code: string, message: string): APIResponse<never> {
  return {
    success: false,
    error: { code, message },
    meta: { requestId: randomUUID(), timestamp: Date.now(), duration: 0 },
  };
}

function getSessionSecret(): string {
  const secret = process.env.AMICUS_ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('AMICUS_ADMIN_SESSION_SECRET is required but not configured');
  }
  return secret;
}

// Initialize pairing on module load so daemon can be administered without shipping secrets.
// Daemon startup prints the current code (see apps/daemon/src/index.ts).
initPairing();

adminRoutes.post('/pairing/renew', adminAuthMiddleware, (c) => {
  const next = initPairing({ nowMs: Date.now(), ttlSeconds: 60 * 10 });
  writeAudit({
    timestamp: new Date().toISOString(),
    eventId: randomUUID(),
    actor: 'admin',
    action: 'admin.pairingRenew',
    resource: 'pairing',
    result: 'success',
  });
  return c.json(ok({ code: next.code, expiresAtMs: next.expiresAtMs }));
});

adminRoutes.post('/pair', async (c) => {
  const ip = c.req.header('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(ip)) {
    return c.json(fail('RATE_LIMITED', 'Too many attempts. Please try again later.'), 429);
  }

  const body = await c.req.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === 'string' ? body.code : '';
  const res = verifyPairingCode(code);
  if (!res.ok) {
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'admin.pair',
      resource: 'session',
      result: 'failure',
      message: res.reason,
    });
    return c.json(fail('PAIRING_FAILED', res.reason), 401);
  }

  const secret = getSessionSecret();
  if (!secret) {
    return c.json(fail('ADMIN_SECRET_MISSING', 'Admin session secret not configured'), 500);
  }

  const ttl = configManager.getConfig().admin.sessionTtlSeconds;
  const token = createAdminSessionToken({ nowMs: Date.now(), ttlSeconds: ttl, secret });
  setCookie(c, getAdminSessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttl,
  });
  writeAudit({
    timestamp: new Date().toISOString(),
    eventId: randomUUID(),
    actor: 'admin',
    action: 'admin.pair',
    resource: 'session',
    result: 'success',
  });
  return c.json(ok({ message: 'Paired' }));
});

adminRoutes.post('/login', async (c) => {
  const ip = c.req.header('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(ip)) {
    return c.json(fail('RATE_LIMITED', 'Too many attempts. Please try again later.'), 429);
  }

  const body = await c.req.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password) {
    return c.json(fail('INVALID_BODY', 'Expected { password: string }'), 400);
  }

  const expected = process.env.AMICUS_ADMIN_PASSWORD || secretStore.get('AMICUS_ADMIN_PASSWORD');
  if (!expected) {
    return c.json(fail('ADMIN_PASSWORD_MISSING', 'Admin password not configured'), 500);
  }
  // Timing-safe comparison to prevent timing attacks
  const passwordBuf = Buffer.from(password, 'utf-8');
  const expectedBuf = Buffer.from(expected, 'utf-8');
  if (passwordBuf.length !== expectedBuf.length || !timingSafeEqual(passwordBuf, expectedBuf)) {
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'admin.login',
      resource: 'session',
      result: 'failure',
      message: 'Invalid password',
    });
    return c.json(fail('LOGIN_FAILED', 'Invalid password'), 401);
  }

  const secret = getSessionSecret();
  if (!secret) {
    return c.json(fail('ADMIN_SECRET_MISSING', 'Admin session secret not configured'), 500);
  }

  const ttl = configManager.getConfig().admin.sessionTtlSeconds;
  const token = createAdminSessionToken({ nowMs: Date.now(), ttlSeconds: ttl, secret });
  setCookie(c, getAdminSessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttl,
  });
  writeAudit({
    timestamp: new Date().toISOString(),
    eventId: randomUUID(),
    actor: 'admin',
    action: 'admin.login',
    resource: 'session',
    result: 'success',
  });
  return c.json(ok({ message: 'Logged in' }));
});

adminRoutes.post('/logout', adminAuthMiddleware, (c) => {
  deleteCookie(c, getAdminSessionCookieName(), { path: '/' });
  writeAudit({
    timestamp: new Date().toISOString(),
    eventId: randomUUID(),
    actor: 'admin',
    action: 'admin.logout',
    resource: 'session',
    result: 'success',
  });
  return c.json(ok({ message: 'Logged out' }));
});

adminRoutes.post('/password', adminAuthMiddleware, async (c) => {
  const body = await c.req.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password || password.length < 8) {
    return c.json(fail('INVALID_PASSWORD', 'Password must be at least 8 characters'), 400);
  }

  try {
    await secretStore.set('AMICUS_ADMIN_PASSWORD', password);
    process.env.AMICUS_ADMIN_PASSWORD = password;

    // Also update .env file so password persists after server restart
    const repoRoot = join(process.cwd(), '..', '..');
    const envPath = join(repoRoot, '.env');
    let envUpdated = true;
    try {
      const envContent = await readFile(envPath, 'utf-8');
      const res = upsertEnvVar({ content: envContent, key: 'AMICUS_ADMIN_PASSWORD', value: password, overwrite: true });
      await writeFile(envPath, res.next, { encoding: 'utf-8' });
    } catch (envErr) {
      console.error('[Admin] Failed to update .env file:', envErr);
      envUpdated = false;
    }

    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'admin.passwordChange',
      resource: 'password',
      result: 'success',
    });

    if (!envUpdated) {
      return c.json(ok({ message: 'Password updated in memory, but .env file update failed' }));
    }
    return c.json(ok({ message: 'Password updated' }));
  } catch (e) {
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'admin.passwordChange',
      resource: 'password',
      result: 'failure',
      message: e instanceof Error ? e.message : String(e),
    });
    return c.json(fail('PASSWORD_UPDATE_FAILED', e instanceof Error ? e.message : String(e)), 500);
  }
});

adminRoutes.get('/session', adminAuthMiddleware, (c) => {
  return c.json(ok({ role: 'admin' }));
});

adminRoutes.get('/config', adminAuthMiddleware, (c) => {
  return c.json(ok(configManager.getSafeConfig()));
});

adminRoutes.patch('/config', adminAuthMiddleware, async (c) => {
  const patch = await c.req.json().catch(() => null);
  if (!patch) {
    return c.json(fail('INVALID_BODY', 'Invalid JSON body'), 400);
  }
  try {
    const updated = await configManager.update(patch);
    // Reload providers if LLM config changes.
    await providerService.reload();
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'config.update',
      resource: 'config',
      result: 'success',
    });
    return c.json(ok(updated));
  } catch (e) {
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'config.update',
      resource: 'config',
      result: 'failure',
      message: e instanceof Error ? e.message : String(e),
    });
    return c.json(fail('CONFIG_UPDATE_FAILED', e instanceof Error ? e.message : String(e)), 400);
  }
});

adminRoutes.post('/config/reload', adminAuthMiddleware, async (c) => {
  await configManager.load();
  await providerService.reload();
  writeAudit({
    timestamp: new Date().toISOString(),
    eventId: randomUUID(),
    actor: 'admin',
    action: 'config.reload',
    resource: 'config',
    result: 'success',
  });
  return c.json(ok({ message: 'Config reloaded' }));
});

adminRoutes.get('/providers', adminAuthMiddleware, (c) => {
  return c.json(ok(providerService.getAdminProviderView()));
});

adminRoutes.patch('/providers/:id', adminAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null) as { enabled?: unknown } | null;
  const enabled = typeof body?.enabled === 'boolean' ? body.enabled : undefined;
  if (enabled === undefined) {
    return c.json(fail('INVALID_BODY', 'Expected { enabled: boolean }'), 400);
  }

  const cfg = configManager.getConfig();
  const idx = cfg.llm.providers.findIndex((p) => p.id === id);
  if (idx < 0) {
    return c.json(fail('NOT_FOUND', `Unknown provider: ${id}`), 404);
  }

  const patch = {
    llm: {
      providers: cfg.llm.providers.map((p) => (p.id === id ? { ...p, enabled } : p)),
    },
  };

  await configManager.update(patch);
  await providerService.reload();
  writeAudit({
    timestamp: new Date().toISOString(),
    eventId: randomUUID(),
    actor: 'admin',
    action: enabled ? 'provider.enable' : 'provider.disable',
    resource: `provider:${id}`,
    result: 'success',
  });
  return c.json(ok({ id, enabled }));
});

adminRoutes.post('/providers/:id/apikey', adminAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null) as { apiKey?: unknown } | null;
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : '';
  if (!apiKey) {
    return c.json(fail('INVALID_BODY', 'Expected { apiKey: string }'), 400);
  }

  const cfg = configManager.getConfig();
  const provider = cfg.llm.providers.find((p) => p.id === id);
  if (!provider) {
    return c.json(fail('NOT_FOUND', `Unknown provider: ${id}`), 404);
  }
  
  const validationResult = await providerService.validateApiKey(id, apiKey);
  if (!validationResult.valid) {
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'provider.setApiKey',
      resource: `provider:${id}`,
      result: 'failure',
      message: `Invalid API key: ${validationResult.error ?? 'Unknown error'}`,
    });
    return c.json(fail('INVALID_API_KEY', validationResult.error ?? 'Invalid API key'), 400);
  }
  
  const envKey = provider.envKey ?? `${provider.id.toUpperCase()}_API_KEY`;
  try {
    await secretStore.set(envKey, apiKey);
    process.env[envKey] = apiKey;
    
    if (!provider.enabled) {
      await configManager.update({
        llm: {
          providers: cfg.llm.providers.map((p) => 
            p.id === id ? { ...p, enabled: true } : p
          ),
        },
      });
    }
    
    await providerService.reload();
    
    if (!cfg.llm.defaultModel) {
      const defaultModelName = defaultModelsByProvider[id];
      if (defaultModelName) {
        const newDefaultModel = `${id}:${defaultModelName}`;
        await configManager.update({
          llm: {
            defaultModel: newDefaultModel,
          },
        });
      }
    }
    
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'provider.setApiKey',
      resource: `provider:${id}`,
      result: 'success',
    });
    return c.json(ok({ id, updated: true }));
  } catch (e) {
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'provider.setApiKey',
      resource: `provider:${id}`,
      result: 'failure',
      message: e instanceof Error ? e.message : String(e),
    });
    return c.json(fail('SECRET_STORE_ERROR', e instanceof Error ? e.message : String(e)), 500);
  }
});

adminRoutes.delete('/providers/:id/unlink', adminAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const cfg = configManager.getConfig();
  const provider = cfg.llm.providers.find((p) => p.id === id);
  if (!provider) {
    return c.json(fail('NOT_FOUND', `Unknown provider: ${id}`), 404);
  }
  const envKey = provider.envKey ?? `${provider.id.toUpperCase()}_API_KEY`;

  await secretStore.delete(envKey);
  delete process.env[envKey];

  const patch = {
    llm: {
      providers: cfg.llm.providers.map((p) => (p.id === id ? { ...p, enabled: false } : p)),
    },
  };
  await configManager.update(patch);
  await providerService.reload();
  writeAudit({
    timestamp: new Date().toISOString(),
    eventId: randomUUID(),
    actor: 'admin',
    action: 'provider.unlink',
    resource: `provider:${id}`,
    result: 'success',
  });
  return c.json(ok({ id, unlinked: true }));
});

adminRoutes.get('/audit', adminAuthMiddleware, async (c) => {
  const limitRaw = c.req.query('limit');
  const limitParsed = limitRaw ? Number(limitRaw) : null;
  const limit = typeof limitParsed === 'number' && Number.isFinite(limitParsed)
    ? limitParsed
    : null;
  const events = limit !== null
    ? await readAudit({ limit })
    : await readAudit();
  return c.json(ok(events));
});

adminRoutes.post('/providers/:id/validate', adminAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null) as { apiKey?: unknown } | null;
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : '';

  if (!apiKey) {
    return c.json(fail('INVALID_BODY', 'Expected { apiKey: string }'), 400);
  }

  const cfg = configManager.getConfig();
  const provider = cfg.llm.providers.find((p) => p.id === id);
  if (!provider) {
    return c.json(fail('NOT_FOUND', `Unknown provider: ${id}`), 404);
  }

  try {
    const result = await providerService.validateApiKey(id, apiKey);
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'provider.validateApiKey',
      resource: `provider:${id}`,
      result: result.valid ? 'success' : 'failure',
      ...(result.valid ? {} : { message: result.error }),
    });
    return c.json(ok(result));
  } catch (e) {
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'provider.validateApiKey',
      resource: `provider:${id}`,
      result: 'failure',
      message: e instanceof Error ? e.message : String(e),
    });
    return c.json(fail('VALIDATION_ERROR', e instanceof Error ? e.message : String(e)), 500);
  }
});

adminRoutes.post('/providers/:id/test', adminAuthMiddleware, async (c) => {
  const id = c.req.param('id');

  const cfg = configManager.getConfig();
  const provider = cfg.llm.providers.find((p) => p.id === id);
  if (!provider) {
    return c.json(fail('NOT_FOUND', `Unknown provider: ${id}`), 404);
  }

  try {
    const result = await providerService.testConnection(id);
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'provider.testConnection',
      resource: `provider:${id}`,
      result: result.valid ? 'success' : 'failure',
      ...(result.valid ? {} : { message: result.error }),
    });
    return c.json(ok(result));
  } catch (e) {
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'provider.testConnection',
      resource: `provider:${id}`,
      result: 'failure',
      message: e instanceof Error ? e.message : String(e),
    });
    return c.json(fail('TEST_ERROR', e instanceof Error ? e.message : String(e)), 500);
  }
});
