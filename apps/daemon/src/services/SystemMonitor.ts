import type { ResourceUsage, DaemonStatus, SystemHealth, HealthStatus } from '@amicus/types/dashboard';

const startTime = Date.now();

export function getResourceUsage(): ResourceUsage {
  const memUsage = process.memoryUsage();
  const totalMem = require('os').totalmem();
  
  return {
    cpu: 0,
    memoryUsed: memUsage.heapUsed,
    memoryTotal: totalMem,
    memoryPercent: (memUsage.heapUsed / totalMem) * 100,
  };
}

export function getDaemonStatus(): DaemonStatus {
  return {
    running: true,
    pid: process.pid,
    uptime: Date.now() - startTime,
    startedAt: startTime,
    lastHeartbeat: Date.now(),
  };
}

export function getSystemHealth(): SystemHealth {
  const daemon = getDaemonStatus();
  const resources = getResourceUsage();
  
  let status: HealthStatus = 'healthy';
  if (resources.memoryPercent > 90) status = 'degraded';
  if (!daemon.running) status = 'unhealthy';
  
  return {
    status,
    daemon,
    resources,
    services: {},
    timestamp: Date.now(),
  };
}
