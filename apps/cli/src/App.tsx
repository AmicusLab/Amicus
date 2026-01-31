import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { SystemHealth, Tokenomics } from '@amicus/types/dashboard';
import { StatusPanel } from './components/StatusPanel.js';
import { TaskList } from './components/TaskList.js';
import { TokenomicsPanel } from './components/TokenomicsPanel.js';
import { getStatus, getTasks, getTokenomics, healthCheck } from './api.js';

export function App() {
  const { exit } = useApp();
  const [connected, setConnected] = useState(false);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [tokenomics, setTokenomicsData] = useState<Tokenomics | null>(null);
  const [tasks, setTasks] = useState<{
    scheduled: Array<{ taskId: string; cronExpression?: string }>;
    running: string[];
  }>({ scheduled: [], running: [] });

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      exit();
    }
    if (input === 'r') {
      loadData();
    }
  });

  const loadData = async () => {
    const isConnected = await healthCheck();
    setConnected(isConnected);
    
    if (!isConnected) return;
    
    try {
      const [statusRes, tasksRes, tokenRes] = await Promise.all([
        getStatus(),
        getTasks(),
        getTokenomics(),
      ]);
      
      if (statusRes.success && statusRes.data) setHealth(statusRes.data);
      if (tasksRes.success && tasksRes.data) setTasks(tasksRes.data);
      if (tokenRes.success && tokenRes.data) setTokenomicsData(tokenRes.data);
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Amicus CLI Dashboard</Text>
        <Text color="gray"> | Press 'q' to quit, 'r' to refresh</Text>
      </Box>
      
      <Box>
        <Box flexDirection="column" marginRight={2} width="50%">
          <StatusPanel health={health} connected={connected} />
          <TokenomicsPanel data={tokenomics} />
        </Box>
        <Box flexDirection="column" width="50%">
          <TaskList scheduled={tasks.scheduled} running={tasks.running} />
        </Box>
      </Box>
    </Box>
  );
}
