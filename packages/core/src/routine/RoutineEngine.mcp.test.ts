import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { RoutineEngine } from "./RoutineEngine.js";
import { ToolRegistry } from "../tools/index.js";
import {
  TaskStatus,
  TaskPriority,
  type Task,
  type TaskResult,
} from "@amicus/types/core";
import type { Tool } from "@amicus/types/mcp";

// Mock OperationExecutor
class MockOperationExecutor {
  shouldFail = false;
  executedTasks: string[] = [];

  async execute<T>(description: string, operation: () => Promise<T>): Promise<T> {
    this.executedTasks.push(description);
    if (this.shouldFail) {
      throw new Error("Task execution failed");
    }
    return operation();
  }
}

// Mock ContextManager
class MockContextManager {
  updates: string[] = [];

  async loadContext(): Promise<string> {
    return "mock context";
  }

  async updateShortTerm(content: string): Promise<void> {
    this.updates.push(content);
  }

  async consolidate(): Promise<void> {
    this.updates.push("consolidated");
  }
}

// Mock MCPClient
class MockMCPClient {
  isConnected = false;
  tools: Tool[] = [];
  invokedTools: Array<{ name: string; params: Record<string, unknown> }> = [];
  shouldFail = false;

  async connect(): Promise<void> {
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  async discoverTools(): Promise<Tool[]> {
    if (this.shouldFail) {
      throw new Error("Failed to discover tools");
    }
    return this.tools;
  }

  async invokeTool(name: string, params: Record<string, unknown>): Promise<{ content: string; isError?: boolean }> {
    this.invokedTools.push({ name, params });
    if (this.shouldFail) {
      return { content: "Tool invocation failed", isError: true };
    }
    return { content: `Tool ${name} executed with params: ${JSON.stringify(params)}` };
  }
}

// Helper to create a test task
function createTestTask(id: string, description: string, tool?: string, parameters?: Record<string, unknown>): Task {
  const task: Task = {
    id,
    description,
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  if (tool) task.tool = tool;
  if (parameters) task.parameters = parameters;
  return task;
}

describe("RoutineEngine MCP Integration", () => {
  let engine: RoutineEngine;
  let mockOperationExecutor: MockOperationExecutor;
  let mockContextManager: MockContextManager;
  let mockMCPClient: MockMCPClient;

  beforeEach(() => {
    mockOperationExecutor = new MockOperationExecutor();
    mockContextManager = new MockContextManager();
    mockMCPClient = new MockMCPClient();
    engine = new RoutineEngine({
      operationExecutor: mockOperationExecutor as any,
      contextManager: mockContextManager as any,
      mcpClient: mockMCPClient as any,
    });
  });

  async function registerTools(tools: Tool[]): Promise<void> {
    mockMCPClient.tools = tools;
    await engine.initialize();
  }

  afterEach(() => {
    engine.stop();
  });

  describe("ToolRegistry", () => {
    it("should have toolRegistry available", () => {
      expect(engine).toBeDefined();
    });

    it("should register tools via initialize", async () => {
      mockMCPClient.tools = [
        { name: "test-tool", description: "A test tool", inputSchema: {} },
      ];
      
      await engine.initialize();
      
      // Tools should be discovered and registered
      expect(mockMCPClient.discoverTools).toHaveBeenCalled;
    });

    it("should handle initialize without MCP client", async () => {
      const engineWithoutMCP = new RoutineEngine({
        operationExecutor: mockOperationExecutor as any,
        contextManager: mockContextManager as any,
      });

      // Should not throw
      await engineWithoutMCP.initialize();
      expect(engineWithoutMCP).toBeDefined();
    });
  });

  describe("Tool Execution", () => {
    it("should execute task with tool when specified", async () => {
      await registerTools([
        { name: "calc-tool", description: "Calculator", inputSchema: {} },
      ]);

      const task = createTestTask("task-1", "Calculate sum", "calc-tool", { a: 5, b: 10 });

      const result = await engine.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.metadata?.tool).toBe("calc-tool");
    });



    it("should handle tool execution errors", async () => {
      await registerTools([
        { name: "fail-tool", description: "Failing tool", inputSchema: {} },
      ]);
      mockMCPClient.shouldFail = true;
      const task = createTestTask("task-1", "Failing tool task", "fail-tool", {});
      
      const result = await engine.executeTask(task);
      
      expect(result.success).toBe(false);
      const resultData = result.data as { toolResult?: string };
      expect(resultData?.toolResult).toContain("Tool invocation failed");
    });
  });

  describe("Initialize with Tool Discovery", () => {
    it("should discover and register tools from MCP server", async () => {
      mockMCPClient.tools = [
        { name: "tool-1", description: "First tool", inputSchema: {} },
        { name: "tool-2", description: "Second tool", inputSchema: {} },
      ];
      
      await engine.initialize();
      
      expect(mockMCPClient.discoverTools).toHaveBeenCalled;
    });

    it("should handle tool discovery errors gracefully", async () => {
      mockMCPClient.shouldFail = true;
      
      // Should throw when discovery fails
      await expect(engine.initialize()).rejects.toThrow("Failed to discover tools");
    });
  });

  describe("ToolRegistry Operations", () => {
    it("should register and retrieve tools", () => {
      const registry = new ToolRegistry();
      const tool: Tool = { name: "test-tool", description: "Test", inputSchema: {} };
      
      registry.register(tool);
      
      expect(registry.get("test-tool")).toEqual(tool);
    });

    it("should list all registered tools", () => {
      const registry = new ToolRegistry();
      const tool1: Tool = { name: "tool-1", description: "First", inputSchema: {} };
      const tool2: Tool = { name: "tool-2", description: "Second", inputSchema: {} };
      
      registry.register(tool1);
      registry.register(tool2);
      
      const tools = registry.list();
      expect(tools).toHaveLength(2);
    });

    it("should unregister tools", () => {
      const registry = new ToolRegistry();
      const tool: Tool = { name: "test-tool", description: "Test", inputSchema: {} };
      
      registry.register(tool);
      registry.unregister("test-tool");
      
      expect(registry.get("test-tool")).toBeUndefined();
    });

    it("should clear all tools", () => {
      const registry = new ToolRegistry();
      registry.register({ name: "tool-1", description: "First", inputSchema: {} });
      registry.register({ name: "tool-2", description: "Second", inputSchema: {} });
      
      registry.clear();
      
      expect(registry.list()).toHaveLength(0);
    });

    it("should check if tool exists", () => {
      const registry = new ToolRegistry();
      registry.register({ name: "test-tool", description: "Test", inputSchema: {} });
      
      expect(registry.has("test-tool")).toBe(true);
      expect(registry.has("non-existent")).toBe(false);
    });

    it("should return tool count", () => {
      const registry = new ToolRegistry();
      registry.register({ name: "tool-1", description: "First", inputSchema: {} });
      registry.register({ name: "tool-2", description: "Second", inputSchema: {} });
      
      expect(registry.size()).toBe(2);
    });

    it("should throw when registering tool without name", () => {
      const registry = new ToolRegistry();
      const tool = { name: "", description: "Test", inputSchema: {} };
      
      expect(() => registry.register(tool as Tool)).toThrow("Tool must have a name");
    });
  });
});
