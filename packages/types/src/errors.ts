/**
 * Base error class for all Amicus errors
 * All other error types should extend this base class
 */
export class AmicusError extends Error {
  /** Error code for programmatic error handling */
  code: string;

  /** Operation metadata for error tracking */
  metadata?: Record<string, unknown>;

  /** Error severity level */
  severity: 'error' | 'warning' | 'info';

  constructor(
    message: string,
    options?: {
      code?: string;
      severity?: 'error' | 'warning' | 'info';
      metadata?: Record<string, unknown> | undefined;
      stack?: string;
    }
  ) {
    super(message);
    this.name = 'AmicusError';

    this.code = options?.code ?? 'UNKNOWN_ERROR';
    this.severity = options?.severity ?? 'error';

    if (options?.metadata !== undefined) {
      this.metadata = options.metadata;
    }

    if (options?.stack) {
      this.stack = options.stack;
    }

    // Fix prototype chain for ES6 classes
    Object.setPrototypeOf(this, AmicusError.prototype);
  }

  /**
   * Check if this error is of a specific type
   */
  isType<T extends AmicusError>(this: T, className: typeof AmicusError): this is T {
    return this.constructor === className;
  }

  /**
   * Get error details as JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      metadata: this.metadata,
      stack: this.stack,
    };
  }
}

/**
 * Error class for invalid input errors
 */
export class ValidationError extends AmicusError {
  constructor(message: string, options?: { code?: string; metadata?: Record<string, unknown> }) {
    super(message, {
      code: options?.code || 'VALIDATION_ERROR',
      severity: 'error',
      metadata: options?.metadata,
    });
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error class for runtime errors
 */
export class RuntimeError extends AmicusError {
  constructor(message: string, options?: { code?: string; metadata?: Record<string, unknown> }) {
    super(message, {
      code: options?.code || 'RUNTIME_ERROR',
      severity: 'error',
      metadata: options?.metadata,
    });
    this.name = 'RuntimeError';
    Object.setPrototypeOf(this, RuntimeError.prototype);
  }
}

/**
 * Error class for configuration errors
 */
export class ConfigurationError extends AmicusError {
  constructor(message: string, options?: { code?: string; metadata?: Record<string, unknown> }) {
    super(message, {
      code: options?.code || 'CONFIGURATION_ERROR',
      severity: 'error',
      metadata: options?.metadata,
    });
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Error class for timeout errors
 */
export class TimeoutError extends AmicusError {
  constructor(message: string, options?: { code?: string; metadata?: Record<string, unknown> }) {
    super(message, {
      code: options?.code || 'TIMEOUT_ERROR',
      severity: 'error',
      metadata: options?.metadata,
    });
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Error class for network errors
 */
export class NetworkError extends AmicusError {
  constructor(message: string, options?: { code?: string; metadata?: Record<string, unknown> }) {
    super(message, {
      code: options?.code || 'NETWORK_ERROR',
      severity: 'error',
      metadata: options?.metadata,
    });
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Error class for safety violations
 */
export class SafetyViolationError extends AmicusError {
  constructor(
    message: string,
    options?: { code?: string; violationType?: string; metadata?: Record<string, unknown> }
  ) {
    super(message, {
      code: options?.code || 'SAFETY_VIOLATION',
      severity: 'error',
      metadata: {
        ...options?.metadata,
        violationType: options?.violationType,
      },
    });
    this.name = 'SafetyViolationError';
    Object.setPrototypeOf(this, SafetyViolationError.prototype);
  }
}
