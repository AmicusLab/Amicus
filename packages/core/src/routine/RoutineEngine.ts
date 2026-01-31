import { EventEmitter } from "node:events";
import { schedule, type ScheduledTask, validate } from "node-cron";
import {
  setup,
  createMachine,
  fromPromise,
  assign,
  createActor,
  type ActorRefFrom,
  type AnyActorRef,
} from "xstate";
import {
  TaskStatus,
  type Task,
  type TaskResult,
} from "@amicus/types/core";
import type { Tool } from "@amicus/types/mcp";
import { ToolRegistry } from "../tools/index.js";

export interface OperationExecutor {
  execute<T>(taskDescription: string, operationFunction: () => Promise<T>): Promise<T>;
}

export interface ContextManagerLike {
  loadContext(): Promise<string>;
  updateShortTerm(content: string): Promise<void>;
  consolidate(): Promise<void>;
}

export interface MCPClientLike {
  discoverTools(): Promise<Tool[]>;
  invokeTool(
    name: string,
    params: Record<string, unknown>
  ): Promise<{ content: string; isError?: boolean }>;
}

/**
 * Context for the routine state machine
 */
interface RoutineMachineContext {
  task: Task | null;
  error: Error | null;
  result: TaskResult | null;
}

/**
 * Events that can be sent to the routine state machine
 */
type RoutineMachineEvent =
  | { type: "SCHEDULE"; task: Task }
  | { type: "START"; task: Task }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "CANCEL" }
  | { type: "COMPLETE"; result: TaskResult }
  | { type: "FAIL"; error: Error }
  | { type: "RETRY" };

/**
 * Input for the executeTask actor
 */
interface ExecuteTaskInput {
  task: Task;
  operationExecutor: OperationExecutor;
  contextManager: ContextManagerLike;
  mcpClient: MCPClientLike | undefined;
  toolRegistry: ToolRegistry | undefined;
  emitStatusChange: (task: Task, status: TaskStatus) => void;
}

/**
 * Create the routine state machine
 */
