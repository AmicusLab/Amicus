/**
 * Chat session types for conversation history management
 * 
 * @module session
 */

/**
 * UUID v4 validation regex
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where x is any hex digit and y is one of 8, 9, a, or b
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a valid UUID v4
 * @param id - The ID to validate
 * @returns true if valid UUID v4, false otherwise
 */
export function validateSessionId(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

/**
 * Represents a chat session with metadata
 */
export interface ChatSession {
  /** Unique session identifier (UUID v4) */
  id: string;
  /** Session title (auto-generated or user-defined) */
  title: string;
  /** ISO 8601 timestamp when session was created */
  createdAt: string;
  /** ISO 8601 timestamp when session was last updated */
  updatedAt: string;
  /** Number of messages in the session */
  messageCount: number;
}

/**
 * Session limits and constraints
 */
export const SESSION_LIMITS = {
  /** Maximum number of sessions allowed */
  MAX_SESSIONS: 1000,
  /** Maximum messages per session */
  MAX_MESSAGES_PER_SESSION: 10000,
  /** Maximum session size in bytes (10MB) */
  MAX_SESSION_SIZE_BYTES: 10 * 1024 * 1024,
} as const;

/**
 * Type guard to check if an object is a valid ChatSession
 * @param obj - The object to check
 * @returns true if valid ChatSession, false otherwise
 */
export function isChatSession(obj: unknown): obj is ChatSession {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return false;
  }

  const session = obj as Record<string, unknown>;

  // Check all required fields exist and have correct types
  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    typeof session.createdAt === 'string' &&
    typeof session.updatedAt === 'string' &&
    typeof session.messageCount === 'number' &&
    Number.isInteger(session.messageCount) &&
    session.messageCount >= 0
  );
}
