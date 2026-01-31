import type { Tool } from "@amicus/mcp-client";

/**
 * Interface for the tool registry
 * Manages available tools for task execution
 */
export interface IToolRegistry {
  register(tool: Tool): void;
  unregister(name: string): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
  clear(): void;
}

/**
 * Registry for managing available tools
 */
export class ToolRegistry implements IToolRegistry {
  private readonly tools = new Map<string, Tool>();

  /**
   * Register a new tool
   * @param tool - The tool to register
   */
  register(tool: Tool): void {
    if (!tool.name) {
      throw new Error("Tool must have a name");
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool by name
   * @param name - The name of the tool to unregister
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Get a tool by name
   * @param name - The name of the tool
   * @returns The tool or undefined if not found
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   * @returns Array of all registered tools
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Check if a tool is registered
   * @param name - The name of the tool
   * @returns true if the tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the number of registered tools
   * @returns Number of registered tools
   */
  size(): number {
    return this.tools.size;
  }
}