export const createRoutineMachine = (
  operationExecutor: OperationExecutor,
  contextManager: ContextManagerLike,
  emitStatusChange: (task: Task, status: TaskStatus) => void,
  mcpClient?: MCPClientLike,
  toolRegistry?: ToolRegistry
) => {
  return setup({
    types: {
      context: {} as RoutineMachineContext,
      events: {} as RoutineMachineEvent,
    },
    actors: {
      executeTask: fromPromise<TaskResult, ExecuteTaskInput>(
        async ({ input }) => {
          const {
            task,
            operationExecutor,
            contextManager,
            mcpClient,
            toolRegistry,
            emitStatusChange,
          } = input;

          // Emit task started event
          emitStatusChange(task, TaskStatus.RUNNING);

          // Update context before execution
          await contextManager.updateShortTerm(
            `Task started: ${task.id} - ${task.description}`
          );

          try {
            // Check if task requires tool invocation
            if (task.tool && mcpClient && toolRegistry) {
              const tool = toolRegistry.get(task.tool);
              if (tool) {
                const toolResult = await mcpClient.invokeTool(tool.name, task.parameters || {});
                const executionResult: TaskResult = {
                  taskId: task.id,
                  success: !toolResult.isError,
                  data: { toolResult: toolResult.content },
                  metadata: {
                    executedAt: Date.now(),
                    tool: tool.name,
                  },
                };
                
                // Update context on success
                await contextManager.updateShortTerm(
                  `Task completed: ${task.id} - ${task.description}`
                );

                // Emit task completed event
                emitStatusChange(task, TaskStatus.COMPLETED);

                return executionResult;
              }
            }

            // Execute the task using the injected executor
            // Since tasks are abstract, we convert them to a description
            // and execute a placeholder operation
            const result = await operationExecutor.execute<TaskResult>(
              `Execute task: ${task.description}`,
              async () => {
                // Simulate task execution
                // In a real implementation, this would execute the actual task
                const executionResult: TaskResult = {
                  taskId: task.id,
                  success: true,
                  data: { executed: true, taskId: task.id },
                  metadata: {
                    executedAt: Date.now(),
                  },
                };
                return executionResult;
              }
            );

            // Update context on success
            await contextManager.updateShortTerm(
              `Task completed: ${task.id} - ${task.description}`
            );

            // Emit task completed event
            emitStatusChange(task, TaskStatus.COMPLETED);

            return result;
          } catch (error) {
            const taskError =
              error instanceof Error ? error : new Error(String(error));

            // Update context on failure
            await contextManager.updateShortTerm(
              `Task failed: ${task.id} - ${task.description}. Error: ${taskError.message}`
            );

            // Emit task failed event
            emitStatusChange(task, TaskStatus.FAILED);

            throw taskError;
          }
        }
      ),
    },
    actions: {
      assignTask: assign({
        task: (_, params: { event: { task: Task } }) => params.event.task,
        error: () => null,
        result: () => null,
      }),
      assignResult: assign({
        result: (_, params: { event: { output: TaskResult } }) =>
          params.event.output,
        error: () => null,
      }),
      assignError: assign({
        error: (_, params: { event: { error: unknown } }) => {
          const err = params.event.error;
          return err instanceof Error ? err : new Error(String(err));
        },
        result: () => null,
      }),
      assignCancelledError: assign({
        error: () => new Error("Task cancelled"),
        result: () => null,
      }),
      logCompleted: ({ context }) => {
        console.log(
          `[RoutineEngine] Task ${context.task?.id} completed successfully`
        );
      },
      logFailed: ({ context }) => {
        console.error(
          `[RoutineEngine] Task ${context.task?.id} failed:`,
          context.error?.message
        );
      },
    },
  }).createMachine({
    id: "routine",
    initial: "idle",
    context: {
      task: null,
      error: null,
      result: null,
    },
    states: {
      idle: {
        on: {
          SCHEDULE: {
            target: "scheduled",
            actions: { type: "assignTask", params: ({ event }) => ({ event }) },
          },
          START: {
            target: "running",
            actions: { type: "assignTask", params: ({ event }) => ({ event }) },
          },
        },
      },
      scheduled: {
        on: {
          START: {
            target: "running",
            actions: { type: "assignTask", params: ({ event }) => ({ event }) },
          },
          CANCEL: {
            target: "failed",
            actions: {
              type: "assignCancelledError",
            },
          },
        },
      },
      running: {
        invoke: {
          src: "executeTask",
          input: ({ context }): ExecuteTaskInput =>
            ({
              task: context.task!,
              operationExecutor,
              contextManager,
              mcpClient,
              toolRegistry: toolRegistry ?? new ToolRegistry(),
              emitStatusChange,
            }),
          onDone: {
            target: "completed",
            actions: {
              type: "assignResult",
              params: ({ event }) => ({ event }),
            },
          },
          onError: {
            target: "failed",
            actions: {
              type: "assignError",
              params: ({ event }) => ({ event }),
            },
          },
        },
        on: {
          PAUSE: {
            target: "paused",
          },
          CANCEL: {
            target: "failed",
            actions: {
              type: "assignCancelledError",
            },
          },
        },
      },
      paused: {
        on: {
          RESUME: {
            target: "running",
          },
          CANCEL: {
            target: "failed",
            actions: {
              type: "assignCancelledError",
            },
          },
        },
      },
      completed: {
        type: "final",
        entry: { type: "logCompleted" },
      },
      failed: {
        type: "final",
        entry: { type: "logFailed" },
        on: {
          RETRY: {
            target: "running",
            guard: ({ context }) => context.task !== null,
          },
        },
      },
    },
  });
};

// Type for the machine
export type RoutineMachine = ReturnType<typeof createRoutineMachine>;

/**
 * Options for creating a RoutineEngine instance
 */
export interface RoutineEngineOptions {
  operationExecutor?: OperationExecutor;
  contextManager: ContextManagerLike;
  mcpClient?: MCPClientLike;
}

/**
 * Scheduled routine entry
 */
interface ScheduledRoutine {
  cronExpression: string;
  task: Task;
  scheduledTask: ScheduledTask;
}

