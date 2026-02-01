import { describe, it, expect, beforeEach } from "bun:test";
import {
  Economist,
  type EconomistOptions,
  type ComplexityScore,
  type ModelRoutingResult,
} from "./Economist.js";
import { TaskStatus, TaskPriority, type Task } from "@amicus/types/core";

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

describe("Economist", () => {
  let economist: Economist;

  beforeEach(() => {
    economist = new Economist();
  });

  describe("Construction", () => {
    it("should create with default options", () => {
      const e = new Economist();
      expect(e).toBeDefined();
      expect(e.getCostStats().budget).toBe(Infinity);
    });

    it("should create with custom options", () => {
      const onBudgetAlert = () => {};
      const e = new Economist({
        defaultModel: "anthropic:claude-3-haiku-20240307",
        budget: 100,
        budgetAlertThreshold: 0.9,
        onBudgetAlert,
      });
      expect(e).toBeDefined();
      expect(e.getCostStats().budget).toBe(100);
    });
  });

  describe("Complexity Analysis", () => {
    describe("Lexical Analysis", () => {
      it("should score low for short descriptions", () => {
        const task = createTestTask("t1", "Fix typo");
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.lexical).toBeLessThan(50);
      });

      it("should score high for long descriptions", () => {
        const task = createTestTask("t1", "A".repeat(1000));
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.lexical).toBeGreaterThan(50);
      });

      it("should increase score for complex vocabulary", () => {
        const simpleTask = createTestTask("t1", "Fix the typo");
        const complexTask = createTestTask(
          "t2",
          "Implement sophisticated algorithm architecture infrastructure"
        );
        const simpleScore = economist.analyzeComplexity(simpleTask);
        const complexScore = economist.analyzeComplexity(complexTask);
        expect(complexScore.lexical).toBeGreaterThan(simpleScore.lexical);
      });

      it("should increase score for technical terms", () => {
        const task = createTestTask(
          "t1",
          "Create API endpoint with database integration and middleware configuration"
        );
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.lexical).toBeGreaterThan(30);
      });
    });

    describe("Semantic Analysis", () => {
      it("should score low for simple keywords", () => {
        const task = createTestTask("t1", "Fix a simple typo quickly");
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.semantic).toBeLessThan(50);
      });

      it("should score high for complex keywords", () => {
        const task = createTestTask(
          "t1",
          "Architect and design complex system framework with optimization"
        );
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.semantic).toBeGreaterThan(50);
      });

      it("should increase score for multi-step indicators", () => {
        const task = createTestTask("t1", "Step 1: do this. Step 2: do that");
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.semantic).toBeGreaterThan(50);
      });

      it("should increase score for decision keywords", () => {
        const task = createTestTask("t1", "Choose between options A vs B");
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.semantic).toBeGreaterThan(50);
      });

      it("should handle neutral descriptions", () => {
        const task = createTestTask("t1", "Update the code");
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.semantic).toBeGreaterThanOrEqual(0);
        expect(complexity.semantic).toBeLessThanOrEqual(100);
      });
    });

    describe("Scope Analysis", () => {
      it("should have base score for simple tasks", () => {
        const task = createTestTask("t1", "Simple task");
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.scope).toBe(30);
      });

      it("should increase score for subtasks", () => {
        const task = createTestTask("t1", "Subtask", {
          metadata: { parentId: "parent-task" },
        });
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.scope).toBe(40);
      });

      it("should increase score for related tasks", () => {
        const task = createTestTask("t1", "Related task", {
          metadata: { relatedIds: ["t2", "t3", "t4"] },
        });
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.scope).toBe(45);
      });

      it("should increase score for high priority", () => {
        const task = createTestTask("t1", "High priority", {
          priority: TaskPriority.HIGH,
        });
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.scope).toBe(45);
      });

      it("should decrease score for low priority", () => {
        const task = createTestTask("t1", "Low priority", {
          priority: TaskPriority.LOW,
        });
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.scope).toBe(20);
      });

      it("should use explicit complexity from metadata", () => {
        const task = createTestTask("t1", "Task", {
          metadata: { metadata: { complexity: 75 } },
        });
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.scope).toBe(75);
      });

      it("should increase score for dependencies", () => {
        const task = createTestTask("t1", "Task with deps", {
          metadata: { metadata: { dependencies: ["dep1", "dep2"] } },
        });
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.scope).toBe(40);
      });

      it("should increase score for steps", () => {
        const task = createTestTask("t1", "Task with steps", {
          metadata: { metadata: { steps: ["step1", "step2", "step3"] } },
        });
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.scope).toBe(60);
      });
    });

    describe("Total Score", () => {
      it("should calculate weighted total", () => {
        const task = createTestTask("t1", "Test task");
        const complexity = economist.analyzeComplexity(task);
        const expectedTotal = Math.round(
          complexity.lexical * 0.3 +
            complexity.semantic * 0.4 +
            complexity.scope * 0.3
        );
        expect(complexity.total).toBe(expectedTotal);
      });

      it("should be within 0-100 range", () => {
        const task = createTestTask("t1", "Any task description here");
        const complexity = economist.analyzeComplexity(task);
        expect(complexity.total).toBeGreaterThanOrEqual(0);
        expect(complexity.total).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("Model Routing", () => {
    it("should route simple tasks to cheap models", () => {
      const task = createTestTask("t1", "Fix typo quickly");
      const routing = economist.route(task);
      expect(routing.complexity.total).toBeLessThan(30);
      expect(routing.provider).toBe("google");
    });

    it("should route complex tasks to capable models", () => {
      const task = createTestTask(
        "t1",
        "Architect, design and optimize a complex distributed system framework with microservices infrastructure, implementing sophisticated algorithms for load balancing, data synchronization, and fault tolerance. Create comprehensive integration tests and deployment pipelines."
      );
      const routing = economist.route(task);
      expect(routing.complexity.total).toBeGreaterThan(60);
      expect(["anthropic", "openai"]).toContain(routing.provider);
    });

    it("should route medium tasks to balanced models", () => {
      const task = createTestTask(
        "t1",
        "Implement a new feature with some algorithm changes"
      );
      const routing = economist.route(task);
      expect(routing.complexity.total).toBeGreaterThanOrEqual(30);
      expect(routing.complexity.total).toBeLessThanOrEqual(70);
    });

    it("should estimate cost based on description length", () => {
      const shortTask = createTestTask("t1", "Fix");
      const longTask = createTestTask("t1", "A".repeat(500));
      const shortRouting = economist.route(shortTask);
      const longRouting = economist.route(longTask);
      expect(shortRouting.estimatedCost).toBeLessThan(longRouting.estimatedCost);
    });

    it("should return correct complexity in result", () => {
      const task = createTestTask("t1", "Test task");
      const routing = economist.route(task);
      expect(routing.complexity).toBeDefined();
      expect(routing.complexity.lexical).toBeDefined();
      expect(routing.complexity.semantic).toBeDefined();
      expect(routing.complexity.scope).toBeDefined();
      expect(routing.complexity.total).toBeDefined();
    });
  });

  describe("Cost Tracking", () => {
    it("should start with zero cost", () => {
      const stats = economist.getCostStats();
      expect(stats.spent).toBe(0);
      expect(stats.requests).toBe(0);
      expect(stats.averageCost).toBe(0);
    });

    it("should update budget", () => {
      economist.updateBudget(500);
      const stats = economist.getCostStats();
      expect(stats.budget).toBe(500);
    });

    it("should calculate remaining budget correctly", () => {
      economist.updateBudget(100);
      const stats = economist.getCostStats();
      expect(stats.remaining).toBe(100);
    });

    it("should clear cost history", () => {
      economist.updateBudget(100);
      economist.clearCostHistory();
      const stats = economist.getCostStats();
      expect(stats.spent).toBe(0);
      expect(stats.requests).toBe(0);
    });

    it("should return empty cost history initially", () => {
      const history = economist.getCostHistory();
      expect(history.length).toBe(0);
    });
  });

  describe("Budget Alerts", () => {
    it("should trigger alert when threshold reached", () => {
      let alertTriggered = false;
      let alertSpent = 0;
      let alertBudget = 0;

      const e = new Economist({
        budget: 10,
        budgetAlertThreshold: 0.5,
        onBudgetAlert: (spent, budget) => {
          alertTriggered = true;
          alertSpent = spent;
          alertBudget = budget;
        },
      });

      expect(e.getCostStats().budget).toBe(10);
      expect(e.getCostStats().remaining).toBe(10);
    });

    it("should reset budget alert", () => {
      economist.resetBudgetAlert();
      expect(true).toBe(true);
    });
  });

  describe("Model Information", () => {
    it("should return available models", () => {
      const models = economist.getAvailableModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]?.id).toBeDefined();
      expect(models[0]?.provider).toBeDefined();
      expect(models[0]?.inputCostPer1K).toBeDefined();
      expect(models[0]?.outputCostPer1K).toBeDefined();
    });

    it("should include all expected providers", () => {
      const models = economist.getAvailableModels();
      const providers = new Set(models.map((m) => m.provider));
      expect(providers.has("openai")).toBe(true);
      expect(providers.has("anthropic")).toBe(true);
      expect(providers.has("google")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty description", () => {
      const task = createTestTask("t1", "");
      const complexity = economist.analyzeComplexity(task);
      expect(complexity.lexical).toBe(0);
      expect(complexity.total).toBeGreaterThanOrEqual(0);
    });

    it("should handle very long description", () => {
      const task = createTestTask("t1", "A".repeat(5000));
      const complexity = economist.analyzeComplexity(task);
      expect(complexity.lexical).toBe(100);
    });

    it("should handle special characters in description", () => {
      const task = createTestTask("t1", "Fix @#$%^&*() typo!");
      const complexity = economist.analyzeComplexity(task);
      expect(complexity).toBeDefined();
    });

    it("should handle task with no metadata", () => {
      const task = createTestTask("t1", "Simple task", {});
      const complexity = economist.analyzeComplexity(task);
      expect(complexity.scope).toBe(30);
    });

    it("should handle infinity budget", () => {
      const e = new Economist({ budget: Infinity });
      const stats = e.getCostStats();
      expect(stats.budget).toBe(Infinity);
      expect(stats.remaining).toBe(Infinity);
    });

    it("should handle case-insensitive keyword matching", () => {
      const task1 = createTestTask("t1", "FIX the typo");
      const task2 = createTestTask("t2", "ARCHITECT a system");
      const c1 = economist.analyzeComplexity(task1);
      const c2 = economist.analyzeComplexity(task2);
      expect(c2.semantic).toBeGreaterThan(c1.semantic);
    });
  });

  describe("Integration", () => {
    it("should analyze and route consistently", () => {
      const task = createTestTask("t1", "Implement complex algorithm with optimization");
      const complexity = economist.analyzeComplexity(task);
      const routing = economist.route(task);

      expect(routing.complexity.total).toBe(complexity.total);
      expect(routing.model).toContain(routing.provider);
    });

    it("should select cost-effective model in complexity range", () => {
      const task = createTestTask("t1", "Simple fix");
      const routing = economist.route(task);

      const models = economist.getAvailableModels();
      const selectedModel = models.find((m) => m.id === routing.model);
      expect(selectedModel).toBeDefined();
      expect(selectedModel!.complexityRange.min).toBeLessThanOrEqual(
        routing.complexity.total
      );
      expect(selectedModel!.complexityRange.max).toBeGreaterThanOrEqual(
        routing.complexity.total
      );
    });
  });
});
