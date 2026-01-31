import { cpus, loadavg, totalmem } from 'node:os';
import type { ResourceUsage, DaemonStatus, SystemHealth, HealthStatus } from '@amicus/types/dashboard';

const startTime = Date.now();
let lastHeartbeat = startTime;

export function recordHeartbeat(timestamp = Date.now()): void {
  lastHeartbeat = timestamp;
}

function getCpuUsagePercent(): number {
  const [oneMinuteLoad = 0] = loadavg();
  const cpuCount = cpus().length || 1;
  const usage = (oneMinuteLoad / cpuCount) * 100;
  if (Number.isNaN(usage)) return 0;
  return Math.min(100, Math.max(0, usage));
}

export function getResourceUsage(): ResourceUsage {
  const memUsage = process.memoryUsage();
  const totalMem = totalmem();
  const memoryUsed = memUsage.rss;

  return {
    cpu: getCpuUsagePercent(),
    memoryUsed,
    memoryTotal: totalMem,
    memoryPercent: (memoryUsed / totalMem) * 100,
  };
}

export function getDaemonStatus(): DaemonStatus {
  return {
    running: true,
    pid: process.pid,
    uptime: Date.now() - startTime,
    startedAt: startTime,
    lastHeartbeat,
  };
}

export function getSystemHealth(): SystemHealth {
  const daemon = getDaemonStatus();
  const resources = getResourceUsage();

  let status: HealthStatus = 'healthy';
  if (resources.memoryPercent > 90 || resources.cpu > 90) status = 'degraded';
  if (!daemon.running) status = 'unhealthy';

  return {
    status,
    daemon,
    resources,
    services: {},
    timestamp: Date.now(),
  };
}
