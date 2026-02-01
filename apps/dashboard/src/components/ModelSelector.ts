import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ModelMetadata } from '@amicus/types';

interface ModelWithAvailability extends ModelMetadata {
  availability?: {
    id: string;
    healthy: boolean;
    lastChecked: number;
  };
}

interface ModelsResponse {
  provider: string;
  models: ModelWithAvailability[];
  count: number;
}

interface ValidationResponse {
  modelId: string;
  provider: string;
  valid: boolean;
  tokenCount?: number;
  error?: string;
}

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function getModels(provider: string): Promise<{ success: boolean; data?: ModelsResponse; error?: { message: string } }> {
  return fetchJSON(`/api/models/${provider}`);
}

async function adminValidateModel(
  provider: string,
  id: string,
  apiKey?: string
): Promise<{ success: boolean; data?: ValidationResponse; error?: { message: string } }> {
  const body = apiKey ? JSON.stringify({ apiKey }) : undefined;
  return fetchJSON(`/admin/models/${provider}/${id}/validate`, {
    method: 'POST',
    body,
  });
}

async function adminPatchConfig(patch: Record<string, unknown>): Promise<{ success: boolean; data?: Record<string, unknown>; error?: { message: string } }> {
  return fetchJSON('/admin/config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

@customElement('model-selector')
export class ModelSelector extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .card {
      border: 1px solid #333;
      border-radius: 12px;
      padding: 0.75rem;
      margin-top: 0.75rem;
    }
    .row {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
    }
    .row-inline {
      justify-content: flex-start;
      align-items: flex-end;
      gap: 0.5rem;
    }
    h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
    }
    p {
      margin: 0.25rem 0;
      color: #aaa;
      font-size: 0.9rem;
    }
    .btn {
      border: 1px solid #333;
      border-radius: 10px;
      padding: 0.5rem 0.75rem;
      background: #111;
      color: #e6e6e6;
      cursor: pointer;
      line-height: 1.2;
    }
    .btn.primary {
      border-color: #6aa7ff;
      color: #6aa7ff;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    select {
      border: 1px solid #333;
      border-radius: 10px;
      padding: 0.5rem 0.6rem;
      background: #0b0b0b;
      color: #e6e6e6;
      min-width: 220px;
      cursor: pointer;
    }
    select:focus {
      outline: none;
      border-color: #6aa7ff;
    }
    .msg {
      border: 1px solid #333;
      border-radius: 10px;
      padding: 0.5rem 0.75rem;
      margin-top: 0.75rem;
      color: #ddd;
      background: #0b0b0b;
    }
    .msg.error {
      border-color: #ff6a6a;
      color: #ffb3b3;
    }
    .msg.success {
      border-color: #6aff6a;
      color: #b3ffb3;
    }
    .model-meta {
      font-size: 0.85rem;
      color: #888;
    }
    .healthy {
      color: #6aff6a;
    }
    .unhealthy {
      color: #ff6a6a;
    }
    .model-option {
      padding: 0.5rem;
    }
    .current-model {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.75rem;
    }
    .current-model-label {
      font-size: 0.85rem;
      color: #888;
    }
    .current-model-value {
      font-weight: 600;
      color: #6aa7ff;
    }
    input {
      border: 1px solid #333;
      border-radius: 10px;
      padding: 0.5rem 0.6rem;
      background: #0b0b0b;
      color: #e6e6e6;
      min-width: 180px;
    }
    input:focus {
      outline: none;
      border-color: #6aa7ff;
    }
  `;

  @state() private models: ModelWithAvailability[] = [];
  @state() private selectedModelId = '';
  @state() private currentDefaultModel = '';
  @state() private loading = false;
  @state() private message: { kind: 'success' | 'error'; text: string } | null = null;
  @state() private apiKey = '';

  private readonly provider = 'zai';

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadModels();
    void this.loadCurrentDefaultModel();
  }

  private setMsg(kind: 'success' | 'error', text: string) {
    this.message = { kind, text };
  }

  private async loadModels(): Promise<void> {
    this.loading = true;
    try {
      const res = await getModels(this.provider);
      if (res.success && res.data) {
        this.models = res.data.models;
      } else {
        this.setMsg('error', res.error?.message ?? 'Failed to load models');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Failed to load models');
    } finally {
      this.loading = false;
    }
  }

  private async loadCurrentDefaultModel(): Promise<void> {
    try {
      const res = await fetchJSON<{ success: boolean; data?: Record<string, unknown>; error?: { message: string } }>('/admin/config');
      if (res.success && res.data) {
        const llm = res.data['llm'] as Record<string, unknown> | undefined;
        const defaultModel = llm?.['defaultModel'] as string | undefined;
        this.currentDefaultModel = defaultModel ?? '';
      }
    } catch {}
  }

  private async changeDefaultModel(): Promise<void> {
    if (!this.selectedModelId) {
      this.setMsg('error', 'Please select a model first');
      return;
    }

    this.loading = true;
    this.message = null;
    try {
      const res = await adminPatchConfig({ llm: { defaultModel: this.selectedModelId } });
      if (res.success) {
        this.currentDefaultModel = this.selectedModelId;
        this.setMsg('success', `Default model changed to ${this.selectedModelId}`);
      } else {
        this.setMsg('error', res.error?.message ?? 'Failed to change default model');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Failed to change default model');
    } finally {
      this.loading = false;
    }
  }

  private async validateModel(): Promise<void> {
    if (!this.selectedModelId) {
      this.setMsg('error', 'Please select a model first');
      return;
    }

    this.loading = true;
    this.message = null;
    try {
      const res = await adminValidateModel(this.provider, this.selectedModelId, this.apiKey || undefined);
      if (res.success && res.data) {
        if (res.data.valid) {
          this.setMsg('success', `Model ${res.data.modelId} is valid (tokens: ${res.data.tokenCount ?? 'N/A'})`);
        } else {
          this.setMsg('error', `Validation failed: ${res.data.error ?? 'Unknown error'}`);
        }
        await this.loadModels();
      } else {
        this.setMsg('error', res.error?.message ?? 'Validation failed');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Validation failed');
    } finally {
      this.loading = false;
    }
  }

  private getModelHealthStatus(model: ModelWithAvailability): 'healthy' | 'unhealthy' | 'unknown' {
    if (!model.availability) return 'unknown';
    return model.availability.healthy ? 'healthy' : 'unhealthy';
  }

  private renderModelOption(model: ModelWithAvailability) {
    const status = this.getModelHealthStatus(model);
    const statusIcon = status === 'healthy' ? '●' : status === 'unhealthy' ? '●' : '○';
    const isDefault = model.id === this.currentDefaultModel;
    return html`
      <option value="${model.id}">
        ${statusIcon} ${model.name} ${isDefault ? '(default)' : ''} - ${model.provider}
      </option>
    `;
  }

  render() {
    return html`
      <div class="card">
        <h3>Model Selection (${this.provider})</h3>
        
        <div class="current-model">
          <div class="current-model-label">Current Default Model</div>
          <div class="current-model-value">
            ${this.currentDefaultModel || 'Not set'}
          </div>
        </div>

        <div class="row row-inline">
          <div>
            <p>Select Model</p>
            <select
              .value="${this.selectedModelId}"
              @change="${(e: Event) => { this.selectedModelId = (e.target as HTMLSelectElement).value; }}"
              ?disabled="${this.loading}"
            >
              <option value="">-- Select a model --</option>
              ${this.models.map((model) => this.renderModelOption(model))}
            </select>
          </div>
          
          <button 
            class="btn primary" 
            ?disabled="${this.loading || !this.selectedModelId}" 
            @click="${() => void this.changeDefaultModel()}"
          >
            Set as Default
          </button>
        </div>

        <div class="row row-inline" style="margin-top: 0.75rem;">
          <div>
            <p>API Key (optional)</p>
            <input
              type="password"
              placeholder="API key for validation"
              .value="${this.apiKey}"
              @input="${(e: InputEvent) => { this.apiKey = (e.target as HTMLInputElement).value; }}"
              ?disabled="${this.loading}"
            />
          </div>
          
          <button 
            class="btn" 
            ?disabled="${this.loading || !this.selectedModelId}" 
            @click="${() => void this.validateModel()}"
          >
            Validate Model
          </button>
        </div>

        ${this.message
          ? html`<div class="msg ${this.message.kind}">${this.message.text}</div>`
          : nothing}
      </div>

      <div class="card">
        <h3>Available Models</h3>
        ${this.models.length === 0
          ? html`<p>No models available</p>`
          : html`
            <div style="display: grid; gap: 0.5rem;">
              ${this.models.map((model) => {
                const status = this.getModelHealthStatus(model);
                const isDefault = model.id === this.currentDefaultModel;
                return html`
                  <div 
                    style="
                      display: flex; 
                      justify-content: space-between; 
                      align-items: center;
                      padding: 0.5rem;
                      background: ${isDefault ? '#1a2a3a' : '#0b0b0b'};
                      border-radius: 8px;
                      border: ${isDefault ? '1px solid #6aa7ff' : '1px solid transparent'};
                    "
                  >
                    <div>
                      <div style="font-weight: 600;">
                        ${model.name}
                        ${isDefault ? html`<span style="color: #6aa7ff;"> (default)</span>` : ''}
                      </div>
                      <div class="model-meta">
                        ${model.id} | ${model.provider} | 
                        ${model.contextWindow.toLocaleString()} tokens | 
                        $${model.inputCostPer1M}/1M in
                      </div>
                    </div>
                    <div class="${status}">
                      ${status === 'healthy' ? '✓ Healthy' : status === 'unhealthy' ? '✗ Unhealthy' : '○ Unknown'}
                    </div>
                  </div>
                `;
              })}
            </div>
          `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'model-selector': ModelSelector;
  }
}
