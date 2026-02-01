import type { Context, Next } from 'hono';

const API_KEY = process.env.AMICUS_API_KEY;

export async function authMiddleware(c: Context, next: Next) {
  if (c.req.path === '/health') {
    return next();
  }

  if (!API_KEY) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  
  if (!authHeader) {
    return c.json({ error: 'Unauthorized - No Authorization header' }, 401);
  }

  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    return c.json({ error: 'Unauthorized - Invalid Authorization format. Use: Bearer <token>' }, 401);
  }

  if (token !== API_KEY) {
    return c.json({ error: 'Unauthorized - Invalid API key' }, 401);
  }

  return next();
}
