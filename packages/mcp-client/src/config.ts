import { readFile } from 'fs/promises';

/**
 * MCP Server Configuration Interface
 * Represents a single MCP server configuration
 */
export interface MCPServerConfig {
  /** Unique identifier for the server */
  id: string;
  
  /** Human-readable name for the server */
  name: string;
  
  /** Whether the server is enabled */
  enabled: boolean;
  
  /** Transport type - stdio for command-based, http for URL-based */
  transport: 'stdio' | 'http';
  
  /** Command to execute (for stdio transport) */
  command?: string;
  
  /** Arguments for the command (for stdio transport) */
  args?: string[];
  
  /** Server URL (for http transport) */
  serverUrl?: string;
  
  /** Environment variables to pass to the server */
  env?: Record<string, string>;
  
  /** Description of the server's purpose */
  description?: string;
  
  /** Root path for filesystem-based servers */
  rootPath?: string;
}

/**
 * MCP Configuration Interface
 * Top-level configuration containing all MCP servers
 */
export interface MCPConfig {
  /** Array of MCP server configurations */
  servers: MCPServerConfig[];
  
  /** Default server ID to use when none specified */
  defaultServer?: string;
}

/**
 * Validation result for MCP configuration
 */
export interface ValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  
  /** Array of validation errors if any */
  errors: string[];
}

/**
 * Environment variable substitution regex
 * Matches ${VAR_NAME} or ${VAR_NAME:-default}
 */
const ENV_VAR_REGEX = /\$\{([^}]+)\}/g;

/**
 * Substitutes environment variables in a string
 * Supports ${VAR_NAME} and ${VAR_NAME:-default} syntax
 * 
 * @param value - String potentially containing env var placeholders
 * @returns String with env vars substituted
 */
export function substituteEnvVars(value: string): string {
  return value.replace(ENV_VAR_REGEX, (match, varExpr) => {
    // Check for default value syntax: VAR_NAME:-default
    const [varName, defaultValue] = varExpr.split(':-');
    
    const envValue = process.env[varName];
    if (envValue !== undefined) {
      return envValue;
    }
    
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    // Return original if no substitution found and no default
    return match;
  });
}

/**
 * Processes environment variables in an object recursively
 * 
 * @param obj - Object containing potential env var placeholders
 * @returns New object with env vars substituted
 */
function processEnvVars<T>(obj: T): T {
  if (typeof obj === 'string') {
    return substituteEnvVars(obj) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => processEnvVars(item)) as unknown as T;
  }
  
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = processEnvVars(value);
    }
    return result as T;
  }
  
  return obj;
}

/**
 * Loads and parses MCP configuration from a JSON file
 * Performs environment variable substitution on string values
 * 
 * @param filepath - Path to the configuration JSON file
 * @returns Parsed and processed MCP configuration
 * @throws Error if file cannot be read or JSON is invalid
 * 
 * @example
 * ```typescript
 * const config = await loadMCPConfig('./data/mcp-servers.json');
 * // Environment variables like ${GITHUB_TOKEN} are substituted
 * ```
 */
