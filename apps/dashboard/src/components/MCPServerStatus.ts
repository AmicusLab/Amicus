import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { mcpServers } from '../state/signals.js';
import { getMCPServers } from '../api/client.js';
import type { MCPServerStatus } from '@amicus/types/dashboard';

@customElement('mcp-server-status')
export class MCPServerStatusComponent extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 1rem;
    }
    .header {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #fff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .card {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 1rem;
      border: 1px solid #333;
    }
    .card-title {
      font-size: 0.75rem;
      color: #888;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }
    .card-value {
      font-size: 1rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .status-icon {
      font-size: 1.25rem;
    }
    .status-healthy { color: #4ade80; }
    .status-disabled { color: #888; }
    .tool-count {
      font-size: 0.75rem;
      color: #666;
      margin-top: 0.25rem;
    }
  `;

  @state() private _servers: MCPServerStatus[] = [];

  connectedCallback() {
    super.connectedCallback();
    this._loadData();
    
    const interval = setInterval(() => this._loadData(), 5000);
    this._cleanup = () => clearInterval(interval);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._cleanup?.();
  }

  private _cleanup?: () => void;

  private async _loadData() {
    try {
      const response = await getMCPServers();
      
      if (response.success && response.data) {
        mcpServers.value = response.data;
        this._servers = response.data;
      }
    } catch (e) {
      console.error('Failed to load MCP servers:', e);
    }
  }

  private _getStatusIcon(server: MCPServerStatus): string {
    if (server.connected) return '✅';
    return '⚪';
  }

  private _getStatusClass(server: MCPServerStatus): string {
    if (server.connected) return 'status-healthy';
    return 'status-disabled';
  }

  render() {
    return html`
      <div class="header">MCP Servers</div>
      <div class="grid">
        ${this._servers.map(server => html`
          <div class="card">
            <div class="card-title">${server.name}</div>
            <div class="card-value ${this._getStatusClass(server)}">
              <span class="status-icon">${this._getStatusIcon(server)}</span>
              <span>${server.connected ? 'Connected' : (server.enabled ? 'Disconnected' : 'Disabled')}</span>
            </div>
            <div class="tool-count">${server.toolCount} tool${server.toolCount !== 1 ? 's' : ''}</div>
          </div>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mcp-server-status': MCPServerStatusComponent;
  }
}
