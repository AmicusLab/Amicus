/**
 * SessionService - Manages chat session persistence
 * 
 * Uses Bun SQLite for metadata and filesystem for session data.
 * Implements soft delete with .trash directory and corrupt handling with .corrupt directory.
 */

import { Database } from 'bun:sqlite';
import { randomUUID } from 'crypto';
import { mkdirSync, existsSync, writeFileSync, renameSync } from 'fs';
import { join, resolve } from 'path';
import type { ChatSession } from '@amicus/types';
import { validateSessionId, SESSION_LIMITS } from '@amicus/types';

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
  title?: string;
}

/**
 * Options for updating a session
 */
export interface UpdateSessionOptions {
  title?: string;
}

/**
 * Options for listing sessions
 */
export interface ListSessionsOptions {
  limit?: number;
  offset?: number;
}

/**
 * Error response format
 */
export interface SessionError {
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Custom error class for session-related errors
 */
export class SessionServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SessionServiceError';
  }
}

/**
 * Service for managing chat sessions
 */
export class SessionService {
  private readonly db: Database;
  private readonly dataDir: string;
  private readonly trashDir: string;
  private readonly corruptDir: string;

  constructor(db: Database, dataDir: string) {
    this.db = db;
    this.dataDir = this.sanitizePath(dataDir);
    this.trashDir = join(this.dataDir, '.trash');
    this.corruptDir = join(this.dataDir, '.corrupt');
    
    this.initialize();
  }

  /**
   * Initialize database schema and directories
   */
  private initialize(): void {
    // Create directories
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    if (!existsSync(this.trashDir)) {
      mkdirSync(this.trashDir, { recursive: true });
    }
    if (!existsSync(this.corruptDir)) {
      mkdirSync(this.corruptDir, { recursive: true });
    }

    // Create sessions table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        messageCount INTEGER NOT NULL DEFAULT 0,
        isDeleted INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Create index for listing
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_sessions_updated 
      ON sessions(updatedAt DESC)
    `);
  }

  /**
   * Sanitize path to prevent path traversal
   */
  private sanitizePath(path: string): string {
    const resolved = resolve(path);
    // Ensure path is absolute and normalized
    return resolved;
  }

  /**
   * Validate session ID and ensure no path traversal
   */
  private validateId(id: string): void {
    if (!validateSessionId(id)) {
      throw new SessionServiceError('Invalid session ID', 'INVALID_SESSION_ID');
    }
  }

  /**
   * Get session file path
   */
  private getSessionPath(id: string, isTrash: boolean = false): string {
    const baseDir = isTrash ? this.trashDir : this.dataDir;
    return join(baseDir, `${id}.json`);
  }

  /**
   * Create a new session
   */
  async create(options: CreateSessionOptions = {}): Promise<ChatSession> {
    // Check session limit
    const count = this.getCount();
    if (count >= SESSION_LIMITS.MAX_SESSIONS) {
      throw new SessionServiceError('Maximum sessions limit reached', 'MAX_SESSIONS_EXCEEDED');
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const title = options.title ?? 'New Chat';

    const session: ChatSession = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    // Insert into database
    this.db.run(
      `INSERT INTO sessions (id, title, createdAt, updatedAt, messageCount, isDeleted)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [id, title, now, now, 0]
    );

    // Write session file
    const filePath = this.getSessionPath(id);
    writeFileSync(filePath, JSON.stringify(session, null, 2));

