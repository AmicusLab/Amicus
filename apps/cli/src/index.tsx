#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { getStatus, getTokenomics, getTasks, waitForDaemon } from './api.js';

async function runNonInteractive() {
  console.log('Amicus CLI (non-interactive mode)\n');
  
  // Wait for daemon to be ready
  const isReady = await waitForDaemon(30, 1000);
  if (!isReady) {
    console.error('Failed to connect to daemon. Is it running?');
    process.exit(1);
  }
  
  try {
    const [status, tasks, tokenomics] = await Promise.all([
      getStatus(),
      getTasks(),
      getTokenomics(),
    ]);
    
    if (status.success && status.data) {
      console.log(`Status: ${status.data.status.toUpperCase()}`);
      console.log(`Uptime: ${Math.floor(status.data.daemon.uptime / 1000)}s`);
      console.log(`Memory: ${status.data.resources.memoryPercent.toFixed(1)}%`);
    }
    
    if (tasks.success && tasks.data) {
      console.log(`\nTasks: ${tasks.data.count.scheduled} scheduled, ${tasks.data.count.running} running`);
    }
    
    if (tokenomics.success && tokenomics.data) {
      console.log(`\nCost: $${tokenomics.data.totalCost.usd.toFixed(4)}`);
    }
  } catch (e) {
    console.error('Failed to fetch data from daemon.');
    process.exit(1);
  }
}

if (process.stdin.isTTY) {
  render(<App />);
} else {
  runNonInteractive();
}
