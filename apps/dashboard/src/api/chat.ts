import type { Message, ChatConfig, StreamChunk } from '@amicus/types';

const API_BASE = '/api';

/**
 * Stream chat messages via SSE
 * @param messages - Array of conversation messages
 * @param config - Optional chat configuration
 * @param signal - Optional AbortSignal to cancel the stream
 * @returns ReadableStream of StreamChunk objects
 */
export async function streamChat(
  messages: Message[],
  config?: ChatConfig,
  signal?: AbortSignal
): Promise<ReadableStream<StreamChunk>> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ messages, config }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  // Create a TransformStream to parse SSE format
  // Server sends: "event: <type>\ndata: <json>\n\n"
  return response.body.pipeThrough(createSSEParser());
}

/**
 * Creates a TransformStream that parses SSE format into StreamChunk objects
 */
function createSSEParser(): TransformStream<Uint8Array, StreamChunk> {
  const decoder = new TextDecoder();
  
  return new TransformStream<Uint8Array, StreamChunk>({
    // Use local state within the transform context
    start() {
      // Initialize state in the transformer context
    },
    
    transform(chunk, controller) {
      // Get buffer from the transformer's context via closure
      const text = decoder.decode(chunk);
      processSSEChunk(text, controller);
    },
    
    flush(controller) {
      // Process any remaining data
      flushSSEBuffer(controller);
    }
  });
}

// SSE parser state (reset per stream)
let sseBuffer = '';
let sseEvent = '';
let sseData = '';

function processSSEChunk(text: string, controller: TransformStreamDefaultController<StreamChunk>): void {
  sseBuffer += text;
  
  // Split by double newline to get complete SSE events
  const events = sseBuffer.split('\n\n');
  // Keep the last incomplete event in buffer
  sseBuffer = events.pop() || '';
  
  for (const eventBlock of events) {
    const chunk = parseSSEEvent(eventBlock);
    if (chunk) {
      controller.enqueue(chunk);
    }
  }
}

function parseSSEEvent(eventBlock: string): StreamChunk | null {
  const lines = eventBlock.split('\n');
  let eventType = '';
  let data = '';
  
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data = line.slice(5).trim();
    }
  }
  
  if (!data) return null;
  
  try {
    const parsed = JSON.parse(data);
    
    // Map SSE event types to StreamChunk types
    switch (eventType) {
      case 'delta':
        return { type: 'text_delta', content: parsed.content || '' };
      case 'tool_start':
        return { type: 'tool_call_start', toolName: parsed.toolName, toolCallId: parsed.toolCallId };
      case 'tool_result':
        return { type: 'tool_call_result', toolCallId: parsed.toolCallId, content: parsed.content };
      case 'usage':
        return { type: 'usage', input: parsed.input, output: parsed.output, total: parsed.total };
      case 'done':
        return { type: 'done' };
      case 'error':
        return { type: 'error', message: parsed.message };
      default:
        // Fallback: try to parse as direct StreamChunk
        if (parsed.type) {
          return parsed as StreamChunk;
        }
        return null;
    }
  } catch {
    console.warn('Failed to parse SSE data:', data);
    return null;
  }
}

function flushSSEBuffer(controller: TransformStreamDefaultController<StreamChunk>): void {
  if (sseBuffer.trim()) {
    try {
      const chunk = parseSSEEvent(sseBuffer);
      if (chunk) {
        controller.enqueue(chunk);
      }
    } catch {
      console.warn('Failed to parse final SSE line:', sseBuffer);
    }
  }
  // Reset state for next stream
  sseBuffer = '';
  sseEvent = '';
  sseData = '';
}
