import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { APIResponse } from '@amicus/types/dashboard';
import type { ModelMetadata, ModelCapability } from '@amicus/types';

type ZaiModel = ModelMetadata & {
  healthy: boolean;
  lastChecked: number;
};

interface ZaiModelsResponse {
  provider: string;
  lastUpdated: number;
  models: ZaiModel[];
}

@customElement('zai-model-list')
export class ZaiModelList extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 1.5rem;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .title {
      font-size: 1.125rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.02em;
    }

    .refresh-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: linear-gradient(135deg, #ff006e 0%, #8338ec 100%);
      border: none;
      border-radius: 6px;
      color: #fff;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .refresh-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(255, 0, 110, 0.4);
    }

    .refresh-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .refresh-btn.spinning .icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }

    .card {
      background: linear-gradient(145deg, #0d0d0d 0%, #1a1a1a 100%);
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      padding: 1.25rem;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #ff006e, #8338ec, #3a86ff);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .card:hover {
      border-color: #3a3a3a;
      transform: translateY(-2px);
    }

    .card:hover::before {
      opacity: 1;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }

    .model-name {
      font-size: 0.875rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.01em;
    }

    .health-indicator {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.3);
    }

    .health-indicator.healthy {
      color: #4ade80;
    }

    .health-indicator.unhealthy {
      color: #f87171;
    }

    .health-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .model-description {
      font-size: 0.75rem;
      color: #888;
      line-height: 1.5;
      margin-bottom: 1rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .specs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .spec {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .spec-label {
      font-size: 0.625rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .spec-value {
      font-size: 0.75rem;
      color: #ccc;
      font-weight: 500;
    }

    .pricing {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      padding: 0.75rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }

    .price-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .price-label {
      font-size: 0.625rem;
      color: #666;
      text-transform: uppercase;
    }

    .price-value {
      font-size: 0.8125rem;
      color: #ff006e;
      font-weight: 700;
    }

    .capabilities {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .capability-tag {
      font-size: 0.625rem;
      font-weight: 600;
      color: #3a86ff;
      background: rgba(58, 134, 255, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border: 1px solid rgba(58, 134, 255, 0.2);
    }

    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 3rem;
      color: #666;
      font-size: 0.875rem;
    }

    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #333;
      border-top-color: #ff006e;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 0.75rem;
    }

    .error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: #f87171;
      text-align: center;
    }

    .error-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .error-message {
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: #666;
      text-align: center;
    }

    .empty-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      opacity: 0.5;
    }

    .last-updated {
      font-size: 0.625rem;
      color: #555;
      margin-top: 1rem;
      text-align: right;
    }
  `;

  @state() private _models: ZaiModel[] = [];
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _lastUpdated = 0;

  connectedCallback() {
    super.connectedCallback();
    this._loadData();
  }

  private async _loadData() {
    this._loading = true;
    this._error = null;

    try {
      const response = await fetch('/api/models/zai', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result: APIResponse<ZaiModelsResponse> = await response.json();

      if (result.success && result.data) {
        this._models = result.data.models;
        this._lastUpdated = result.data.lastUpdated;
      } else {
        this._error = result.error?.message || 'Failed to load models';
      }
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Unknown error';
      console.error('Failed to load z.ai models:', e);
    } finally {
      this._loading = false;
    }
  }

  private _formatContextWindow(tokens: number): string {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return String(tokens);
  }

  private _formatPrice(cost: number): string {
    if (cost === 0) return 'Free';
    return `$${cost.toFixed(2)}`;
  }

  private _formatCapability(cap: ModelCapability): string {
    const labels: Record<ModelCapability, string> = {
      text: 'Text',
      tools: 'Tools',
      streaming: 'Stream',
      thinking_mode: 'Think',
      vision: 'Vision',
    };
    return labels[cap] || cap;
  }

  private _formatTime(timestamp: number): string {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  render() {
    return html`
      <div class="header">
        <div class="title">z.ai Models</div>
        <button 
          class="refresh-btn ${this._loading ? 'spinning' : ''}" 
          @click=${this._loadData}
          ?disabled=${this._loading}
        >
          <span class="icon">↻</span>
          <span>${this._loading ? 'Loading...' : 'Refresh'}</span>
        </button>
      </div>

      ${this._renderContent()}

      ${this._lastUpdated ? html`
        <div class="last-updated">Last updated: ${this._formatTime(this._lastUpdated)}</div>
      ` : null}
    `;
  }

  private _renderContent() {
    if (this._loading && this._models.length === 0) {
      return html`
        <div class="loading">
          <div class="loading-spinner"></div>
          <span>Loading models...</span>
        </div>
      `;
    }

    if (this._error && this._models.length === 0) {
      return html`
        <div class="error">
          <div class="error-icon">⚠</div>
          <div class="error-message">${this._error}</div>
          <button class="refresh-btn" @click=${this._loadData}>Try Again</button>
        </div>
      `;
    }

    if (this._models.length === 0) {
      return html`
        <div class="empty">
          <div class="empty-icon">🤖</div>
          <div>No models available</div>
        </div>
      `;
    }

    return html`
      <div class="grid">
        ${this._models.map(model => html`
          <div class="card">
            <div class="card-header">
              <div class="model-name">${model.name}</div>
              <div class="health-indicator ${model.healthy ? 'healthy' : 'unhealthy'}">
                <div class="health-dot"></div>
                <span>${model.healthy ? 'Healthy' : 'Unhealthy'}</span>
              </div>
            </div>

            <div class="model-description">${model.description}</div>

            <div class="specs">
              <div class="spec">
                <div class="spec-label">Context Window</div>
                <div class="spec-value">${this._formatContextWindow(model.contextWindow)} tokens</div>
              </div>
              <div class="spec">
                <div class="spec-label">Max Output</div>
                <div class="spec-value">${this._formatContextWindow(model.maxOutputTokens)} tokens</div>
              </div>
            </div>

            <div class="pricing">
              <div class="price-item">
                <div class="price-label">Input / 1M</div>
                <div class="price-value">${this._formatPrice(model.inputCostPer1M)}</div>
              </div>
              <div class="price-item">
                <div class="price-label">Output / 1M</div>
                <div class="price-value">${this._formatPrice(model.outputCostPer1M)}</div>
              </div>
            </div>

            <div class="capabilities">
              ${model.capabilities.map(cap => html`
                <span class="capability-tag">${this._formatCapability(cap)}</span>
              `)}
            </div>
          </div>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zai-model-list': ZaiModelList;
  }
}