/**
 * RoutineEngine manages scheduled tasks using XState machines and cron scheduling.
 * Integrates with an injected executor for task execution and ContextManager for memory.
 */
export class RoutineEngine extends EventEmitter {
  private readonly operationExecutor: OperationExecutor;
  private readonly contextManager: ContextManagerLike;
  private readonly mcpClient: MCPClientLike | undefined;
  private readonly toolRegistry: ToolRegistry;
  private readonly scheduledRoutines: Map<string, ScheduledRoutine> = new Map();
  private readonly runningMachines: Map<string, AnyActorRef> = new Map();
  private isRunning = false;

  /**
   * Creates a new RoutineEngine instance
   */
  constructor(options: RoutineEngineOptions) {
    super();
    this.operationExecutor =
      options.operationExecutor ??
      ({
        execute: async <T>(
          _taskDescription: string,
          operationFunction: () => Promise<T>
        ): Promise<T> => operationFunction(),
      } satisfies OperationExecutor);
    this.contextManager = options.contextManager;
    this.mcpClient = options.mcpClient;
    this.toolRegistry = new ToolRegistry();
  }

  /**
   * Initialize the routine engine
   * Discovers tools from MCP server if available
   */
  async initialize(): Promise<void> {
    if (this.mcpClient) {
      const tools = await this.mcpClient.discoverTools();
      for (const tool of tools) {
        this.toolRegistry.register(tool);
      }
    }
  }

  /**
   * Schedule a routine with a cron expression
   * @param cronExpression - Cron expression (e.g., "0 9 * * 1-5" for weekdays at 9am)
   * @param task - The task to execute
   * @returns true if scheduled successfully, false otherwise
   */
  schedule(cronExpression: string, task: Task): boolean {
    // Validate cron expression
    if (!validate(cronExpression)) {
      console.error(
        `[RoutineEngine] Invalid cron expression: ${cronExpression}`
      );
      return false;
    }

    // Check if task is already scheduled
    if (this.scheduledRoutines.has(task.id)) {
      console.warn(
        `[RoutineEngine] Task ${task.id} is already scheduled. Unscheduling first.`
      );
      this.unschedule(task.id);
    }

    // Create the scheduled task
    const scheduledTask = schedule(
      cronExpression,
      async () => {
        if (!this.isRunning) {
          console.log(
            `[RoutineEngine] Engine stopped, skipping task ${task.id}`
          );
          return;
        }

        console.log(`[RoutineEngine] Executing scheduled task: ${task.id}`);
        await this.executeTask(task);
      },
      {
        scheduled: false, // Don't start immediately, wait for start()
      }
    );

    this.scheduledRoutines.set(task.id, {
      cronExpression,
      task,
      scheduledTask,
    });

    // If already running, start this task immediately
    if (this.isRunning) {
      scheduledTask.start();
    }

    console.log(
      `[RoutineEngine] Task ${task.id} scheduled with cron: ${cronExpression}`
    );
    return true;
  }

  /**
   * Unschedule a task by ID
   * @param taskId - The ID of the task to unschedule
   * @returns true if unscheduled successfully, false if not found
   */
  unschedule(taskId: string): boolean {
    const scheduledRoutine = this.scheduledRoutines.get(taskId);
    if (!scheduledRoutine) {
      return false;
    }

    scheduledRoutine.scheduledTask.stop();
    this.scheduledRoutines.delete(taskId);
    console.log(`[RoutineEngine] Task ${taskId} unscheduled`);
    return true;
  }

  /**
   * Execute a task immediately (not scheduled)
   * @param task - The task to execute
   * @returns Promise that resolves when the task completes or fails
   */
  executeTask(task: Task): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      const machine = createRoutineMachine(
        this.operationExecutor,
        this.contextManager,
        (t, status) => this.emitStatusChange(t, status),
        this.mcpClient,
        this.toolRegistry
      );

      // Create and start the actor
      const actor = createActor(machine);

      // Track the running machine
      this.runningMachines.set(task.id, actor);

