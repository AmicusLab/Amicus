import { RoutineEngine, type ContextManagerLike } from '@amicus/core';
import type { Task, TaskStatus, TaskResult } from '@amicus/types/core';
import type { Tokenomics, ModelUsageStats } from '@amicus/types/dashboard';

const mockContextManager: ContextManagerLike = {
  async loadContext() {
    return '## Context\nNo active context.';
  },
  async updateShortTerm(_content: string) {},
  async consolidate() {},
};

let engineInstance: RoutineEngine | null = null;

export function getEngine(): RoutineEngine {
  if (!engineInstance) {
    engineInstance = new RoutineEngine({
      contextManager: mockContextManager,
    });
  }
  return engineInstance;
}

export function getScheduledTasks(): Array<{ taskId: string; cronExpression: string; task: Task }> {
  return getEngine().getScheduledRoutines();
}

export function getRunningTaskIds(): string[] {
  return getEngine().getRunningTaskIds();
}

export function pauseTask(taskId: string): boolean {
  return getEngine().pauseTask(taskId);
}

export function resumeTask(taskId: string): boolean {
  return getEngine().resumeTask(taskId);
}

export function cancelTask(taskId: string): boolean {
  return getEngine().cancelTask(taskId);
}

export async function executeTask(task: Task): Promise<TaskResult> {
  return getEngine().executeTask(task);
}

export function onTaskEvent(
  event: 'taskStarted' | 'taskCompleted' | 'taskFailed' | 'taskStatusChanged',
  handler: (task: Task, status?: TaskStatus) => void
): void {
  getEngine().on(event, handler);
}

export function getTokenomics(): Tokenomics {
  const mockStats: ModelUsageStats = {
    model: 'claude-3-5-sonnet',
    provider: 'anthropic',
    tokens: { input: 1000, output: 500, total: 1500 },
    cost: { usd: 0.015, inputRate: 0.003, outputRate: 0.015 },
    callCount: 5,
    avgLatency: 1200,
    errorCount: 0,
  };

  return {
    byModel: [mockStats],
    totalTokens: mockStats.tokens,
    totalCost: mockStats.cost,
    periodStart: Date.now() - 3600000,
    periodEnd: Date.now(),
  };
}
