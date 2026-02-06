import type { Message } from '@amicus/types';

export class ConversationManager {
  private readonly history = new Map<string, Message[]>();
  private readonly maxMessages: number;

  constructor(options?: { maxMessages?: number }) {
    this.maxMessages = options?.maxMessages ?? 20;
  }

  addMessage(sessionId: string, message: Message): void {
    const messages = this.history.get(sessionId) ?? [];
    messages.push(message);

    if (messages.length > this.maxMessages) {
      messages.splice(0, messages.length - this.maxMessages);
    }

    this.history.set(sessionId, messages);
  }

  getHistory(sessionId: string): Message[] {
    return (this.history.get(sessionId) ?? []).slice();
  }

  clear(sessionId: string): void {
    this.history.delete(sessionId);
  }
}
