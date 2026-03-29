import type { Message, ChatConfig, StreamChunk } from '@amicus/types';

const API_BASE = '/api';

/**
 * Stream chat messages via SSE
 * @param messages - Array of conversation messages
 * @param config - Optional chat configuration
 * @returns ReadableStream of StreamChunk objects
 */
export async function streamChat(
  messages: Message[],
  config?: ChatConfig
): Promise<ReadableStream<StreamChunk>> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ messages, config }),
  });

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  // Create a TransformStream to parse JSON lines
  const decoder = new TextDecoder();
  let buffer = '';
  
  const transformStream = new TransformStream<Uint8Array, StreamChunk>({
    transform(chunk, controller) {
      // Append new data to buffer
      buffer += decoder.decode(chunk);
      
      // Split by newlines and process complete lines
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        try {
          const parsed = JSON.parse(trimmed) as StreamChunk;
          controller.enqueue(parsed);
        } catch {
          // Skip malformed JSON
          console.warn('Failed to parse SSE line:', trimmed);
        }
      }
    },
    
    flush(controller) {
      // Process any remaining data in buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer) as StreamChunk;
          controller.enqueue(parsed);
        } catch {
          // Ignore final malformed data
        }
      }
    }
  });

  return response.body.pipeThrough(transformStream);
}
