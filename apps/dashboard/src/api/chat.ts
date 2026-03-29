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
  const transformStream = new TransformStream<Uint8Array, StreamChunk>({
    buffer: '',
    
    transform(chunk, controller) {
      // Append new data to buffer
      this.buffer += new TextDecoder().decode(chunk);
      
      // Split by newlines and process complete lines
      const lines = this.buffer.split('\n');
      
      // Keep the last incomplete line in buffer
      this.buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        try {
          const chunk = JSON.parse(trimmed) as StreamChunk;
          controller.enqueue(chunk);
        } catch {
          // Skip malformed JSON
          console.warn('Failed to parse SSE line:', trimmed);
        }
      }
    },
    
    flush(controller) {
      // Process any remaining data in buffer
      if (this.buffer.trim()) {
        try {
          const chunk = JSON.parse(this.buffer) as StreamChunk;
          controller.enqueue(chunk);
        } catch {
          // Ignore final malformed data
        }
      }
    }
  });

  return response.body.pipeThrough(transformStream);
}
