import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { thoughts } from '../state/signals.js';
import { subscribe } from '../api/websocket.js';

@customElement('thought-stream')
export class ThoughtStream extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 1rem;
    }
    .container {
      background: #1a1a1a;
      border-radius: 8px;
      border: 1px solid #333;
      height: 300px;
      overflow-y: auto;
    }
    .header {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #333;
      font-weight: 600;
      position: sticky;
      top: 0;
      background: #1a1a1a;
    }
    .log-entry {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #222;
      font-family: monospace;
      font-size: 0.875rem;
    }
    .log-entry:last-child {
      border-bottom: none;
    }
    .timestamp {
      color: #666;
      margin-right: 0.5rem;
    }
    .empty {
      padding: 2rem;
      text-align: center;
      color: #666;
    }
  `;

  @state() private _thoughts = thoughts.value;
  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = subscribe('thought:new', () => {
      this._thoughts = [...thoughts.value];
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
  }

  private _formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  render() {
    return html`
      <div class="container">
        <div class="header">Thought Stream</div>
        ${this._thoughts.length === 0
          ? html`<div class="empty">No thoughts yet...</div>`
          : this._thoughts.map((t: { content: string; timestamp: number }) => html`
              <div class="log-entry">
                <span class="timestamp">[${this._formatTime(t.timestamp)}]</span>
                ${t.content}
              </div>
            `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'thought-stream': ThoughtStream;
  }
}
