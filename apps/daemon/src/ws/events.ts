import { TaskStatus, type Task } from '@amicus/types/core';
import type { TaskEventPayload, Tokenomics } from '@amicus/types/dashboard';
import { broadcast } from './WebSocketManager.js';
import { onTaskEvent } from '../services/EngineService.js';
import { tokenomicsService } from '../services/TokenomicsService.js';

export function setupEventBroadcasting(): void {
  onTaskEvent('taskStarted', (task: Task) => {
    const payload: TaskEventPayload = { task, status: TaskStatus.RUNNING };
    broadcast('task:started', payload);
  });

  onTaskEvent('taskCompleted', (task: Task) => {
    const payload: TaskEventPayload = { task, status: TaskStatus.COMPLETED };
    broadcast('task:completed', payload);
  });

  onTaskEvent('taskFailed', (task: Task) => {
    const payload: TaskEventPayload = { task, status: TaskStatus.FAILED };
    broadcast('task:failed', payload);
  });

  onTaskEvent('taskStatusChanged', (task: Task, status?: TaskStatus) => {
    if (status) {
      const payload: TaskEventPayload = { task, status };
      broadcast('task:progress', payload);
    }
  });
}

export function setupTokenomicsBroadcasting(): () => void {
  const broadcastTokenomics = (tokenomics: Tokenomics) => {
    broadcast('tokenomics:update', tokenomics);
  };

  tokenomicsService.start(broadcastTokenomics);

  return () => {
    tokenomicsService.stop();
  };
}

export function broadcastTokenomicsUpdate(tokenomics: Tokenomics): void {
  broadcast('tokenomics:update', tokenomics);
}
