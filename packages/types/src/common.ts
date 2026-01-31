/**
 * Common types and base interfaces
 */

/**
 * Base options interface with common configuration parameters
 */
export interface BaseOptions {
  /** Root directory of the repository (optional for CLI usage) */
  repoRoot?: string;
  /** Operation timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retry attempts */
  retryCount?: number;
  /** API key or access token */
  apiKey?: string;
  /** Project ID or namespace */
  projectId?: string;
  /** User ID for tracking and authorization */
  userId?: string;
  /** Configuration for operation tracking */
  tracking?: {
    enabled?: boolean;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Generic result type for operations
 * @template T - The type of successful data
 */
export interface Result<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Data returned on success */
  data?: T;
  /** Error details on failure */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    stack?: string;
  };
  /** Operation timestamp */
  timestamp: number;
}

/**
 * Metadata for tracking operations
 */
export interface OperationMetadata {
  /** Unique operation identifier */
  operationId: string;
  /** User ID if available */
  userId?: string;
  /** Operation timestamp */
  timestamp: number;
  /** Related operation IDs */
  parentIds?: string[];
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Operation category */
  category?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Number of items per page */
  limit?: number;
  /** Page number (1-based) */
  page?: number;
  /** Sort field */
  sort?: string;
  /** Sort direction */
  order?: 'asc' | 'desc';
}
