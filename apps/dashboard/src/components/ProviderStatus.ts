import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { llmProviders } from '../state/signals.js';
import { getProviders } from '../api/client.js';
import type { LLMProviderStatus } from '@amicus/types/dashboard';

@customElement('provider-status')
export class ProviderStatus extends LitElement {
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
    .status-warning { color: #fbbf24; }
    .status-disabled { color: #888; }
    .model-count {
      font-size: 0.75rem;
      color: #666;
      margin-top: 0.25rem;
    }
  `;

  @state() private _providers: LLMProviderStatus[] = [];

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
      const response = await getProviders();
      
      if (response.success && response.data) {
        const availableProviders = response.data.filter(p => p.available);
        llmProviders.value = availableProviders;
        this._providers = availableProviders;
      }
    } catch (e) {
      console.error('Failed to load providers:', e);
    }
  }

  private _getStatusIcon(provider: LLMProviderStatus): string {
    if (!provider.enabled) return '⚪';
    if (provider.available) return '✅';
    return '⚠️';
  }

  private _getStatusClass(provider: LLMProviderStatus): string {
    if (!provider.enabled) return 'status-disabled';
    if (provider.available) return 'status-healthy';
    return 'status-warning';
  }

  render() {
    return html`
      <div class="header">LLM Providers</div>
      <div class="grid">
        ${this._providers.map(provider => html`
          <div class="card">
            <div class="card-title">${provider.name}</div>
            <div class="card-value ${this._getStatusClass(provider)}">
              <span class="status-icon">${this._getStatusIcon(provider)}</span>
              <span>${provider.enabled ? (provider.available ? 'Available' : 'No API Key') : 'Disabled'}</span>
            </div>
            <div class="model-count">${provider.modelCount} model${provider.modelCount !== 1 ? 's' : ''}</div>
          </div>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'provider-status': ProviderStatus;
  }
}