export async function loadMCPConfig(filepath: string): Promise<MCPConfig> {
  try {
    const configData = await readFile(filepath, 'utf-8');
    const rawConfig: MCPConfig = JSON.parse(configData);
    
    // Process environment variable substitution
    const processedConfig = processEnvVars(rawConfig);
    
    return processedConfig;
  } catch (error) {
    if (error instanceof Error) {
      if ('code' in error && error.code === 'ENOENT') {
        throw new Error(`MCP configuration file not found: ${filepath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in MCP configuration file: ${filepath} - ${error.message}`);
      }
      throw new Error(`Failed to load MCP configuration: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validates an MCP server configuration
 * 
 * @param server - Server configuration to validate
 * @param index - Index of the server in the array (for error messages)
 * @returns Array of validation error messages
 */
function validateServerConfig(server: MCPServerConfig, index: number): string[] {
  const errors: string[] = [];
  const prefix = `Server[${index}]`;
  
  // Check required fields
  if (!server.id || typeof server.id !== 'string') {
    errors.push(`${prefix}: 'id' is required and must be a string`);
  }
  
  if (!server.name || typeof server.name !== 'string') {
    errors.push(`${prefix}: 'name' is required and must be a string`);
  }
  
  if (server.enabled === undefined || typeof server.enabled !== 'boolean') {
    errors.push(`${prefix}: 'enabled' is required and must be a boolean`);
  }
  
  // Validate transport type
  if (!server.transport) {
    errors.push(`${prefix}: 'transport' is required`);
  } else if (!['stdio', 'http'].includes(server.transport)) {
    errors.push(`${prefix}: 'transport' must be 'stdio' or 'http', got '${server.transport}'`);
  }
  
  // Transport-specific validations
  if (server.transport === 'stdio') {
    if (!server.command || typeof server.command !== 'string') {
      errors.push(`${prefix}: 'command' is required for stdio transport`);
    }
  } else if (server.transport === 'http') {
    if (!server.serverUrl || typeof server.serverUrl !== 'string') {
      errors.push(`${prefix}: 'serverUrl' is required for http transport`);
    }
    
    // Validate URL format
    if (server.serverUrl) {
      try {
        new URL(server.serverUrl);
      } catch {
        errors.push(`${prefix}: 'serverUrl' is not a valid URL: ${server.serverUrl}`);
      }
    }
  }
  
  // Validate args if present
  if (server.args !== undefined && !Array.isArray(server.args)) {
    errors.push(`${prefix}: 'args' must be an array of strings`);
  }
  
  // Validate env if present
  if (server.env !== undefined) {
    if (typeof server.env !== 'object' || server.env === null) {
      errors.push(`${prefix}: 'env' must be an object`);
    } else {
      for (const [key, value] of Object.entries(server.env)) {
        if (typeof value !== 'string') {
          errors.push(`${prefix}: env['${key}'] must be a string`);
        }
      }
    }
  }
  
  return errors;
}

/**
 * Validates MCP configuration
 * Checks for required fields, valid transport types, and proper formatting
 * 
 * @param config - Configuration object to validate
 * @returns ValidationResult with valid flag and any error messages
 * 
 * @example
 * ```typescript
 * const config = await loadMCPConfig('./data/mcp-servers.json');
 * const result = validateMCPConfig(config);
 * if (!result.valid) {
 *   console.error('Configuration errors:', result.errors);
 * }
 * ```
 */
export function validateMCPConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  
  // Check if config is an object
  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      errors: ['Configuration must be an object'],
    };
  }
  
  const configObj = config as MCPConfig;
  
  // Check servers array
  if (!configObj.servers) {
    errors.push("'servers' array is required");
  } else if (!Array.isArray(configObj.servers)) {
    errors.push("'servers' must be an array");
  } else if (configObj.servers.length === 0) {
    errors.push("'servers' array cannot be empty");
  } else {
    // Check for duplicate IDs
    const ids = configObj.servers.map(s => s.id).filter(Boolean);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate server IDs found: ${[...new Set(duplicateIds)].join(', ')}`);
    }
    
    // Validate each server
    configObj.servers.forEach((server, index) => {
      errors.push(...validateServerConfig(server, index));
    });
  }
  
  // Validate defaultServer if provided
  if (configObj.defaultServer !== undefined) {
    if (typeof configObj.defaultServer !== 'string') {
      errors.push("'defaultServer' must be a string");
    } else if (configObj.servers && Array.isArray(configObj.servers)) {
      const serverIds = configObj.servers.map(s => s.id);
      if (!serverIds.includes(configObj.defaultServer)) {
        errors.push(`'defaultServer' '${configObj.defaultServer}' not found in servers list`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Legacy interface name for backward compatibility
 * @deprecated Use MCPConfig instead
 */
export type MCPServersConfig = MCPConfig;
