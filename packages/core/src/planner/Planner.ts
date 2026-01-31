import type { Economist } from "../llm/Economist.js";
import {
  TaskStatus,
  TaskPriority,
  type Task,
  type TaskResult,
} from "@amicus/types/core";

/**
 * Options for configuring the Planner
 */
export interface PlannerOptions {
  /** Economist instance for LLM-based planning and complexity analysis */
  economist: Economist;
  /** Execution strategy for plan execution */
  strategy?: ExecutionStrategy;
  /** Maximum depth for task decomposition */
  maxDecompositionDepth?: number;
  /** Whether to use LLM for decomposition of complex tasks */
  useLLMDecomposition?: boolean;
}

/**
 * Execution strategy for running plans
 */
export type ExecutionStrategy = "sequential" | "parallel" | "priority";

/**
 * Represents a generated plan with subtasks and dependencies
 */
export interface Plan {
  /** Unique plan identifier */
  id: string;
  /** Original task that was decomposed */
  originalTask: Task;
  /** Decomposed subtasks */
  subtasks: Task[];
  /** Dependency mapping: taskId -> array of dependent task IDs */
  dependencies: Map<string, string[]>;
  /** Execution strategy for this plan */
  strategy: ExecutionStrategy;
  /** Estimated total effort */
  estimatedEffort: number;
  /** Plan creation timestamp */
  createdAt: number;
}

/**
 * Represents a subtask with additional planning metadata
 */
export interface Subtask extends Task {
  /** Parent task ID */
  parentId: string;
  /** Dependency task IDs */
  dependsOn?: string[];
  /** Estimated effort (in relative units) */
  estimatedEffort: number;
}

/**
 * Result of task decomposition
 */
export interface DecompositionResult {
  /** Generated subtasks */
  subtasks: Task[];
  /** Dependencies between subtasks */
  dependencies: Map<string, string[]>;
  /** Total estimated effort */
  totalEffort: number;
}

/**
 * Planner error types
 */
export class PlannerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PlannerError";
  }
}

/**
 * Callback function for execution progress
 */
export type ExecutionProgressCallback = (
  taskId: string,
  status: TaskStatus,
  progress?: number
) => void;

/**
 * Intelligent task planner with decomposition and execution capabilities
 */
export class Planner {
  private readonly economist: Economist;
  private readonly defaultStrategy: ExecutionStrategy;
  private readonly maxDecompositionDepth: number;
  private readonly useLLMDecomposition: boolean;

  constructor(options: PlannerOptions) {
    if (!options.economist) {
      throw new PlannerError(
        "Economist instance is required",
        "MISSING_ECONOMIST"
      );
    }

    this.economist = options.economist;
    this.defaultStrategy = options.strategy ?? "sequential";
    this.maxDecompositionDepth = options.maxDecompositionDepth ?? 3;
    this.useLLMDecomposition = options.useLLMDecomposition ?? true;
  }

  /**
   * Create a plan from a task by analyzing complexity and decomposing if needed
   */
  async createPlan(task: Task): Promise<Plan> {
    // Analyze task complexity
    const complexity = this.economist.analyzeComplexity(task);

    // Decompose task if it's complex
    let decomposition: DecompositionResult;
    if (complexity.total < 30) {
      // Simple task - no decomposition needed
      decomposition = {
        subtasks: [task],
        dependencies: new Map(),
        totalEffort: complexity.total,
      };
    } else {
      // Complex task - decompose
      decomposition = await this.decompose(task);
    }

    // Determine best execution strategy if not specified
    const strategy = this.determineStrategy(decomposition);

    return {
      id: `plan-${task.id}-${Date.now()}`,
      originalTask: task,
      subtasks: decomposition.subtasks,
      dependencies: decomposition.dependencies,
      strategy,
      estimatedEffort: decomposition.totalEffort,
      createdAt: Date.now(),
    };
  }

