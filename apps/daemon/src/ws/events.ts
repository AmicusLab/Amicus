import type { Task, TaskStatus } from '@amicus/types/core';
import type { TaskEventPayload } from '@amicus/types/dashboard';
import { broadcast } from './WebSocketManager.js';
import { onTaskEvent } from '../services/EngineService.js';

export function setupEventBroadcasting(): void {
  onTaskEvent('taskStarted', (task: Task) => {
    const payload: TaskEventPayload = { task, status: 'running' as TaskStatus };
    broadcast('task:started', payload);
  });

  onTaskEvent('taskCompleted', (task: Task) => {
    const payload: TaskEventPayload = { task, status: 'completed' as TaskStatus };
    broadcast('task:completed', payload);
  });

  onTaskEvent('taskFailed', (task: Task) => {
    const payload: TaskEventPayload = { task, status: 'failed' as TaskStatus };
    broadcast('task:failed', payload);
  });

  onTaskEvent('taskStatusChanged', (task: Task, status?: TaskStatus) => {
    if (status) {
      const payload: TaskEventPayload = { task, status };
      broadcast('task:progress', payload);
    }
  });
}
