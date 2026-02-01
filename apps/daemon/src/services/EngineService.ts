import { RoutineEngine } from '@amicus/core';
import { ContextManager } from '@amicus/memory';
import type { Task, TaskStatus, TaskResult } from '@amicus/types/core';
import type { Tokenomics } from '@amicus/types/dashboard';
import { mcpService } from './MCPService.js';
import { tokenomicsService } from './TokenomicsService.js';
import { providerService } from './ProviderService.js';
import { repoRoot } from './ConfigService.js';

let engineInstance: RoutineEngine | null = null;
let contextManagerInstance: ContextManager | null = null;

export function getEngine(): RoutineEngine {
  if (!engineInstance) {
    if (!contextManagerInstance) {
      contextManagerInstance = new ContextManager({ repoRoot });
    }
    const mcpClient = mcpService.getClient();
    engineInstance = new RoutineEngine({
      contextManager: contextManagerInstance,
      ...(mcpClient && { mcpClient }),
    });
    engineInstance.initialize().catch((error: unknown) => {
      console.error('[Daemon] RoutineEngine initialization failed', error);
    });
  }
  return engineInstance;
}

export async function startEngine(): Promise<void> {
  await providerService.initialize();
  await mcpService.initialize();
  getEngine().start();
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

export function emergencyStop(): string[] {
  return getEngine().emergencyStop();
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
  return tokenomicsService.getTokenomics();
}
