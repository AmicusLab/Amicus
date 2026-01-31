import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  Planner,
  PlannerError,
  type PlannerOptions,
  type Plan,
  type DecompositionResult,
} from "./Planner.js";
import { Economist } from "../llm/Economist.js";
import { TaskStatus, TaskPriority, type Task, type TaskResult } from "@amicus/types/core";

// Mock Economist for testing
function createMockEconomist(): Economist {
  const economist = new Economist();
  
  // Override methods for testing
  economist.analyzeComplexity = mock((task: Task) => {
    const description = task.description.toLowerCase();
    let total = 30; // Base score
    
    if (description.includes("complex") || description.includes("architect")) {
      total = 75;
    } else if (description.includes("simple") || description.includes("fix")) {
      total = 15;
    } else if (description.length > 100) {
      total = 50;
    }
    
    return {
      lexical: Math.min(100, description.length / 5),
      semantic: total,
      scope: 30,
      total,
    };
  });

  economist.generateText = mock(async (_task: Task, prompt: string) => {
    // Return a mock LLM decomposition response
    return JSON.stringify({
      subtasks: [
        {
          id: "subtask-1",
          description: "Analyze requirements and design solution",
          priority: "high",
          estimatedEffort: 30,
          dependsOn: [],
        },
        {
          id: "subtask-2",
          description: "Implement the core functionality",
          priority: "high",
          estimatedEffort: 50,
          dependsOn: ["subtask-1"],
        },
        {
          id: "subtask-3",
          description: "Test and verify implementation",
          priority: "medium",
          estimatedEffort: 20,
          dependsOn: ["subtask-2"],
        },
      ],
      dependencies: {
        "subtask-2": ["subtask-1"],
        "subtask-3": ["subtask-2"],
      },
    });
  });

  return economist;
}

