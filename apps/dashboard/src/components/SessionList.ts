/**
 * SessionList Component
 * 
 * Displays a list of chat sessions with create, select, and delete functionality.
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ChatSession } from '@amicus/types';

@customElement('session-list')
export class SessionList extends LitElement {
  @state() private sessions: ChatSession[] = [];
  @state() private selectedId: string | null = null;
  @state() private loading = false;

  connectedCallback(): void {
    super.connectedCallback();
    this.loadSessions();
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #1a1a2e;
      border-radius: 8px;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      background: #16162a;
      border-bottom: 1px solid #333;
    }

    .header-title {
      font-size: 1rem;
      font-weight: 600;
      color: #e6e6e6;
    }

    .create-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #6aa7ff;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .create-btn:hover {
      background: #5a97ef;
    }

    .sessions-container {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
    }

    .session-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      margin-bottom: 0.25rem;
      background: #2a2a4a;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }

    .session-item:hover {
      background: #3a3a5a;
    }

    .session-item.selected {
      background: #4a4a6a;
      border: 1px solid #6aa7ff;
    }

    .session-info {
      flex: 1;
      min-width: 0;
    }

    .session-title {
      font-size: 0.9375rem;
      font-weight: 500;
      color: #e6e6e6;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .session-meta {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: #888;
    }

    .session-count {
      color: #6aa7ff;
    }

    .session-date {
      color: #666;
    }

    .delete-btn {
      padding: 0.25rem 0.5rem;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: #888;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s, color 0.2s;
    }

    .session-item:hover .delete-btn {
      opacity: 1;
    }

    .delete-btn:hover {
      color: #ff6b6b;
      background: rgba(255, 107, 107, 0.1);
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
      font-size: 1.125rem;
      color: #888;
      margin-bottom: 0.5rem;
    }

    .empty-state-desc {
      font-size: 0.875rem;
    }

    .loading-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: #888;
    }

    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #333;
      border-top-color: #6aa7ff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 0.75rem;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  /**
   * Format message count with plural handling
   */
  private formatMessageCount(count: number): string {
    return `${count} message${count !== 1 ? 's' : ''}`;
  }

  /**
   * Format date for display
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Check if session is selected
   */
  private isSelected(id: string): boolean {
    return this.selectedId === id;
  }

  /**
   * Handle session selection
   */
  private handleSelect(session: ChatSession): void {
    this.selectedId = session.id;
    this.dispatchEvent(new CustomEvent('session-selected', {
      detail: { id: session.id, session },
      bubbles: true,
      composed: true,
    }));
  }

  /**
   * Handle session deletion
   */
  private handleDelete(session: ChatSession): void {
    this.dispatchEvent(new CustomEvent('session-delete', {
      detail: { id: session.id, session },
      bubbles: true,
      composed: true,
    }));
  }

  /**
   * Handle create new session
   */
  private handleCreate(): void {
    this.dispatchEvent(new CustomEvent('session-create', {
      bubbles: true,
      composed: true,
    }));
  }

  /**
   * Public method to load sessions
   */
  async loadSessions(): Promise<void> {
    this.loading = true;
    try {
      const response = await fetch('/api/chat/sessions');
      if (response.ok) {
        this.sessions = await response.json();
      } else {
        console.error('Failed to load sessions:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Public method to set sessions directly
   */
  setSessions(sessions: ChatSession[]): void {
    this.sessions = sessions;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading-indicator">
          <div class="loading-spinner"></div>
          <span>Loading sessions...</span>
        </div>
      `;
    }

    return html`
      <div class="header">
        <span class="header-title">Chats</span>
        <button class="create-btn" @click=${this.handleCreate}>
          <span>+</span>
          <span>New</span>
        </button>
      </div>

      <div class="sessions-container">
        ${this.sessions.length === 0
          ? html`
              <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-title">No conversations yet</div>
                <div class="empty-state-desc">Start a new chat to begin</div>
              </div>
            `
          : this.sessions.map(
              (session) => html`
                <div
                  class="session-item ${this.isSelected(session.id) ? 'selected' : ''}"
                  role="button"
                  tabindex="0"
                  @click=${() => this.handleSelect(session)}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      this.handleSelect(session);
                    }
                  }}
                >
                  <div class="session-info">
                    <div class="session-title">${session.title}</div>
                    <div class="session-meta">
                      <span class="session-count">${this.formatMessageCount(session.messageCount)}</span>
                      <span class="session-date">${this.formatDate(session.updatedAt)}</span>
                    </div>
                  </div>
                  <button
                    class="delete-btn"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this.handleDelete(session);
                    }}
                    title="Delete session"
                    aria-label="Delete session"
                  >
                    🗑️
                  </button>
                </div>
              `
            )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-list': SessionList;
  }
}
