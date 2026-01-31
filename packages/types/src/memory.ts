/**
 * Memory and context management types
 */

/**
 * Context manager options
 */
export interface ContextManagerOptions {
  /** Root directory of the repository */
  repoRoot: string;
  /** Maximum context window size */
  maxContextSize?: number;
  /** How many recent operations to remember */
  maxHistorySize?: number;
  /** Context retention time in milliseconds */
  retentionPeriod?: number;
  /** Enable memory compression */
  enableCompression?: boolean;
  /** Compression strategy */
  compressionStrategy?: 'none' | 'aggressive' | 'moderate';
}

/**
 * Memory section types
 */
export enum MemorySection {
  TASKS = 'tasks',
  THOUGHTS = 'thoughts',
  ACTIONS = 'actions',
  DECISIONS = 'decisions',
  CONTEXT = 'context',
  METADATA = 'metadata',
  CHAT = 'chat',
  ARCHIVE = 'archive',
}

/**
 * Memory snapshot representing current state
 */
export interface MemorySnapshot {
  /** Current task context */
  currentContext: Record<string, unknown>;
  /** Available memory sections with content */
  memoryContext: Map<MemorySection, unknown[]>;
  /** Snapshot timestamp */
  timestamp: number;
  /** Snapshot ID */
  id: string;
  /** Snapshot metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Memory update structure
 */
export interface MemoryUpdate {
  /** Section to update */
  section: MemorySection;
  /** Content to add or update */
  content: unknown;
  /** Update metadata */
  metadata?: {
    userId?: string;
    timestamp?: number;
    action?: 'add' | 'update' | 'delete';
  };
}

/**
 * Memory query options
 */
export interface MemoryQueryOptions {
  /** Memory section to query */
  section: MemorySection;
  /** Maximum results to return */
  limit?: number;
  /** Filter criteria */
  filter?: Record<string, unknown>;
  /** Include deleted items */
  includeDeleted?: boolean;
}

/**
 * Memory query result
 */
export interface MemoryQueryResult<T = unknown> {
  /** Results found */
  results: T[];
  /** Total matching results */
  total: number;
  /** Offset used for pagination */
  offset: number;
  /** Query execution time in milliseconds */
  duration?: number;
}

/**
 * Context reset options
 */
export interface ContextResetOptions {
  /** Clear all memory sections */
  clearAll?: boolean;
  /** Specific sections to clear */
  clearSections?: MemorySection[];
  /** Keep specific sections */
  keepSections?: MemorySection[];
  /** Remove old snapshots */
  clearOldSnapshots?: boolean;
}

/**
 * Context metadata
 */
export interface ContextMetadata {
  /** Context creation time */
  createdAt: number;
  /** Context last accessed */
  lastAccessed: number;
  /** Context size in bytes */
  size?: number;
  /** Context version */
  version: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Memory persistence options
 */
export interface PersistenceOptions {
  /** Enable persistence */
  enabled: boolean;
  /** Persistence storage path */
  storagePath?: string;
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
  /** Enable versioning */
  versioning?: boolean;
}
