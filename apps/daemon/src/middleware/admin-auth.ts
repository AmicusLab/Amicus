import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { getAdminSessionCookieName, verifyAdminSessionToken } from '../admin/session.js';

function getSessionSecret(): string {
  return (
    process.env.AMICUS_ADMIN_SESSION_SECRET ||
    process.env.CONFIG_ENCRYPTION_KEY ||
    ''
  );
}

export async function adminAuthMiddleware(c: Context, next: Next) {
  const secret = getSessionSecret();
  if (!secret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = getCookie(c, getAdminSessionCookieName());
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const session = verifyAdminSessionToken({ token, nowMs: Date.now(), secret });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('adminSession', session);
  return next();
}