  /**
   * Decompose a task into subtasks using complexity analysis and optionally LLM
   */
  async decompose(task: Task, depth = 0): Promise<DecompositionResult> {
    // Prevent infinite recursion
    if (depth >= this.maxDecompositionDepth) {
      return {
        subtasks: [task],
        dependencies: new Map(),
        totalEffort: this.economist.analyzeComplexity(task).total,
      };
    }

    const complexity = this.economist.analyzeComplexity(task);

    // If task is simple enough, don't decompose further
    if (complexity.total < 30) {
      return {
        subtasks: [task],
        dependencies: new Map(),
        totalEffort: complexity.total,
      };
    }

    let subtasks: Task[];
    let dependencies: Map<string, string[]> = new Map();

    if (this.useLLMDecomposition && complexity.total >= 50) {
      // Use LLM for complex task decomposition
      const decomposition = await this.decomposeWithLLM(task);
      subtasks = decomposition.subtasks;
      dependencies = decomposition.dependencies;
    } else {
      // Use rule-based decomposition
      const decomposition = this.decomposeWithRules(task, complexity);
      subtasks = decomposition.subtasks;
      dependencies = decomposition.dependencies;
    }

    // Recursively decompose subtasks if they're still complex
    const fullyDecomposed: Task[] = [];
    const allDependencies = new Map(dependencies);

    for (const subtask of subtasks) {
      const subtaskComplexity = this.economist.analyzeComplexity(subtask);
      if (subtaskComplexity.total >= 30 && depth < this.maxDecompositionDepth - 1) {
        const nested = await this.decompose(subtask, depth + 1);
        fullyDecomposed.push(...nested.subtasks);
        
        // Merge nested dependencies
        for (const [key, value] of nested.dependencies) {
          allDependencies.set(key, value);
        }
        
        // Map subtask dependencies to nested subtasks
        const deps = allDependencies.get(subtask.id) ?? [];
        if (nested.subtasks.length > 0) {
          // First nested subtask depends on what the parent depended on
          const firstNested = nested.subtasks[0]!;
          allDependencies.set(firstNested.id, deps);
          
          // Chain nested subtasks
          for (let i = 1; i < nested.subtasks.length; i++) {
            const current = nested.subtasks[i]!;
            const prev = nested.subtasks[i - 1]!;
            allDependencies.set(current.id, [prev.id]);
          }
        }
        allDependencies.delete(subtask.id);
      } else {
        fullyDecomposed.push(subtask);
      }
    }

    // Calculate total effort
    const totalEffort = fullyDecomposed.reduce(
      (sum, t) => sum + this.economist.analyzeComplexity(t).total,
      0
    );

    return {
      subtasks: fullyDecomposed,
      dependencies: allDependencies,
      totalEffort,
    };
  }

  /**
   * Decompose a task using LLM-based planning
   */
  private async decomposeWithLLM(task: Task): Promise<DecompositionResult> {
    const prompt = `
You are a task decomposition assistant. Break down the following task into subtasks.

Task ID: ${task.id}
Task Description: ${task.description}
Task Priority: ${task.priority}

Provide the decomposition in the following JSON format:
{
  "subtasks": [
    {
      "id": "unique-id-1",
      "description": "Description of subtask 1",
      "priority": "medium",
      "estimatedEffort": 25,
      "dependsOn": []
    }
  ],
  "dependencies": {
    "subtask-id": ["dependency-id-1", "dependency-id-2"]
  }
}

Guidelines:
- Create 2-5 subtasks for a medium complexity task
- Each subtask should be specific and actionable
- Use dependsOn to indicate dependencies between subtasks
- estimatedEffort should be between 10-100 (relative complexity)
- Priority can be: "low", "medium", "high", "urgent"

Respond with only the JSON, no additional text.`;

    try {
      const response = await this.economist.generateText(task, prompt);
      return this.parseDecompositionResponse(response, task);
    } catch (error) {
      // Fallback to rule-based decomposition if LLM fails
      console.warn(`LLM decomposition failed for task ${task.id}, falling back to rules:`, error);
      return this.decomposeWithRules(task, this.economist.analyzeComplexity(task));
    }
  }