      actor.subscribe({
        next: (state) => {
          const stateValue = state.value as string;
          if (stateValue === "completed") {
            this.runningMachines.delete(task.id);
            resolve(state.context.result!);
          } else if (stateValue === "failed") {
            this.runningMachines.delete(task.id);
            reject(state.context.error);
          }
        },
        error: (err) => {
          this.runningMachines.delete(task.id);
          reject(err);
        },
      });

      actor.start();
      actor.send({ type: "START", task });
    });
  }

  /**
   * Start the routine engine
   * Begins executing scheduled tasks
   */
  start(): void {
    if (this.isRunning) {
      console.log("[RoutineEngine] Already running");
      return;
    }

    this.isRunning = true;

    // Start all scheduled tasks
    for (const [taskId, routine] of this.scheduledRoutines) {
      routine.scheduledTask.start();
      console.log(`[RoutineEngine] Started scheduled task: ${taskId}`);
    }

    console.log("[RoutineEngine] Engine started");
    this.emit("started");
  }

  /**
   * Stop the routine engine
   * Stops executing new scheduled tasks but doesn't interrupt running ones
   */
  stop(): void {
    if (!this.isRunning) {
      console.log("[RoutineEngine] Already stopped");
      return;
    }

    this.isRunning = false;

    // Stop all scheduled tasks
    for (const [taskId, routine] of this.scheduledRoutines) {
      routine.scheduledTask.stop();
      console.log(`[RoutineEngine] Stopped scheduled task: ${taskId}`);
    }

    console.log("[RoutineEngine] Engine stopped");
    this.emit("stopped");
  }

  /**
   * Get all scheduled routines
   * @returns Array of scheduled routine information
   */
  getScheduledRoutines(): Array<{
    taskId: string;
    cronExpression: string;
    task: Task;
  }> {
    return Array.from(this.scheduledRoutines.entries()).map(
      ([taskId, routine]) => ({
        taskId,
        cronExpression: routine.cronExpression,
        task: routine.task,
      })
    );
  }

  /**
   * Check if a task is currently running
   * @param taskId - The ID of the task to check
   * @returns true if the task is running
   */
  isTaskRunning(taskId: string): boolean {
    return this.runningMachines.has(taskId);
  }

  /**
   * Get all currently running task IDs
   * @returns Array of running task IDs
   */
  getRunningTaskIds(): string[] {
    return Array.from(this.runningMachines.keys());
  }

  /**
   * Pause a running task
   * @param taskId - The ID of the task to pause
   * @returns true if paused successfully, false if not found or not running
   */
  pauseTask(taskId: string): boolean {
    const machine = this.runningMachines.get(taskId);
    if (!machine) {
      return false;
    }

    machine.send({ type: "PAUSE" });
    return true;
  }

  /**
   * Resume a paused task
   * @param taskId - The ID of the task to resume
   * @returns true if resumed successfully, false if not found or not paused
   */
  resumeTask(taskId: string): boolean {
    const machine = this.runningMachines.get(taskId);
    if (!machine) {
      return false;
    }

    machine.send({ type: "RESUME" });
    return true;
  }

  /**
   * Cancel a running or scheduled task
   * @param taskId - The ID of the task to cancel
   * @returns true if cancelled successfully
   */
  cancelTask(taskId: string): boolean {
    // Try to unschedule first
    const unscheduled = this.unschedule(taskId);

    // Try to cancel running machine
    const machine = this.runningMachines.get(taskId);
    if (machine) {
      machine.send({ type: "CANCEL" });
      return true;
    }

    return unscheduled;
  }

  /**
   * Internal method to emit status change events
   */
  private emitStatusChange(task: Task, status: TaskStatus): void {
    this.emit("taskStatusChanged", task, status);

    switch (status) {
      case TaskStatus.RUNNING:
        this.emit("taskStarted", task);
        break;
      case TaskStatus.COMPLETED:
        this.emit("taskCompleted", task);
        break;
      case TaskStatus.FAILED:
        this.emit("taskFailed", task);
        break;
      case TaskStatus.PAUSED:
        this.emit("taskPaused", task);
        break;
    }
  }
}

export type { RoutineMachineContext, RoutineMachineEvent };