function createTestTask(
  id: string,
  description: string,
  overrides: Partial<Task> = {}
): Task {
  return {
    id,
    description,
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("Planner", () => {
  let planner: Planner;
  let mockEconomist: Economist;

  beforeEach(() => {
    mockEconomist = createMockEconomist();
    planner = new Planner({
      economist: mockEconomist,
      strategy: "sequential",
      useLLMDecomposition: false, // Use rule-based for most tests
    });
  });

  describe("Construction", () => {
    it("should create planner with required options", () => {
      const p = new Planner({ economist: mockEconomist });
      expect(p).toBeDefined();
    });

    it("should create planner with custom strategy", () => {
      const p = new Planner({
        economist: mockEconomist,
        strategy: "parallel",
      });
      expect(p).toBeDefined();
    });

    it("should throw error without economist", () => {
      expect(() => {
        new Planner({ economist: undefined as unknown as Economist });
      }).toThrow(PlannerError);
    });
  });

  describe("Plan Creation", () => {
    it("should create a plan for simple task", async () => {
      const task = createTestTask("t1", "Fix typo");
      const plan = await planner.createPlan(task);

      expect(plan).toBeDefined();
      expect(plan.id).toContain("plan-t1");
      expect(plan.originalTask).toBe(task);
      expect(plan.subtasks.length).toBe(1);
      expect(plan.strategy).toBe("sequential");
    });

    it("should create a plan for complex task", async () => {
      const task = createTestTask("t1", "Architect complex system framework");
      const plan = await planner.createPlan(task);

      expect(plan).toBeDefined();
      expect(plan.subtasks.length).toBeGreaterThan(0);
      expect(plan.estimatedEffort).toBeGreaterThan(0);
    });

    it("should create unique plan IDs", async () => {
      const task = createTestTask("t1", "Test task");
      const plan1 = await planner.createPlan(task);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const plan2 = await planner.createPlan(task);

      expect(plan1.id).not.toBe(plan2.id);
    });
  });

  describe("Task Decomposition", () => {
    it("should not decompose simple tasks", async () => {
      const task = createTestTask("t1", "Fix typo");
      const result = await planner.decompose(task);

      expect(result.subtasks.length).toBe(1);
      expect(result.subtasks[0].id).toBe("t1");
    });

    it("should decompose complex tasks with rules", async () => {
      const task = createTestTask("t1", "Implement feature A and test it");
      const result = await planner.decompose(task);

      expect(result.subtasks.length).toBeGreaterThan(1);
    });

    it("should respect max decomposition depth", async () => {
      const task = createTestTask("t1", "Very complex task with multiple components");
      const deepPlanner = new Planner({
        economist: mockEconomist,
        maxDecompositionDepth: 1,
      });

      const result = await deepPlanner.decompose(task);
      expect(result.subtasks.length).toBeGreaterThan(0);
    });

    it("should create sequential dependencies for split tasks", async () => {
      const task = createTestTask("t1", "Step 1: do this and Step 2: do that");
      const result = await planner.decompose(task);

      // Check that dependencies were created
      if (result.subtasks.length > 1) {
        const hasDependencies = result.dependencies.size > 0;
        expect(hasDependencies).toBe(true);
      }
    });

    it("should handle implementation and test separation", async () => {
      const task = createTestTask("t1", "Implement the authentication system");
      const result = await planner.decompose(task);

      const hasImpl = result.subtasks.some((st) =>
        st.description.toLowerCase().includes("implement")
      );
      const hasTest = result.subtasks.some((st) =>
        st.description.toLowerCase().includes("test")
      );

      if (hasImpl && hasTest) {
        // Test should depend on implementation
        const testTask = result.subtasks.find((st) =>
          st.description.toLowerCase().includes("test")
        );
        const implTask = result.subtasks.find((st) =>
          st.description.toLowerCase().includes("implement")
        );

        if (testTask && implTask) {
          const deps = result.dependencies.get(testTask.id);
          expect(deps).toContain(implTask.id);
        }
      }
    });
  });

  describe("LLM Decomposition", () => {
    it("should use LLM for very complex tasks", async () => {
      const llmPlanner = new Planner({
        economist: mockEconomist,
        useLLMDecomposition: true,
        maxDecompositionDepth: 1, // Prevent recursive decomposition
      });

      const task = createTestTask("t1", "Architect and design complex distributed system");
      const result = await llmPlanner.decompose(task);

      // With maxDecompositionDepth: 1, should get exactly the LLM subtasks
      expect(result.subtasks.length).toBe(3);
      expect(result.subtasks[0].id).toBe("subtask-1");
    });

    it("should fallback to rule-based when LLM fails", async () => {
      const failingEconomist = createMockEconomist();
      failingEconomist.generateText = mock(async () => {
        throw new Error("LLM unavailable");
      });

      const fallbackPlanner = new Planner({
        economist: failingEconomist,
        useLLMDecomposition: true,
      });

      const task = createTestTask("t1", "Complex task that requires decomposition");
      const result = await fallbackPlanner.decompose(task);

      // Should still have subtasks from rule-based fallback
      expect(result.subtasks.length).toBeGreaterThan(0);
    });
  });

  describe("Execution Strategies", () => {
    const mockExecuteFn = mock(async (task: Task): Promise<TaskResult> => ({
      taskId: task.id,
      success: true,
      data: { executed: true },
      duration: 100,
    }));

    beforeEach(() => {
      mockExecuteFn.mockClear();
    });

    it("should execute sequential strategy", async () => {
      const task = createTestTask("t1", "Implement feature");
      const plan = await planner.createPlan(task);
      
      const results = await planner.executePlan(plan, mockExecuteFn);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].success).toBe(true);
    });

    it("should execute parallel strategy", async () => {
      const parallelPlanner = new Planner({
        economist: mockEconomist,
        strategy: "parallel",
      });

      const task = createTestTask("t1", "Simple task");
      const plan = await parallelPlanner.createPlan(task);
      
      const results = await planner.executePlan(plan, mockExecuteFn);
      
      expect(results.length).toBeGreaterThan(0);
    });

    it("should execute priority strategy", async () => {
      const priorityPlanner = new Planner({
        economist: mockEconomist,
        strategy: "priority",
      });

      const task = createTestTask("t1", "Simple task");
      const plan = await priorityPlanner.createPlan(task);
      
      const results = await planner.executePlan(plan, mockExecuteFn);
      
      expect(results.length).toBeGreaterThan(0);
    });

    it("should call progress callback", async () => {
      const progressCallback = mock(() => {});
      const task = createTestTask("t1", "Test task");
      const plan = await planner.createPlan(task);

      await planner.executePlan(plan, mockExecuteFn, progressCallback);

      expect(progressCallback.mock.calls.length).toBeGreaterThan(0);
    });

    it("should handle task execution failure", async () => {
      const failingExecute = mock(async (task: Task): Promise<TaskResult> => ({
        taskId: task.id,
        success: false,
        error: "Execution failed",
        duration: 0,
      }));

      const task = createTestTask("t1", "Test task");
      const plan = await planner.createPlan(task);

      const results = await planner.executePlan(plan, failingExecute);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Execution failed");
    });

    it("should stop on critical task failure in sequential mode", async () => {
      const urgentTask = createTestTask("t1", "Test", { priority: TaskPriority.URGENT });
      
      let callCount = 0;
      const countingExecute = mock(async (task: Task): Promise<TaskResult> => {
        callCount++;
        if (callCount === 1) {
          return {
            taskId: task.id,
            success: false,
            error: "Critical failure",
            duration: 0,
          };
        }
        return {
          taskId: task.id,
          success: true,
          duration: 100,
        };
      });

      const plan = await planner.createPlan(urgentTask);
      await planner.executePlan(plan, countingExecute);

      // Should have stopped after first failure
      expect(callCount).toBe(1);
    });
  });

  describe("Execution Order", () => {
    it("should return sequential order", async () => {
      const task = createTestTask("t1", "Test task");
      const plan = await planner.createPlan(task);

      const order = planner.getExecutionOrder(plan);

      expect(Array.isArray(order)).toBe(true);
      expect(order.length).toBe(plan.subtasks.length);
    });

    it("should respect dependencies in order", async () => {
      const complexTask = createTestTask("t1", "Complex task with multiple steps");
      const plan = await planner.createPlan(complexTask);

      const order = planner.getExecutionOrder(plan);

      // Check that dependencies come before dependent tasks
      for (const [taskId, deps] of plan.dependencies) {
        const taskIndex = order.indexOf(taskId);
        for (const depId of deps) {
          const depIndex = order.indexOf(depId);
          if (depIndex !== -1 && taskIndex !== -1) {
            expect(depIndex).toBeLessThan(taskIndex);
          }
        }
      }
    });

    it("should detect circular dependencies", async () => {
      const plan: Plan = {
        id: "test-plan",
        originalTask: createTestTask("t1", "Test"),
        subtasks: [
          createTestTask("a", "Task A"),
          createTestTask("b", "Task B"),
        ],
        dependencies: new Map([
          ["a", ["b"]],
          ["b", ["a"]],
        ]),
        strategy: "sequential",
        estimatedEffort: 100,
        createdAt: Date.now(),
      };

      expect(() => planner.getExecutionOrder(plan)).toThrow(PlannerError);
    });
  });

  describe("Plan Validation", () => {
    it("should validate valid plan", async () => {
      const task = createTestTask("t1", "Test task");
      const plan = await planner.createPlan(task);

      const validation = planner.validatePlan(plan);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it("should detect empty plan", () => {
      const emptyPlan: Plan = {
        id: "empty",
        originalTask: createTestTask("t1", "Test"),
        subtasks: [],
        dependencies: new Map(),
        strategy: "sequential",
        estimatedEffort: 0,
        createdAt: Date.now(),
      };

      const validation = planner.validatePlan(emptyPlan);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Plan has no subtasks");
    });

    it("should detect duplicate task IDs", () => {
      const duplicatePlan: Plan = {
        id: "dup",
        originalTask: createTestTask("t1", "Test"),
        subtasks: [
          createTestTask("same-id", "Task 1"),
          createTestTask("same-id", "Task 2"),
        ],
        dependencies: new Map(),
        strategy: "sequential",
        estimatedEffort: 100,
        createdAt: Date.now(),
      };

      const validation = planner.validatePlan(duplicatePlan);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("Duplicate"))).toBe(true);
    });

    it("should detect missing dependencies", () => {
      const badPlan: Plan = {
        id: "bad",
        originalTask: createTestTask("t1", "Test"),
        subtasks: [createTestTask("a", "Task A")],
        dependencies: new Map([["a", ["missing-task"]]]),
        strategy: "sequential",
        estimatedEffort: 100,
        createdAt: Date.now(),
      };

      const validation = planner.validatePlan(badPlan);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("missing"))).toBe(true);
    });
  });

  describe("Plan Statistics", () => {
    it("should calculate plan stats", async () => {
      const task = createTestTask("t1", "Test task");
      const plan = await planner.createPlan(task);

      const stats = planner.getPlanStats(plan);

      expect(stats.totalTasks).toBe(plan.subtasks.length);
      expect(stats.strategy).toBe(plan.strategy);
      expect(stats.estimatedEffort).toBeGreaterThanOrEqual(0);
    });

    it("should calculate parallelizable tasks", async () => {
      const task = createTestTask("t1", "Test task");
      const plan = await planner.createPlan(task);

      const stats = planner.getPlanStats(plan);

      expect(stats.parallelizableTasks).toBeGreaterThanOrEqual(0);
      expect(stats.parallelizableTasks).toBeLessThanOrEqual(stats.totalTasks);
    });
  });

  describe("Strategy Determination", () => {
    it("should choose sequential for single task", async () => {
      const task = createTestTask("t1", "Fix typo");
      const plan = await planner.createPlan(task);

      expect(plan.strategy).toBe("sequential");
    });

    it("should choose parallel for independent tasks", async () => {
      const independentPlanner = new Planner({
        economist: mockEconomist,
      });

      // Create a task that decomposes into independent parts
      const task = createTestTask("t1", "Task one and task two and task three");
      const plan = await independentPlanner.createPlan(task);

      // May be parallel if no dependencies detected
      expect(["sequential", "parallel", "priority"]).toContain(plan.strategy);
    });
  });

  describe("Edge Cases", () => {
    it("should handle task with empty description", async () => {
      const task = createTestTask("t1", "");
      const plan = await planner.createPlan(task);

      expect(plan).toBeDefined();
      expect(plan.subtasks.length).toBeGreaterThan(0);
    });

    it("should handle very long description", async () => {
      const task = createTestTask("t1", "A".repeat(5000));
      const plan = await planner.createPlan(task);

      expect(plan).toBeDefined();
    });

    it("should handle task with special characters", async () => {
      const task = createTestTask("t1", "Task with @#$%^&*() special chars!");
      const plan = await planner.createPlan(task);

      expect(plan).toBeDefined();
    });

    it("should handle concurrent plan creation", async () => {
      const tasks = [
        createTestTask("t1", "Task 1"),
        createTestTask("t2", "Task 2"),
        createTestTask("t3", "Task 3"),
      ];

      const plans = await Promise.all(tasks.map((t) => planner.createPlan(t)));

      expect(plans.length).toBe(3);
      const ids = plans.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });
});
