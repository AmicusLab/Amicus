import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { configManager, secretStore } from '../services/ConfigService.js';
import { getAdminSessionCookieName, verifyAdminSessionToken } from '../admin/session.js';

function getSessionSecret(): string {
  return (
    process.env.AMICUS_ADMIN_SESSION_SECRET ||
    process.env.CONFIG_ENCRYPTION_KEY ||
    ''
  );
}

export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path;
  if (path === '/health' || path.startsWith('/health/')) {
    return next();
  }

  // Admin routes have their own auth.
  if (path.startsWith('/admin')) {
    return next();
  }

  const cfg = configManager.getConfig();
  const authEnabled = cfg.auth.enabled || !!process.env.AMICUS_API_KEY || !!secretStore.get('AMICUS_API_KEY');
  if (!authEnabled) {
    return next();
  }

  // Allow admin session cookie to access protected endpoints.
  const secret = getSessionSecret();
  if (secret) {
    const token = getCookie(c, getAdminSessionCookieName());
    if (token) {
      const session = verifyAdminSessionToken({ token, nowMs: Date.now(), secret });
      if (session) {
        return next();
      }
    }
  }

  const expectedApiKey = process.env.AMICUS_API_KEY || secretStore.get('AMICUS_API_KEY');
  if (!expectedApiKey) {
    return c.json({ error: 'Unauthorized - API key not configured' }, 401);
  }

  const authHeader = c.req.header('Authorization');
  
  if (!authHeader) {
    return c.json({ error: 'Unauthorized - No Authorization header' }, 401);
  }

  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    return c.json({ error: 'Unauthorized - Invalid Authorization format. Use: Bearer <token>' }, 401);
  }

  if (token !== expectedApiKey) {
    return c.json({ error: 'Unauthorized - Invalid API key' }, 401);
  }

  return next();
}
