import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { APIResponse } from '@amicus/types/dashboard';
import { getSystemHealth } from '../services/SystemMonitor.js';
import {
  getScheduledTasks,
  getRunningTaskIds,
  pauseTask,
  resumeTask,
  cancelTask,
  emergencyStop,
  getTokenomics,
} from '../services/EngineService.js';

export const apiRoutes = new Hono();

function response<T>(data: T, success = true): APIResponse<T> {
  return {
    success,
    data,
    meta: {
      requestId: randomUUID(),
      timestamp: Date.now(),
      duration: 0,
    },
  };
}

function errorResponse(code: string, message: string): APIResponse {
  return {
    success: false,
    error: { code, message },
    meta: {
      requestId: randomUUID(),
      timestamp: Date.now(),
      duration: 0,
    },
  };
}

apiRoutes.get('/status', (c) => {
  return c.json(response(getSystemHealth()));
});

apiRoutes.get('/tasks', (c) => {
  const scheduled = getScheduledTasks();
  const runningIds = getRunningTaskIds();
  
  return c.json(response({
    scheduled,
    running: runningIds,
    count: {
      scheduled: scheduled.length,
      running: runningIds.length,
    },
  }));
});

apiRoutes.post('/tasks/:id/pause', (c) => {
  const taskId = c.req.param('id');
  const success = pauseTask(taskId);
  
  if (!success) {
    return c.json(errorResponse('TASK_NOT_FOUND', `Task ${taskId} not found or not running`), 404);
  }
  
  return c.json(response({ taskId, action: 'paused' }));
});

apiRoutes.post('/tasks/:id/resume', (c) => {
  const taskId = c.req.param('id');
  const success = resumeTask(taskId);
  
  if (!success) {
    return c.json(errorResponse('TASK_NOT_FOUND', `Task ${taskId} not found or not paused`), 404);
  }
  
  return c.json(response({ taskId, action: 'resumed' }));
});

apiRoutes.post('/tasks/:id/cancel', (c) => {
  const taskId = c.req.param('id');
  const success = cancelTask(taskId);
  
  if (!success) {
    return c.json(errorResponse('TASK_NOT_FOUND', `Task ${taskId} not found`), 404);
  }
  
  return c.json(response({ taskId, action: 'cancelled' }));
});

apiRoutes.get('/tokenomics', (c) => {
  return c.json(response(getTokenomics()));
});

apiRoutes.post('/tasks/emergency-stop', (c) => {
  const cancelledIds = emergencyStop();
  
  return c.json(response({ 
    action: 'emergency_stop',
    cancelledCount: cancelledIds.length,
    cancelledIds,
  }));
});
