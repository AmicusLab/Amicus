/**
 * Safety and governance types
 */

/**
 * Safety executor options
 */
export interface SafetyExecutorOptions {
  /** Root directory of the repository */
  repoRoot: string;
  /** Safety check timeout */
  timeout?: number;
  /** Callback for progress updates */
  onProgress?: (event: AuditEvent) => void;
  /** Enable sandbox mode */
  sandboxMode?: boolean;
  /** Maximum file changes allowed */
  maxChanges?: number;
  /** Safety rules configuration */
  rules?: SafetyRule[];
}

/**
 * Safety rule types
 */
export enum SafetyRuleType {
  /** Prevents modifications to critical files */
  BLOCK_CRITICAL_FILES = 'block_critical_files',
  /** Prevents dangerous git operations */
  BLOCK_DANGEROUS_GIT_OPS = 'block_dangerous_git_ops',
  /** Validates file changes before commit */
  VALIDATE_CHANGES = 'validate_changes',
  /** Monitors for malicious code patterns */
  MONITOR_MALICIOUS_PATTERNS = 'monitor_malicious_patterns',
  /** Restricts API key usage */
  RESTRICT_API_KEY_USAGE = 'restrict_api_key_usage',
  /** Prevents unauthorized directory access */
  RESTRICT_DIRECTORY_ACCESS = 'restrict_directory_access',
  /** Validates all commits before pushing */
  VALIDATE_COMMITS = 'validate_commits',
}

/**
 * Safety rule configuration
 */
export interface SafetyRule {
  /** Rule identifier */
  id: string;
  /** Rule type */
  type: SafetyRuleType;
  /** Rule description */
  description: string;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Rule priority (higher = evaluated first) */
  priority: number;
  /** Custom rule configuration */
  config?: Record<string, unknown>;
}

/**
 * Audit phase enumeration
 */
export enum AuditPhase {
  /** Initial state check */
  PRE_CHECK = 'pre_check',
  /** Analysis phase */
  ANALYSIS = 'analysis',
  /** Validation phase */
  VALIDATION = 'validation',
  /** Final decision phase */
  DECISION = 'decision',
}

/**
 * Audit event structure
 */
export interface AuditEvent {
  /** Audit phase */
  phase: AuditPhase;
  /** Event type */
  eventType: string;
  /** Event message */
  message: string;
  /** Timestamp */
  timestamp: number;
  /** Event severity */
  severity: 'info' | 'warning' | 'error';
  /** Related operation ID */
  operationId?: string;
  /** Violation details if applicable */
  violation?: {
    type: string;
    details?: Record<string, unknown>;
  };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Audit result
 */
export interface AuditResult {
  /** Whether audit passed */
  passed: boolean;
  /** Phase that failed if applicable */
  failedPhase?: AuditPhase;
  /** Events generated during audit */
  events: AuditEvent[];
  /** Overall score (0-100) */
  score: number;
  /** Violations found */
  violations: SafetyViolation[];
  /** Recommendations */
  recommendations?: string[];
}

/**
 * Safety violation structure
 */
export interface SafetyViolation {
  /** Violation ID */
  id: string;
  /** Violation type */
  type: string;
  /** Violation message */
  message: string;
  /** Severity */
  severity: 'error' | 'warning' | 'info';
  /** Violation timestamp */
  timestamp: number;
  /** File or location information */
  location?: {
    path?: string;
    line?: number;
    column?: number;
  };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Dirty state strategy
 */
export enum DirtyStateStrategy {
  /** Throw error when dirty state detected */
  ERROR = 'error',
  /** Stash changes automatically */
  STASH = 'stash',
  /** Force changes (not recommended) */
  FORCE = 'force',
}

/**
 * Safety configuration for operations
 */
export interface SafetyConfig {
  /** Enable safety checks */
  enabled: boolean;
  /** Strategy for dirty state */
  dirtyStateStrategy: DirtyStateStrategy;
  /** Maximum allowed changes */
  maxChanges: number;
  /** Timeout for safety checks */
  timeout: number;
}

/**
 * Safety check result
 */
export interface SafetyCheckResult {
  /** Check passed */
  passed: boolean;
  /** Messages for this check */
  messages: string[];
  /** Warnings */
  warnings: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}
