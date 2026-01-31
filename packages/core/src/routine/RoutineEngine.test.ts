import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { RoutineEngine } from "./RoutineEngine.js";
import {
  TaskStatus,
  TaskPriority,
  type Task,
  type TaskResult,
} from "@amicus/types/core";

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

// Helper to create a test task
function createTestTask(id: string, description: string): Task {
  return {
    id,
    description,
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe("RoutineEngine", () => {
  let engine: RoutineEngine;
  let mockOperationExecutor: MockOperationExecutor;
  let mockContextManager: MockContextManager;

  beforeEach(() => {
    mockOperationExecutor = new MockOperationExecutor();
    mockContextManager = new MockContextManager();
    engine = new RoutineEngine({
      operationExecutor: mockOperationExecutor as any,
      contextManager: mockContextManager as any,
    });
  });

  afterEach(() => {
    engine.stop();
  });

  describe("Basic Lifecycle", () => {
    it("should create engine with options", () => {
      expect(engine).toBeDefined();
    });

    it("should start and stop the engine", () => {
      engine.start();
      expect(engine.getRunningTaskIds()).toEqual([]);
      engine.stop();
    });

    it("should emit started and stopped events", () => {
      let startedEmitted = false;
      let stoppedEmitted = false;

      engine.on("started", () => {
        startedEmitted = true;
      });
      engine.on("stopped", () => {
        stoppedEmitted = true;
      });

      engine.start();
      expect(startedEmitted).toBe(true);

      engine.stop();
      expect(stoppedEmitted).toBe(true);
    });
  });

  describe("Task Execution", () => {
    it("should execute a task successfully", async () => {
      const task = createTestTask("task-1", "Test task");
      const result = await engine.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe("task-1");
      expect(mockOperationExecutor.executedTasks.length).toBe(1);
    });

    it("should handle task execution failure", async () => {
      mockOperationExecutor.shouldFail = true;
      const task = createTestTask("task-1", "Failing task");

      try {
        await engine.executeTask(task);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain("Task execution failed");
      }
    });

    it("should update context during task execution", async () => {
      const task = createTestTask("task-1", "Test task");
      await engine.executeTask(task);

      expect(mockContextManager.updates.length).toBeGreaterThanOrEqual(2);
      expect(mockContextManager.updates[0]).toContain("Task started");
      expect(mockContextManager.updates[1]).toContain("Task completed");
    });

    it("should update context on task failure", async () => {
      mockOperationExecutor.shouldFail = true;
      const task = createTestTask("task-1", "Failing task");

      try {
        await engine.executeTask(task);
      } catch {
        // Expected
      }

      expect(mockContextManager.updates.length).toBeGreaterThanOrEqual(2);
      expect(mockContextManager.updates[0]).toContain("Task started");
      expect(mockContextManager.updates[1]).toContain("Task failed");
    });
  });

  describe("Event Emission", () => {
    it("should emit taskStarted event", async () => {
      const task = createTestTask("task-1", "Test task");
      let startedTask: Task | null = null;

      engine.on("taskStarted", (t: Task) => {
        startedTask = t;
      });

      await engine.executeTask(task);

      expect(startedTask).not.toBeNull();
      expect(startedTask?.id).toBe("task-1");
    });

    it("should emit taskCompleted event", async () => {
      const task = createTestTask("task-1", "Test task");
      let completedTask: Task | null = null;

      engine.on("taskCompleted", (t: Task) => {
        completedTask = t;
      });

      await engine.executeTask(task);

      expect(completedTask).not.toBeNull();
      expect(completedTask?.id).toBe("task-1");
    });

    it("should emit taskFailed event", async () => {
      mockOperationExecutor.shouldFail = true;
      const task = createTestTask("task-1", "Failing task");
      let failedTask: Task | null = null;

      engine.on("taskFailed", (t: Task) => {
        failedTask = t;
      });

      try {
        await engine.executeTask(task);
      } catch {
        // Expected
      }

      expect(failedTask).not.toBeNull();
      expect(failedTask?.id).toBe("task-1");
    });

    it("should emit taskStatusChanged event", async () => {
      const task = createTestTask("task-1", "Test task");
      const statusChanges: Array<{ task: Task; status: TaskStatus }> = [];

      engine.on("taskStatusChanged", (t: Task, s: TaskStatus) => {
        statusChanges.push({ task: t, status: s });
      });

      await engine.executeTask(task);

      expect(statusChanges.length).toBeGreaterThanOrEqual(2);
      expect(statusChanges[0].status).toBe(TaskStatus.RUNNING);
      expect(statusChanges[1].status).toBe(TaskStatus.COMPLETED);
    });
  });

  describe("Cron Scheduling", () => {
    it("should schedule a task with valid cron expression", () => {
      const task = createTestTask("scheduled-1", "Scheduled task");
      const result = engine.schedule("0 0 * * *", task); // Daily at midnight

      expect(result).toBe(true);
      expect(engine.getScheduledRoutines().length).toBe(1);
      expect(engine.getScheduledRoutines()[0].taskId).toBe("scheduled-1");
    });

    it("should reject invalid cron expression", () => {
      const task = createTestTask("scheduled-1", "Scheduled task");
      const result = engine.schedule("invalid cron", task);

      expect(result).toBe(false);
      expect(engine.getScheduledRoutines().length).toBe(0);
    });

    it("should unschedule a task", () => {
      const task = createTestTask("scheduled-1", "Scheduled task");
      engine.schedule("0 0 * * *", task);
      expect(engine.getScheduledRoutines().length).toBe(1);

      const result = engine.unschedule("scheduled-1");
      expect(result).toBe(true);
      expect(engine.getScheduledRoutines().length).toBe(0);
    });

    it("should return false when unscheduling non-existent task", () => {
      const result = engine.unschedule("non-existent");
      expect(result).toBe(false);
    });

    it("should start scheduled tasks when engine starts", () => {
      const task = createTestTask("scheduled-1", "Scheduled task");
      engine.schedule("*/5 * * * * *", task); // Every 5 seconds

      engine.start();

      // Task should be in scheduled list and tracked
      expect(engine.getScheduledRoutines().length).toBe(1);
      engine.stop();
    });

    it("should allow rescheduling the same task", () => {
      const task = createTestTask("scheduled-1", "Scheduled task");
      engine.schedule("0 0 * * *", task);
      expect(engine.getScheduledRoutines().length).toBe(1);

      // Reschedule with different cron
      const result = engine.schedule("0 12 * * *", task);
      expect(result).toBe(true);
      expect(engine.getScheduledRoutines().length).toBe(1);
      expect(engine.getScheduledRoutines()[0].cronExpression).toBe("0 12 * * *");
    });
  });

  describe("Task Management", () => {
    it("should track running tasks", async () => {
      const task = createTestTask("task-1", "Test task");

      // Before execution
      expect(engine.isTaskRunning("task-1")).toBe(false);
      expect(engine.getRunningTaskIds()).toEqual([]);

      // Start execution (don't await to check running state)
      const execPromise = engine.executeTask(task);

      // Should be running now
      expect(engine.isTaskRunning("task-1")).toBe(true);
      expect(engine.getRunningTaskIds()).toContain("task-1");

      // Wait for completion
      await execPromise;

      // Should not be running after completion
      expect(engine.isTaskRunning("task-1")).toBe(false);
      expect(engine.getRunningTaskIds()).toEqual([]);
    });

    it("should cancel a scheduled task", () => {
      const task = createTestTask("task-1", "Test task");
      engine.schedule("0 0 * * *", task);
      expect(engine.getScheduledRoutines().length).toBe(1);

      const result = engine.cancelTask("task-1");
      expect(result).toBe(true);
      expect(engine.getScheduledRoutines().length).toBe(0);
    });

    it("should return false when canceling non-existent task", () => {
      const result = engine.cancelTask("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("State Transitions", () => {
    it("should transition through idle -> running -> completed", async () => {
      const task = createTestTask("task-1", "Test task");
      const states: string[] = [];

      engine.on("taskStatusChanged", (_, status: TaskStatus) => {
        states.push(status);
      });

      await engine.executeTask(task);

      expect(states).toContain(TaskStatus.RUNNING);
      expect(states).toContain(TaskStatus.COMPLETED);
    });

    it("should transition through idle -> running -> failed on error", async () => {
      mockOperationExecutor.shouldFail = true;
      const task = createTestTask("task-1", "Failing task");
      const states: string[] = [];

      engine.on("taskStatusChanged", (_, status: TaskStatus) => {
        states.push(status);
      });

      try {
        await engine.executeTask(task);
      } catch {
        // Expected
      }

      expect(states).toContain(TaskStatus.RUNNING);
      expect(states).toContain(TaskStatus.FAILED);
    });

    it("should handle pause and resume", async () => {
      const task = createTestTask("task-1", "Test task");

      // Execute task
      const execPromise = engine.executeTask(task);

      // Pause the task
      const pauseResult = engine.pauseTask("task-1");
      expect(pauseResult).toBe(true);

      // Resume the task
      const resumeResult = engine.resumeTask("task-1");
      expect(resumeResult).toBe(true);

      // Wait for completion
      await execPromise;
    });

    it("should return false when pausing non-running task", () => {
      const result = engine.pauseTask("non-existent");
      expect(result).toBe(false);
    });

    it("should return false when resuming non-running task", () => {
      const result = engine.resumeTask("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("Integration", () => {
    it("should integrate with operation executor", async () => {
      const task = createTestTask("task-1", "Integration test");
      await engine.executeTask(task);

      expect(mockOperationExecutor.executedTasks.length).toBe(1);
      expect(mockOperationExecutor.executedTasks[0]).toContain(
        "Execute task: Integration test"
      );
    });

    it("should integrate with ContextManager", async () => {
      const task = createTestTask("task-1", "Integration test");
      await engine.executeTask(task);

      expect(mockContextManager.updates.length).toBeGreaterThanOrEqual(2);
      expect(mockContextManager.updates.some((u) => u.includes("Task started"))).toBe(
        true
      );
      expect(
        mockContextManager.updates.some((u) => u.includes("Task completed"))
      ).toBe(true);
    });

    it("should handle multiple tasks sequentially", async () => {
      const task1 = createTestTask("task-1", "First task");
      const task2 = createTestTask("task-2", "Second task");

      await engine.executeTask(task1);
      await engine.executeTask(task2);

      expect(mockOperationExecutor.executedTasks.length).toBe(2);
      expect(mockContextManager.updates.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple start calls gracefully", () => {
      engine.start();
      engine.start(); // Should not throw
      expect(engine.getRunningTaskIds()).toEqual([]);
      engine.stop();
    });

    it("should handle multiple stop calls gracefully", () => {
      engine.start();
      engine.stop();
      engine.stop(); // Should not throw
      expect(engine.getRunningTaskIds()).toEqual([]);
    });

    it("should handle task with special characters in description", async () => {
      const task = createTestTask(
        "task-1",
        "Task with special chars: !@#$%^&*()"
      );
      const result = await engine.executeTask(task);

      expect(result.success).toBe(true);
    });

    it("should handle very long task description", async () => {
      const longDescription = "A".repeat(1000);
      const task = createTestTask("task-1", longDescription);
      const result = await engine.executeTask(task);

      expect(result.success).toBe(true);
    });
  });
});
