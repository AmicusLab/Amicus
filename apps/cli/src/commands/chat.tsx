import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { v4 as uuidv4 } from 'uuid';
import type { Message } from '@amicus/types/chat';
import { waitForDaemon, sendChat } from '../api.js';

export function Chat() {
  const { exit } = useApp();
  const [sessionId] = useState(() => uuidv4());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [daemonReady, setDaemonReady] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkDaemon() {
      const ready = await waitForDaemon(10, 1000);
      setDaemonReady(ready);
      if (!ready) {
        setError('Failed to connect to daemon. Is it running?');
      }
    }
    checkDaemon();
  }, []);

  useInput(async (char, key) => {
    if (loading || !daemonReady) return;

    if (key.return) {
      const userInput = input.trim();
      if (!userInput) return;

      if (userInput.toLowerCase() === 'exit') {
        exit();
        return;
      }

      setInput('');
      setLoading(true);
      setError(null);

      const userMessage: Message = { role: 'user', content: userInput };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      try {
        const result = await sendChat(updatedMessages);
        const assistantMessage: Message = {
          role: 'assistant',
          content: result.response,
        };
        setMessages([...updatedMessages, assistantMessage]);
      } catch (e) {
        setError(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    } else if (key.ctrl && char === 'c') {
      exit();
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (char && !key.ctrl && !key.meta) {
      setInput((prev) => prev + char);
    }
  });

  if (daemonReady === null) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Checking daemon health...</Text>
      </Box>
    );
  }

  if (daemonReady === false) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">{error}</Text>
        <Text color="gray">Press Ctrl+C to exit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Amicus Chat
        </Text>
        <Text color="gray"> | Session: {sessionId.slice(0, 8)}</Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {messages.slice(-5).map((msg, idx) => (
        <Box key={idx} marginBottom={1}>
          <Text color={msg.role === 'user' ? 'green' : 'blue'}>
            {msg.role === 'user' ? 'You: ' : 'Amicus: '}
          </Text>
          <Text>{msg.content}</Text>
        </Box>
      ))}

      <Box>
        <Text color="green">You: </Text>
        <Text>{input}</Text>
        {loading && <Text color="gray"> (waiting...)</Text>}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">Type your message and press Enter. Type 'exit' or Ctrl+C to quit.</Text>
      </Box>
    </Box>
  );
}
