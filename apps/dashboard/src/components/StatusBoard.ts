import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { systemHealth, healthStatus, uptime, tokenomics, totalCost } from '../state/signals.js';
import { getStatus, getTokenomics } from '../api/client.js';

@customElement('status-board')
export class StatusBoard extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 1rem;
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
      font-size: 1.5rem;
      font-weight: 600;
    }
    .status-healthy { color: #4ade80; }
    .status-degraded { color: #fbbf24; }
    .status-unhealthy { color: #ef4444; }
    .status-unknown { color: #888; }
  `;

  @state() private _health = systemHealth.value;

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
      const [statusRes, tokenRes] = await Promise.all([
        getStatus(),
        getTokenomics(),
      ]);
      
      if (statusRes.success && statusRes.data) {
        systemHealth.value = statusRes.data;
        this._health = statusRes.data;
      }
      if (tokenRes.success && tokenRes.data) {
        tokenomics.value = tokenRes.data;
      }
    } catch (e) {
      console.error('Failed to load status:', e);
    }
  }

  render() {
    const status = healthStatus.value;
    const uptimeStr = uptime.value;
    const cost = totalCost.value;
    const mem = this._health?.resources.memoryPercent.toFixed(1) ?? '0';
    
    return html`
      <div class="grid">
        <div class="card">
          <div class="card-title">System Status</div>
          <div class="card-value status-${status}">${status.toUpperCase()}</div>
        </div>
        <div class="card">
          <div class="card-title">Uptime</div>
          <div class="card-value">${uptimeStr}</div>
        </div>
        <div class="card">
          <div class="card-title">Memory</div>
          <div class="card-value">${mem}%</div>
        </div>
        <div class="card">
          <div class="card-title">Total Cost</div>
          <div class="card-value">$${cost}</div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'status-board': StatusBoard;
  }
}
