import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ref, createRef } from 'lit/directives/ref.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { chatMessages, chatLoading, chatStreaming } from '../state/signals.js';
import { streamChat } from '../api/chat.js';
import type { Message, StreamChunk } from '@amicus/types';

// Configure marked with highlight.js
marked.setOptions({
  highlight: function(code: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch {
        // Fall through to auto-detection
      }
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true,
});

interface ToolCallInfo {
  id: string;
  name: string;
  status: 'running' | 'done';
  result?: string;
}

@customElement('chat-panel')
export class ChatPanel extends LitElement {
  @property({ type: Array }) messages: Message[] = [];
  @state() private inputValue = '';
  @state() private isStreaming = false;
  @state() private streamingContent = '';
  @state() private toolCalls: Map<string, ToolCallInfo> = new Map();
  
  private messagesEndRef = createRef<HTMLDivElement>();
  private textareaRef = createRef<HTMLTextAreaElement>();

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 120px);
      background: #1a1a2e;
      border-radius: 8px;
      overflow: hidden;
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .message {
      max-width: 85%;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .message-user {
      align-self: flex-end;
      background: #6aa7ff;
      color: #fff;
      border-bottom-right-radius: 4px;
    }

    .message-assistant {
      align-self: flex-start;
      background: #2a2a4a;
      color: #e6e6e6;
      border-bottom-left-radius: 4px;
    }

    .message-system {
      align-self: center;
      background: #333;
      color: #888;
      font-size: 0.875rem;
      max-width: 100%;
      text-align: center;
    }

    .message-tool {
      align-self: flex-start;
      background: #1a1a2a;
      border: 1px solid #444;
      border-radius: 8px;
      max-width: 85%;
      font-size: 0.875rem;
    }

    .message-tool-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: #2a2a4a;
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      user-select: none;
    }

    .message-tool-header:hover {
      background: #3a3a5a;
    }

    .message-tool-name {
      color: #6aa7ff;
      font-weight: 500;
    }

    .message-tool-status {
      font-size: 0.75rem;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
    }

    .status-running {
      background: #fbbf24;
      color: #000;
    }

    .status-done {
      background: #4ade80;
      color: #000;
    }

    .message-tool-content {
      padding: 0.75rem;
      color: #888;
      font-family: monospace;
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
    }

    .message-tool-content.collapsed {
      display: none;
    }

    .message-content {
      line-height: 1.5;
    }

    .message-content pre {
      background: #0a0a1a;
      border-radius: 6px;
      padding: 0.75rem;
      overflow-x: auto;
      margin: 0.5rem 0;
    }

    .message-content code {
      font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
      font-size: 0.875rem;
    }

    .message-content p {
      margin: 0.5rem 0;
    }

    .message-content p:first-child {
      margin-top: 0;
    }

    .message-content p:last-child {
      margin-bottom: 0;
    }

    .message-content ul,
    .message-content ol {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }

    .input-container {
      padding: 1rem;
      background: #16162a;
      border-top: 1px solid #333;
      display: flex;
      gap: 0.75rem;
      align-items: flex-end;
    }

    .input-wrapper {
      flex: 1;
      position: relative;
    }

    textarea {
      width: 100%;
      min-height: 44px;
      max-height: 150px;
      padding: 0.75rem;
      border: 1px solid #444;
      border-radius: 8px;
      background: #1a1a2e;
      color: #e6e6e6;
      font-family: inherit;
      font-size: 0.9375rem;
      resize: none;
      outline: none;
      transition: border-color 0.2s;
    }

    textarea:focus {
      border-color: #6aa7ff;
    }

    textarea::placeholder {
      color: #666;
    }

    .send-button {
      padding: 0.75rem 1.25rem;
      background: #6aa7ff;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s, opacity 0.2s;
      white-space: nowrap;
    }

    .send-button:hover:not(:disabled) {
      background: #5a97ef;
    }

    .send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      color: #888;
      font-size: 0.875rem;
    }

    .loading-dots {
      display: flex;
      gap: 4px;
    }

    .loading-dots span {
      width: 6px;
      height: 6px;
      background: #6aa7ff;
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;
    }

    .loading-dots span:nth-child(1) {
      animation-delay: -0.32s;
    }

    .loading-dots span:nth-child(2) {
      animation-delay: -0.16s;
    }

    @keyframes bounce {
      0%, 80%, 100% {
        transform: scale(0);
      }
      40% {
        transform: scale(1);
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #666;
      text-align: center;
      padding: 2rem;
    }

    .empty-state-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      opacity: 0.5;
    }

    .empty-state-title {
      font-size: 1.25rem;
      color: #888;
      margin-bottom: 0.5rem;
    }

    .empty-state-desc {
      font-size: 0.875rem;
    }
  `;

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    // Auto-scroll to bottom when messages change
    if (changedProperties.has('messages') || changedProperties.has('streamingContent')) {
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    this.messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
  }

  private handleInput(e: Event): void {
    const target = e.target as HTMLTextAreaElement;
    this.inputValue = target.value;
    
    // Auto-resize textarea
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 150) + 'px';
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  private async sendMessage(): Promise<void> {
    const content = this.inputValue.trim();
    if (!content || this.isStreaming) return;

    // Add user message
    const userMessage: Message = { role: 'user', content };
    const updatedMessages = [...this.messages, userMessage];
    this.messages = updatedMessages;
    chatMessages.value = updatedMessages;
    
    // Clear input
    this.inputValue = '';
    if (this.textareaRef.value) {
      this.textareaRef.value.style.height = 'auto';
    }

    // Start streaming
    this.isStreaming = true;
    this.streamingContent = '';
    chatStreaming.value = true;
    chatLoading.value = true;

    try {
      const stream = await streamChat(updatedMessages);
      const reader = stream.getReader();
      
      let assistantContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (value.type === 'text_delta') {
          assistantContent += value.content;
          this.streamingContent = assistantContent;
        } else if (value.type === 'tool_call_start') {
          this.toolCalls.set(value.toolCallId, {
            id: value.toolCallId,
            name: value.toolName,
            status: 'running',
          });
          this.requestUpdate();
        } else if (value.type === 'tool_call_result') {
          const toolCall = this.toolCalls.get(value.toolCallId);
          if (toolCall) {
            toolCall.status = 'done';
            toolCall.result = value.content;
            this.requestUpdate();
          }
        } else if (value.type === 'error') {
          console.error('Stream error:', value.message);
          assistantContent += `\n\n❌ Error: ${value.message}`;
          this.streamingContent = assistantContent;
        } else if (value.type === 'done') {
          // Add assistant message to history
          if (assistantContent) {
            const assistantMessage: Message = { role: 'assistant', content: assistantContent };
            const finalMessages = [...updatedMessages, assistantMessage];
            this.messages = finalMessages;
            chatMessages.value = finalMessages;
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `❌ Failed to get response: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      const finalMessages = [...updatedMessages, errorMessage];
      this.messages = finalMessages;
      chatMessages.value = finalMessages;
    } finally {
      this.isStreaming = false;
      this.streamingContent = '';
      chatStreaming.value = false;
      chatLoading.value = false;
    }
  }

  private renderMarkdown(content: string): string {
    try {
      return marked.parse(content) as string;
    } catch {
      return content;
    }
  }

  private toggleToolContent(toolId: string): void {
    const element = this.shadowRoot?.querySelector(`#tool-content-${toolId}`);
    if (element) {
      element.classList.toggle('collapsed');
    }
  }

  private renderMessage(message: Message, index: number): unknown {
    if (message.role === 'user') {
      return html`
        <div class="message message-user">
          <div class="message-content">${message.content}</div>
        </div>
      `;
    } else if (message.role === 'assistant') {
      return html`
        <div class="message message-assistant">
          <div class="message-content">${unsafeHTML(this.renderMarkdown(message.content))}</div>
        </div>
      `;
    } else if (message.role === 'system') {
      return html`
        <div class="message message-system">
          <div class="message-content">${message.content}</div>
        </div>
      `;
    } else if (message.role === 'tool') {
      return html`
        <div class="message message-tool">
          <div class="message-tool-header" @click=${() => this.toggleToolContent(`tool-${index}`)}>
            <span class="message-tool-name">🔧 ${message.tool_name || 'Tool'}</span>
            <span class="message-tool-status status-done">Done</span>
          </div>
          <div id="tool-content-tool-${index}" class="message-tool-content collapsed">
            ${message.content}
          </div>
        </div>
      `;
    }
    return null;
  }

  private renderToolCalls(): unknown {
    if (this.toolCalls.size === 0) return null;
    
    return Array.from(this.toolCalls.values()).map(tool => html`
      <div class="message message-tool">
        <div class="message-tool-header" @click=${() => this.toggleToolContent(tool.id)}>
          <span class="message-tool-name">🔧 ${tool.name}</span>
          <span class="message-tool-status ${tool.status === 'running' ? 'status-running' : 'status-done'}">
            ${tool.status === 'running' ? 'Running...' : 'Done'}
          </span>
        </div>
        <div id="tool-content-${tool.id}" class="message-tool-content ${tool.status === 'done' ? '' : 'collapsed'}">
          ${tool.result || 'Waiting for result...'}
        </div>
      </div>
    `);
  }

  render() {
    const hasMessages = this.messages.length > 0;

    return html`
      <div class="messages-container">
        ${!hasMessages && !this.isStreaming
          ? html`
              <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-title">Start a conversation</div>
                <div class="empty-state-desc">Send a message to begin chatting with Amicus AI assistant.</div>
              </div>
            `
          : html`
              ${this.messages.map((msg, i) => this.renderMessage(msg, i))}
              ${this.isStreaming && this.streamingContent
                ? html`
                    <div class="message message-assistant">
                      <div class="message-content">${unsafeHTML(this.renderMarkdown(this.streamingContent))}</div>
                    </div>
                  `
                : null}
              ${this.isStreaming && !this.streamingContent
                ? html`
                    <div class="loading-indicator">
                      <div class="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span>Thinking...</span>
                    </div>
                  `
                : null}
              ${this.renderToolCalls()}
            `}
        <div ${ref(this.messagesEndRef)}></div>
      </div>

      <div class="input-container">
        <div class="input-wrapper">
          <textarea
            ${ref(this.textareaRef)}
            .value=${this.inputValue}
            @input=${this.handleInput}
            @keydown=${this.handleKeyDown}
            placeholder="Send a message... (Enter to send, Shift+Enter for new line)"
            ?disabled=${this.isStreaming}
            rows="1"
          ></textarea>
        </div>
        <button
          class="send-button"
          @click=${this.sendMessage}
          ?disabled=${!this.inputValue.trim() || this.isStreaming}
        >
          ${this.isStreaming ? 'Sending...' : 'Send'}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-panel': ChatPanel;
  }
}
