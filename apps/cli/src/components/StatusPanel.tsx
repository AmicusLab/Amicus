import React from 'react';
import { Box, Text } from 'ink';
import type { SystemHealth } from '@amicus/types/dashboard';

interface StatusPanelProps {
  health: SystemHealth | null;
  connected: boolean;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function StatusPanel({ health, connected }: StatusPanelProps) {
  const statusColor = health?.status === 'healthy' ? 'green' 
    : health?.status === 'degraded' ? 'yellow' 
    : 'red';
  
  return (
    <Box flexDirection="column" borderStyle="single" padding={1}>
      <Box marginBottom={1}>
        <Text bold>System Status</Text>
        <Text> </Text>
        <Text color={connected ? 'green' : 'red'}>
          {connected ? '[Connected]' : '[Disconnected]'}
        </Text>
      </Box>
      
      {health ? (
        <>
          <Box>
            <Text>Status: </Text>
            <Text color={statusColor} bold>{health.status.toUpperCase()}</Text>
          </Box>
          <Box>
            <Text>Uptime: </Text>
            <Text>{formatUptime(health.daemon.uptime)}</Text>
          </Box>
          <Box>
            <Text>Memory: </Text>
            <Text>{health.resources.memoryPercent.toFixed(1)}%</Text>
          </Box>
          <Box>
            <Text>PID: </Text>
            <Text>{health.daemon.pid}</Text>
          </Box>
        </>
      ) : (
        <Text color="gray">Loading...</Text>
      )}
    </Box>
  );
}