    return session;
  }

  /**
   * Get a session by ID
   */
  async get(id: string): Promise<ChatSession | null> {
    this.validateId(id);

    const row = this.db.query<{
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      messageCount: number;
    }, [string]>(`
      SELECT id, title, createdAt, updatedAt, messageCount
      FROM sessions
      WHERE id = ? AND isDeleted = 0
    `).get(id);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messageCount: row.messageCount,
    };
  }

  /**
   * Get a session from trash by ID
   */
  async getFromTrash(id: string): Promise<ChatSession | null> {
    this.validateId(id);

    const row = this.db.query<{
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      messageCount: number;
    }, [string]>(`
      SELECT id, title, createdAt, updatedAt, messageCount
      FROM sessions
      WHERE id = ? AND isDeleted = 1
    `).get(id);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messageCount: row.messageCount,
    };
  }

  /**
   * List all sessions (sorted by updatedAt desc)
   */
  async list(options: ListSessionsOptions = {}): Promise<ChatSession[]> {
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const rows = this.db.query<{
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      messageCount: number;
    }, [number, number]>(`
      SELECT id, title, createdAt, updatedAt, messageCount
      FROM sessions
      WHERE isDeleted = 0
      ORDER BY updatedAt DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messageCount: row.messageCount,
    }));
  }

  /**
   * Update a session
   */
  async update(id: string, options: UpdateSessionOptions): Promise<ChatSession> {
    this.validateId(id);

    const existing = await this.get(id);
    if (!existing) {
      throw new SessionServiceError('Session not found', 'SESSION_NOT_FOUND');
    }

    const now = new Date().toISOString();
    const title = options.title ?? existing.title;

    this.db.run(
      `UPDATE sessions SET title = ?, updatedAt = ? WHERE id = ?`,
      [title, now, id]
    );

    // Update JSON file to keep it in sync with database
    const updatedSession = {
      ...existing,
      title,
      updatedAt: now,
    };
    const filePath = this.getSessionPath(id);
    writeFileSync(filePath, JSON.stringify(updatedSession, null, 2));

    return updatedSession;
  }

  /**
   * Soft delete a session (move to trash)
   */
  async delete(id: string): Promise<void> {
    this.validateId(id);

    const existing = await this.get(id);
    if (!existing) {
      throw new SessionServiceError('Session not found', 'SESSION_NOT_FOUND');
    }

    const now = new Date().toISOString();

    // Mark as deleted in database
    this.db.run(
      `UPDATE sessions SET isDeleted = 1, updatedAt = ? WHERE id = ?`,
      [now, id]
    );

    // Move session file to trash
    const sourcePath = this.getSessionPath(id);
    const trashPath = this.getSessionPath(id, true);
    
    if (existsSync(sourcePath)) {
      renameSync(sourcePath, trashPath);
    }
  }

  /**
   * Restore a session from trash
   */
  async restore(id: string): Promise<ChatSession> {
    this.validateId(id);

    const trashed = await this.getFromTrash(id);
    if (!trashed) {
      throw new SessionServiceError('Session not found in trash', 'SESSION_NOT_IN_TRASH');
    }

    const now = new Date().toISOString();

    // Mark as not deleted in database
    this.db.run(
      `UPDATE sessions SET isDeleted = 0, updatedAt = ? WHERE id = ?`,
      [now, id]
    );

    // Move session file back from trash
    const trashPath = this.getSessionPath(id, true);
    const sourcePath = this.getSessionPath(id);
    
    if (existsSync(trashPath)) {
      renameSync(trashPath, sourcePath);
    }

    return {
      ...trashed,
      updatedAt: now,
    };
  }

  /**
   * Increment message count for a session
   */
  async incrementMessageCount(id: string): Promise<void> {
    this.validateId(id);

    const existing = await this.get(id);
    if (!existing) {
      throw new SessionServiceError('Session not found', 'SESSION_NOT_FOUND');
    }

    if (existing.messageCount >= SESSION_LIMITS.MAX_MESSAGES_PER_SESSION) {
      throw new SessionServiceError('Maximum messages per session reached', 'MAX_MESSAGES_EXCEEDED');
    }

    const now = new Date().toISOString();
    this.db.run(
      `UPDATE sessions SET messageCount = messageCount + 1, updatedAt = ? WHERE id = ?`,
      [now, id]
    );

    // Update JSON file to keep it in sync with database
    const updatedSession = {
      ...existing,
      messageCount: existing.messageCount + 1,
      updatedAt: now,
    };
    const filePath = this.getSessionPath(id);
    writeFileSync(filePath, JSON.stringify(updatedSession, null, 2));
  }

  /**
   * Get total count of active sessions
   */
  private getCount(): number {
    const row = this.db.query<{ count: number }, []>(`
      SELECT COUNT(*) as count FROM sessions WHERE isDeleted = 0
    `).get();
    
    return row?.count ?? 0;
  }

  /**
   * Move a corrupt session to .corrupt directory
   */
  async markCorrupt(id: string, reason: string): Promise<void> {
    this.validateId(id);

    const sourcePath = this.getSessionPath(id);
    const corruptPath = join(this.corruptDir, `${id}.json`);

    if (existsSync(sourcePath)) {
      // Write error info
      const errorInfo = {
        id,
        reason,
        movedAt: new Date().toISOString(),
      };
      writeFileSync(
        join(this.corruptDir, `${id}.error.json`),
        JSON.stringify(errorInfo, null, 2)
      );
      
      renameSync(sourcePath, corruptPath);
    }

    // Remove from database
    this.db.run(`DELETE FROM sessions WHERE id = ?`, [id]);
  }
}
