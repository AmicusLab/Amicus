import React from 'react';
import { Box, Text } from 'ink';
import type { Tokenomics } from '@amicus/types/dashboard';

interface TokenomicsPanelProps {
  data: Tokenomics | null;
}

export function TokenomicsPanel({ data }: TokenomicsPanelProps) {
  return (
    <Box flexDirection="column" borderStyle="single" padding={1}>
      <Box marginBottom={1}>
        <Text bold>Tokenomics</Text>
      </Box>
      
      {data ? (
        <>
          <Box>
            <Text>Total Cost: </Text>
            <Text color="green">${data.totalCost.usd.toFixed(4)}</Text>
          </Box>
          <Box>
            <Text>Tokens: </Text>
            <Text>{data.totalTokens.total.toLocaleString()}</Text>
          </Box>
          {data.byModel.map(m => (
            <Box key={m.model}>
              <Text color="gray">  {m.model}: </Text>
              <Text>{m.callCount} calls</Text>
            </Box>
          ))}
        </>
      ) : (
        <Text color="gray">Loading...</Text>
      )}
    </Box>
  );
}
