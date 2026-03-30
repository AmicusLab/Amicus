/**
 * Session API Routes
 * 
 * RESTful endpoints for chat session management:
 * - GET    /api/chat/sessions      - List sessions
 * - POST   /api/chat/sessions      - Create session
 * - GET    /api/chat/sessions/:id  - Get session
 * - DELETE /api/chat/sessions/:id  - Delete session (soft)
 * - POST   /api/chat/sessions/:id/restore - Restore session
 */

import { Hono } from 'hono';
import { SessionService, SessionServiceError } from '../services/SessionService';
import type { ChatSession } from '@amicus/types';

/**
 * Standard error response format
 */
interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Map SessionServiceError to HTTP status codes
 */
function mapErrorToStatus(error: SessionServiceError): number {
  switch (error.code) {
    case 'INVALID_SESSION_ID':
      return 400;
    case 'SESSION_NOT_FOUND':
    case 'SESSION_NOT_IN_TRASH':
      return 404;
    case 'MAX_SESSIONS_EXCEEDED':
    case 'MAX_MESSAGES_EXCEEDED':
      return 403;
    default:
      return 500;
  }
}

/**
 * Create error response
 */
function errorResponse(error: SessionServiceError): ErrorResponse {
  return {
    error: error.message,
    code: error.code,
    details: error.details,
  };
}

/**
 * Create session routes with injected service
 */
export function sessionRoutes(service: SessionService): Hono {
  const app = new Hono();

  /**
   * GET /api/chat/sessions
   * List all sessions (paginated)
   */
  app.get('/', async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '100', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      const sessions = await service.list({ limit, offset });
      return c.json(sessions);
    } catch (error) {
      console.error('[Sessions] List error:', error);
      return c.json(
        { error: 'Failed to list sessions', code: 'INTERNAL_ERROR' } as ErrorResponse,
        500
      );
    }
  });

  /**
   * POST /api/chat/sessions
   * Create a new session
   */
  app.post('/', async (c) => {
    try {
      let body: { title?: string } = {};
      
      const rawBody = await c.req.text();
      if (rawBody.trim() !== '') {
        try {
          body = JSON.parse(rawBody);
        } catch (parseError) {
          console.error('[Sessions] Create parse error:', parseError);
          return c.json(
            { error: 'Invalid JSON in request body', code: 'INVALID_JSON' } as ErrorResponse,
            400
          );
        }
      }

      const session = await service.create({
        title: body.title,
      });

      return c.json(session satisfies ChatSession, 201);
    } catch (error) {
      if (error instanceof SessionServiceError) {
        return c.json(errorResponse(error), mapErrorToStatus(error));
      }
      console.error('[Sessions] Create error:', error);
      return c.json(
        { error: 'Failed to create session', code: 'INTERNAL_ERROR' } as ErrorResponse,
        500
      );
    }
  });

  /**
   * GET /api/chat/sessions/:id
   * Get a session by ID
   */
  app.get('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const session = await service.get(id);

      if (!session) {
        return c.json(
          { error: 'Session not found', code: 'SESSION_NOT_FOUND' } as ErrorResponse,
          404
        );
      }

      return c.json(session satisfies ChatSession);
    } catch (error) {
      if (error instanceof SessionServiceError) {
        return c.json(errorResponse(error), mapErrorToStatus(error));
      }
      console.error('[Sessions] Get error:', error);
      return c.json(
        { error: 'Failed to get session', code: 'INTERNAL_ERROR' } as ErrorResponse,
        500
      );
    }
  });

  /**
   * DELETE /api/chat/sessions/:id
   * Soft delete a session (move to trash)
   */
  app.delete('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      await service.delete(id);

      return c.json({ success: true });
    } catch (error) {
      if (error instanceof SessionServiceError) {
        return c.json(errorResponse(error), mapErrorToStatus(error));
      }
      console.error('[Sessions] Delete error:', error);
      return c.json(
        { error: 'Failed to delete session', code: 'INTERNAL_ERROR' } as ErrorResponse,
        500
      );
    }
  });

  /**
   * POST /api/chat/sessions/:id/restore
   * Restore a deleted session from trash
   */
  app.post('/:id/restore', async (c) => {
    try {
      const id = c.req.param('id');
      const session = await service.restore(id);

      return c.json(session satisfies ChatSession);
    } catch (error) {
      if (error instanceof SessionServiceError) {
        return c.json(errorResponse(error), mapErrorToStatus(error));
      }
      console.error('[Sessions] Restore error:', error);
      return c.json(
        { error: 'Failed to restore session', code: 'INTERNAL_ERROR' } as ErrorResponse,
        500
      );
    }
  });

  return app;
}

// Export a default Hono instance for direct mounting
export default sessionRoutes;
