import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { effect } from '@preact/signals-core';
import './StatusBoard.js';
import './ProviderStatus.js';
import './MCPServerStatus.js';
import './ThoughtStream.js';
import './ControlCenter.js';
import './AdminPanel.js';
import { activeView } from '../state/signals.js';

@customElement('amicus-app')
export class AmicusApp extends LitElement {
  private disposeViewEffect: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    // Lit doesn't automatically re-render on @preact/signals-core changes.
    // Bridge signal updates to Lit's render cycle.
    this.disposeViewEffect = effect(() => {
      void activeView.value;
      this.requestUpdate();
    });
  }

  disconnectedCallback(): void {
    this.disposeViewEffect?.();
    this.disposeViewEffect = null;
    super.disconnectedCallback();
  }

  static styles = css`
    :host {
      display: block;
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
    }
    .header {
      padding: 1rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid #333;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
    }
    .nav {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .nav button {
      border: 1px solid #333;
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      background: transparent;
      color: #e6e6e6;
      cursor: pointer;
    }
    .nav button.active {
      border-color: #6aa7ff;
      color: #6aa7ff;
    }
    .header h1 {
      font-size: 1.5rem;
      font-weight: 600;
    }
    .header p {
      color: #888;
      font-size: 0.875rem;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 768px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    const view = activeView.value;
    return html`
      <div class="header">
        <div>
          <h1>Amicus Dashboard</h1>
          <p>Local-First AI Assistant Control Panel</p>
        </div>
        <div class="nav">
          <button class=${view === 'dashboard' ? 'active' : ''} @click=${() => (activeView.value = 'dashboard')}>Dashboard</button>
          <button class=${view === 'admin' ? 'active' : ''} @click=${() => (activeView.value = 'admin')}>Admin</button>
        </div>
      </div>

      ${view === 'dashboard'
        ? html`
            <status-board></status-board>

            <provider-status></provider-status>
            <mcp-server-status></mcp-server-status>

            <div class="grid">
              <thought-stream></thought-stream>
              <control-center></control-center>
            </div>
          `
        : html`<admin-panel></admin-panel>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'amicus-app': AmicusApp;
  }
}
