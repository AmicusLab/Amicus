import React from 'react';
import { Box, Text } from 'ink';

interface TaskListProps {
  scheduled: Array<{ taskId: string; cronExpression?: string }>;
  running: string[];
}

export function TaskList({ scheduled, running }: TaskListProps) {
  const total = scheduled.length + running.length;
  
  return (
    <Box flexDirection="column" borderStyle="single" padding={1}>
      <Box marginBottom={1}>
        <Text bold>Tasks ({total})</Text>
      </Box>
      
      {running.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="yellow">Running:</Text>
          {running.map(id => (
            <Text key={id}>  {id}</Text>
          ))}
        </Box>
      )}
      
      {scheduled.length > 0 && (
        <Box flexDirection="column">
          <Text color="cyan">Scheduled:</Text>
          {scheduled.map(t => (
            <Text key={t.taskId}>  {t.taskId}</Text>
          ))}
        </Box>
      )}
      
      {total === 0 && (
        <Text color="gray">No tasks</Text>
      )}
    </Box>
  );
}