  /**
   * Parse LLM response into DecompositionResult
   */
  private parseDecompositionResponse(
    response: string,
    parentTask: Task
  ): DecompositionResult {
    try {
      // Extract JSON from response (in case there's markdown or other text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      const parsed = JSON.parse(jsonStr);

      const subtasks: Task[] = parsed.subtasks.map((st: Record<string, unknown>, index: number) => ({
        id: (st.id as string) || `${parentTask.id}-sub-${index}`,
        description: (st.description as string) || "Unnamed subtask",
        status: TaskStatus.PENDING,
        priority: this.parsePriority(st.priority as string),
        metadata: {
          parentId: parentTask.id,
          metadata: {
            estimatedEffort: st.estimatedEffort as number,
          },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      const dependencies = new Map<string, string[]>();
      if (parsed.dependencies) {
        for (const [taskId, deps] of Object.entries(parsed.dependencies)) {
          if (Array.isArray(deps)) {
            dependencies.set(taskId, deps as string[]);
          }
        }
      }

      // Also process dependsOn fields from subtasks
      parsed.subtasks.forEach((st: Record<string, unknown>, index: number) => {
        const taskId = (st.id as string) || `${parentTask.id}-sub-${index}`;
        if (st.dependsOn && Array.isArray(st.dependsOn) && st.dependsOn.length > 0) {
          const existing = dependencies.get(taskId) ?? [];
          dependencies.set(taskId, [...existing, ...(st.dependsOn as string[])]);
        }
      });

      const totalEffort = subtasks.reduce(
        (sum, t) => sum + (this.economist.analyzeComplexity(t).total),
        0
      );

      return {
        subtasks,
        dependencies,
        totalEffort,
      };
    } catch (error) {
      throw new PlannerError(
        `Failed to parse decomposition response: ${error instanceof Error ? error.message : String(error)}`,
        "PARSE_ERROR",
        { response, parentTaskId: parentTask.id }
      );
    }
  }

  /**
   * Parse priority string to TaskPriority
   */
  private parsePriority(priority: string): TaskPriority {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return TaskPriority.URGENT;
      case "high":
        return TaskPriority.HIGH;
      case "low":
        return TaskPriority.LOW;
      case "medium":
      default:
        return TaskPriority.MEDIUM;
    }
  }

  /**
   * Decompose a task using rule-based approach
   */
  private decomposeWithRules(
    task: Task,
    complexity: { lexical: number; semantic: number; scope: number; total: number }
  ): DecompositionResult {
    const subtasks: Task[] = [];
    const dependencies = new Map<string, string[]>();

    const description = task.description.toLowerCase();

    // Rule 1: Tasks with "and", ",", or numbered steps indicate multiple parts
    const hasMultipleParts =
      /\band\b/i.test(description) ||
      /,/.test(description) ||
      /\d+\.|step|phase|stage/i.test(description);

    if (hasMultipleParts) {
      // Split by common delimiters
      const parts = description
        .split(/\band\b|,|\d+\.|step|phase|stage/i)
        .map((p) => p.trim())
        .filter((p) => p.length > 10);

      if (parts.length > 1) {
        parts.forEach((part, index) => {
          const subtaskId = `${task.id}-sub-${index}`;
          subtasks.push({
            id: subtaskId,
            description: `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
            status: TaskStatus.PENDING,
            priority: task.priority,
            metadata: {
              parentId: task.id,
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          // Sequential dependencies
          if (index > 0) {
            const prevId = `${task.id}-sub-${index - 1}`;
            dependencies.set(subtaskId, [prevId]);
          }
        });
      }
    }

    // Rule 2: Research/analyze tasks often need separate implementation
    if (/research|analyze|investigate|study/i.test(description)) {
      const researchId = `${task.id}-research`;
      subtasks.push({
        id: researchId,
        description: `Research and analyze: ${task.description}`,
        status: TaskStatus.PENDING,
        priority: task.priority,
        metadata: {
          parentId: task.id,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // If there are other subtasks, they depend on research
      if (subtasks.length > 1) {
        const otherSubtasks = subtasks.filter((st) => st.id !== researchId);
        for (const st of otherSubtasks) {
          const deps = dependencies.get(st.id) ?? [];
          deps.push(researchId);
          dependencies.set(st.id, deps);
        }
      }
    }

    // Rule 3: Implementation and testing should be separate
    if (/implement|create|build|develop/i.test(description)) {
      const implId = `${task.id}-impl`;
      subtasks.push({
        id: implId,
        description: `Implement: ${task.description}`,
        status: TaskStatus.PENDING,
        priority: task.priority,
        metadata: {
          parentId: task.id,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Add test subtask
      const testId = `${task.id}-test`;
      subtasks.push({
        id: testId,
        description: `Test and verify: ${task.description}`,
        status: TaskStatus.PENDING,
        priority: task.priority,
        metadata: {
          parentId: task.id,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Test depends on implementation
      dependencies.set(testId, [implId]);

      // If there's research, implementation depends on it
      const researchId = `${task.id}-research`;
      if (subtasks.some((st) => st.id === researchId)) {
        dependencies.set(implId, [researchId]);
      }
    }

    // If no subtasks were created by rules, keep the original task
    if (subtasks.length === 0) {
      subtasks.push(task);
    }

    // Remove duplicates based on ID
    const uniqueSubtasks = subtasks.filter(
      (st, index, self) => index === self.findIndex((t) => t.id === st.id)
    );

    const totalEffort = uniqueSubtasks.reduce(
      (sum, t) => sum + this.economist.analyzeComplexity(t).total,
      0
    );

    return {
      subtasks: uniqueSubtasks,
      dependencies,
      totalEffort,
    };
  }

  /**
   * Determine the best execution strategy based on decomposition
   */
  private determineStrategy(decomposition: DecompositionResult): ExecutionStrategy {
    const { subtasks, dependencies } = decomposition;

    if (subtasks.length <= 1) {
      return "sequential";
    }

    // Check for dependencies
    const hasDependencies = dependencies.size > 0;
    
    // Check if any tasks have priority differences
    const priorities = new Set(subtasks.map((st) => st.priority));
    const hasPriorityVariation = priorities.size > 1;

    if (hasPriorityVariation && !hasDependencies) {
      return "priority";
    }

    // Check if tasks can run in parallel (no dependencies)
    const independentTasks = subtasks.filter((st) => !dependencies.has(st.id));
    const parallelizableRatio = independentTasks.length / subtasks.length;

    if (parallelizableRatio >= 0.5 && !hasDependencies) {
      return "parallel";
    }

    return "sequential";
  }

  /**
   * Execute a plan using the configured strategy
   */
  async executePlan(
    plan: Plan,
    executeFn: (task: Task) => Promise<TaskResult>,
    onProgress?: ExecutionProgressCallback
  ): Promise<TaskResult[]> {
    switch (plan.strategy) {
      case "sequential":
        return this.executeSequential(plan, executeFn, onProgress);
      case "parallel":
        return this.executeParallel(plan, executeFn, onProgress);
      case "priority":
        return this.executePriority(plan, executeFn, onProgress);
      default:
        return this.executeSequential(plan, executeFn, onProgress);
    }
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequential(
    plan: Plan,
    executeFn: (task: Task) => Promise<TaskResult>,
    onProgress?: ExecutionProgressCallback
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const executionOrder = this.getExecutionOrder(plan);

    for (const taskId of executionOrder) {
      const subtask = plan.subtasks.find((t) => t.id === taskId);
      if (!subtask) continue;

      onProgress?.(taskId, TaskStatus.RUNNING, 0);

      try {
        const result = await executeFn(subtask);
        results.push(result);
        onProgress?.(taskId, result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED, 100);

        // Stop execution if a critical task fails
        if (!result.success && subtask.priority === TaskPriority.URGENT) {
          console.warn(`Critical task ${taskId} failed, stopping execution`);
          break;
        }
      } catch (error) {
        const failedResult: TaskResult = {
          taskId: subtask.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
        };
        results.push(failedResult);
        onProgress?.(taskId, TaskStatus.FAILED, 0);
      }
    }

    return results;
  }

  /**
   * Execute independent tasks in parallel
   */
  private async executeParallel(
    plan: Plan,
    executeFn: (task: Task) => Promise<TaskResult>,
    onProgress?: ExecutionProgressCallback
  ): Promise<TaskResult[]> {
    const executionOrder = this.getExecutionOrder(plan);
    const executed = new Set<string>();
    const results: TaskResult[] = [];

    // Group tasks by dependency level
    const levels = this.getDependencyLevels(plan);

    for (const level of levels) {
      // Execute all tasks at this level in parallel
      const levelPromises = level.map(async (taskId) => {
        const subtask = plan.subtasks.find((t) => t.id === taskId);
        if (!subtask) return null;

        onProgress?.(taskId, TaskStatus.RUNNING, 0);

        try {
          const result = await executeFn(subtask);
          onProgress?.(
            taskId,
            result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
            100
          );
          return result;
        } catch (error) {
          onProgress?.(taskId, TaskStatus.FAILED, 0);
          return {
            taskId: subtask.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: 0,
          };
        }
      });

      const levelResults = await Promise.all(levelPromises);
      for (const result of levelResults) {
        if (result) results.push(result);
      }

      // Mark all tasks in this level as executed
      for (const taskId of level) {
        executed.add(taskId);
      }
    }

    return results;
  }

  /**
   * Execute tasks by priority order
   */
  private async executePriority(
    plan: Plan,
    executeFn: (task: Task) => Promise<TaskResult>,
    onProgress?: ExecutionProgressCallback
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    
    // Sort by priority (URGENT > HIGH > MEDIUM > LOW)
    const priorityOrder = [TaskPriority.URGENT, TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW];
    
    for (const priority of priorityOrder) {
      const tasksAtPriority = plan.subtasks.filter((st) => st.priority === priority);
      if (tasksAtPriority.length === 0) continue;

      // Within same priority, respect dependencies
      const subPlan: Plan = {
        ...plan,
        subtasks: tasksAtPriority,
        strategy: "sequential", // Use sequential within same priority
      };

      const priorityResults = await this.executeSequential(subPlan, executeFn, onProgress);
      results.push(...priorityResults);
    }

    return results;
  }

  /**
   * Get the execution order based on strategy and dependencies
   */
  getExecutionOrder(plan: Plan): string[] {
    switch (plan.strategy) {
      case "sequential":
        return this.getSequentialOrder(plan);
      case "parallel":
        return this.getParallelOrder(plan);
      case "priority":
        return this.getPriorityOrder(plan);
      default:
        return this.getSequentialOrder(plan);
    }
  }

  /**
   * Get sequential execution order respecting dependencies
   */
  private getSequentialOrder(plan: Plan): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (taskId: string, path: string[] = []): void => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        throw new PlannerError(
          `Circular dependency detected: ${path.join(" -> ")} -> ${taskId}`,
          "CIRCULAR_DEPENDENCY",
          { path, taskId }
        );
      }

      visiting.add(taskId);
      path.push(taskId);

      // Visit dependencies first
      const deps = plan.dependencies.get(taskId) ?? [];
      for (const depId of deps) {
        if (plan.subtasks.some((t) => t.id === depId)) {
          visit(depId, [...path]);
        }
      }

      visiting.delete(taskId);
      visited.add(taskId);
      order.push(taskId);
    };

    // Visit all subtasks
    for (const subtask of plan.subtasks) {
      visit(subtask.id);
    }

    return order;
  }

  /**
   * Get parallel execution order (grouped by dependency level)
   */
  private getParallelOrder(plan: Plan): string[] {
    const levels = this.getDependencyLevels(plan);
    return levels.flat();
  }

  /**
   * Get priority-based execution order
   */
  private getPriorityOrder(plan: Plan): string[] {
    const priorityWeights: Record<TaskPriority, number> = {
      [TaskPriority.URGENT]: 4,
      [TaskPriority.HIGH]: 3,
      [TaskPriority.MEDIUM]: 2,
      [TaskPriority.LOW]: 1,
    };

    // Sort by priority, but within same priority respect dependencies
    const sorted = [...plan.subtasks].sort((a, b) => {
      const priorityDiff = priorityWeights[b.priority] - priorityWeights[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // If same priority, check dependencies
      const aDeps = plan.dependencies.get(a.id) ?? [];
      const bDeps = plan.dependencies.get(b.id) ?? [];
      if (aDeps.includes(b.id)) return 1; // a depends on b, so b first
      if (bDeps.includes(a.id)) return -1; // b depends on a, so a first
      
      return 0;
    });

    return sorted.map((t) => t.id);
  }

  /**
   * Get dependency levels for parallel execution
   * Each level contains tasks that can be executed simultaneously
   */
  private getDependencyLevels(plan: Plan): string[][] {
    const levels: string[][] = [];
    const remaining = new Set(plan.subtasks.map((t) => t.id));
    const completed = new Set<string>();

    while (remaining.size > 0) {
      const currentLevel: string[] = [];

      for (const taskId of remaining) {
        const deps = plan.dependencies.get(taskId) ?? [];
        const allDepsCompleted = deps.every(
          (depId) => completed.has(depId) || !plan.subtasks.some((t) => t.id === depId)
        );

        if (allDepsCompleted) {
          currentLevel.push(taskId);
        }
      }

      if (currentLevel.length === 0) {
        // Deadlock - circular dependency or missing dependency
        throw new PlannerError(
          `Unable to resolve dependencies for tasks: ${Array.from(remaining).join(", ")}`,
          "DEPENDENCY_RESOLUTION_FAILED",
          { remainingTasks: Array.from(remaining) }
        );
      }

      for (const taskId of currentLevel) {
        remaining.delete(taskId);
        completed.add(taskId);
      }

      levels.push(currentLevel);
    }

    return levels;
  }

  /**
   * Validate a plan for errors
   */
  validatePlan(plan: Plan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for empty plan
    if (plan.subtasks.length === 0) {
      errors.push("Plan has no subtasks");
    }

    // Check for duplicate task IDs
    const taskIds = plan.subtasks.map((t) => t.id);
    const duplicates = taskIds.filter((id, index) => taskIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate task IDs: ${duplicates.join(", ")}`);
    }

    // Check for circular dependencies
    try {
      this.getSequentialOrder(plan);
    } catch (error) {
      if (error instanceof PlannerError && error.code === "CIRCULAR_DEPENDENCY") {
        errors.push(error.message);
      }
    }

    // Check for missing dependencies
    for (const [taskId, deps] of plan.dependencies) {
      for (const depId of deps) {
        if (!plan.subtasks.some((t) => t.id === depId)) {
          errors.push(`Task ${taskId} depends on missing task ${depId}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get statistics about a plan
   */
  getPlanStats(plan: Plan): {
    totalTasks: number;
    totalDependencies: number;
    estimatedEffort: number;
    averageComplexity: number;
    strategy: ExecutionStrategy;
    parallelizableTasks: number;
  } {
    const complexities = plan.subtasks.map((t) => this.economist.analyzeComplexity(t).total);
    const averageComplexity = complexities.length > 0 
      ? complexities.reduce((a, b) => a + b, 0) / complexities.length 
      : 0;

    const independentTasks = plan.subtasks.filter((t) => !plan.dependencies.has(t.id));

    return {
      totalTasks: plan.subtasks.length,
      totalDependencies: plan.dependencies.size,
      estimatedEffort: plan.estimatedEffort,
      averageComplexity,
      strategy: plan.strategy,
      parallelizableTasks: independentTasks.length,
    };
  }
}

export default Planner;
