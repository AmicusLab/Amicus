/**
 * LLM Model metadata and availability types
 */

// ============================================================================
// Model Metadata Types
// ============================================================================

/**
 * Model capabilities supported by LLM providers
 */
export type ModelCapability = 'text' | 'tools' | 'streaming' | 'thinking_mode' | 'vision';

/**
 * Model metadata for LLM providers
 *
 * Contains information about a model's capabilities, pricing, and characteristics.
 * Used by the Economist for model routing and cost estimation.
 */
export interface ModelMetadata {
  /** Unique model identifier (e.g., 'glm-4.7', 'claude-3-5-sonnet') */
  id: string;

  /** Human-readable model name */
  name: string;

  /** Description of the model's capabilities and use cases */
  description: string;

  /** Provider name (e.g., 'zai', 'anthropic', 'openai') */
  provider: string;

  /** Maximum context window size in tokens */
  contextWindow: number;

  /** Maximum output tokens for a single completion */
  maxOutputTokens: number;

  /** Input cost per 1M tokens (USD) */
  inputCostPer1M: number;

  /** Output cost per 1M tokens (USD) */
  outputCostPer1M: number;

  /** Array of supported capabilities */
  capabilities: ModelCapability[];

  /** Complexity range this model can handle (0-100) */
  complexityRange: {
    /** Minimum complexity score this model can handle */
    min: number;
    /** Maximum complexity score this model can handle */
    max: number;
  };
}

// ============================================================================
// Model Availability Types
// ============================================================================

/**
 * Model availability status
 *
 * Tracks the health and availability of a model endpoint.
 * Used by daemon to monitor model status and handle failures.
 */
export interface ModelAvailability {
  /** Model ID (matches ModelMetadata.id) */
  id: string;

  /** Whether the model is currently healthy and reachable */
  healthy: boolean;

  /** Timestamp of last availability check (Unix ms) */
  lastChecked: number;
}
