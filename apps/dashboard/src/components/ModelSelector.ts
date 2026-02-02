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

interface AdminProviderView {
  id: string;
  enabled: boolean;
  available: boolean;
  loaded: boolean;
  modelCount: number;
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

async function adminPatchConfig(patch: Record<string, unknown>): Promise<{ success: boolean; data?: Record<string, unknown>; error?: { message: string } }> {
  return fetchJSON('/admin/config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

async function adminListProviders(): Promise<{ success: boolean; data?: AdminProviderView[]; error?: { message: string } }> {
  return fetchJSON('/admin/providers');
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
      min-width: 180px;
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
      font-size: 1.1rem;
      margin-top: 0.25rem;
    }
  `;

  @state() private allModels: ModelWithAvailability[] = [];
  @state() private filteredModels: ModelWithAvailability[] = [];
  @state() private providers: AdminProviderView[] = [];
  @state() private selectedProviderId = '';
  @state() private selectedModelId = '';
  @state() private currentDefaultModel = '';
  @state() private loading = false;
  @state() private message: { kind: 'success' | 'error'; text: string } | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.loadCurrentDefaultModel();
    await this.loadProviders();
  }

  private setMsg(kind: 'success' | 'error', text: string) {
    this.message = { kind, text };
  }

  private async loadProviders(): Promise<void> {
    this.loading = true;
    try {
      const res = await adminListProviders();
      if (res.success && res.data) {
        this.providers = res.data.filter(p => p.enabled && p.available);
        await this.loadModels();
      } else {
        this.setMsg('error', res.error?.message ?? 'Failed to load providers');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Failed to load providers');
    } finally {
      this.loading = false;
    }
  }

  private async loadModels(): Promise<void> {
    if (this.providers.length === 0) {
      this.allModels = [];
      this.filteredModels = [];
      return;
    }

    this.loading = true;
    try {
      const allModels: ModelWithAvailability[] = [];
      for (const provider of this.providers) {
        const res = await getModels(provider.id);
        if (res.success && res.data) {
          allModels.push(...res.data.models);
        }
      }
      this.allModels = allModels;
      
      if (this.currentDefaultModel) {
        const [providerId, modelId] = this.currentDefaultModel.split(':');
        this.selectedProviderId = providerId;
        this.selectedModelId = modelId;
        this.filterModelsByProvider(providerId);
      } else if (this.providers.length > 0) {
        this.selectedProviderId = this.providers[0].id;
        this.filterModelsByProvider(this.providers[0].id);
        if (this.filteredModels.length > 0) {
          this.selectedModelId = this.filteredModels[0].id;
        }
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Failed to load models');
    } finally {
      this.loading = false;
    }
  }

  private filterModelsByProvider(providerId: string): void {
    if (!providerId) {
      this.filteredModels = [];
      return;
    }
    this.filteredModels = this.allModels.filter(m => m.provider === providerId);
  }

  private onProviderChange(providerId: string): void {
    this.selectedProviderId = providerId;
    this.filterModelsByProvider(providerId);
    
    if (this.filteredModels.length > 0) {
      this.selectedModelId = this.filteredModels[0].id;
    } else {
      this.selectedModelId = '';
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
    } catch (e) {
      console.error('[ModelSelector] Failed to load default model:', e);
    }
  }

  private async changeDefaultModel(): Promise<void> {
    if (!this.selectedProviderId || !this.selectedModelId) {
      this.setMsg('error', 'Please select provider and model');
      return;
    }

    this.loading = true;
    this.message = null;
    try {
      const newDefaultModel = `${this.selectedProviderId}:${this.selectedModelId}`;
      const res = await adminPatchConfig({ llm: { defaultModel: newDefaultModel } });
      if (res.success) {
        this.currentDefaultModel = newDefaultModel;
        this.setMsg('success', `Default model set to ${newDefaultModel}`);
      } else {
        this.setMsg('error', res.error?.message ?? 'Failed to set default model');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Failed to set default model');
    } finally {
      this.loading = false;
    }
  }

  render() {
    const [currentProvider, currentModel] = this.currentDefaultModel ? this.currentDefaultModel.split(':') : ['', ''];

    return html`
      <div class="card">
        <h3>Default Model</h3>
        
        ${this.providers.length === 0
          ? html`
            <p style="margin: 1rem 0; color: #ff6a6a; font-size: 0.9rem;">
              <strong>No providers registered.</strong> Go to <strong>Providers</strong> tab to add API keys.
            </p>
          `
          : html`
            <div class="current-model">
              <div class="current-model-label">Current Default</div>
              <div class="current-model-value">
                ${this.currentDefaultModel 
                  ? html`<span style="color: #6aa7ff;">${currentProvider}:<span style="color: #6aff6a;">${currentModel}</span></span>`
                  : html`<span style="color: #888;">Not set</span>`
                }
              </div>
            </div>

            <div style="margin-top: 1rem;">
              <p style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: #aaa;">
                Change default model
              </p>
              <div class="row row-inline">
                <div>
                  <p>Provider</p>
                  <select
                    .value="${this.selectedProviderId}"
                    @change="${(e: Event) => this.onProviderChange((e.target as HTMLSelectElement).value)}"
                    ?disabled="${this.loading}"
                  >
                    ${this.providers.map((p) => {
                      const isCurrent = currentProvider === p.id;
                      return html`<option value="${p.id}" ?selected="${this.selectedProviderId === p.id}">${p.id}${isCurrent ? ' ●' : ''}</option>`;
                    })}
                  </select>
                </div>
                
                <div>
                  <p>Model</p>
                  <select
                    .value="${this.selectedModelId}"
                    @change="${(e: Event) => { this.selectedModelId = (e.target as HTMLSelectElement).value; }}"
                    ?disabled="${this.loading || !this.selectedProviderId}"
                  >
                    ${this.filteredModels.length === 0
                      ? html`<option value="">No models</option>`
                      : this.filteredModels.map((m) => {
                          const isCurrent = currentModel === m.id;
                          return html`<option value="${m.id}" ?selected="${this.selectedModelId === m.id}">${m.name}${isCurrent ? ' ●' : ''}</option>`;
                        })
                    }
                  </select>
                </div>
                
                <button 
                  class="btn primary" 
                  ?disabled="${this.loading || !this.selectedProviderId || !this.selectedModelId}" 
                  @click="${() => void this.changeDefaultModel()}"
                  style="align-self: flex-end;"
                >
                  Set as Default
                </button>
              </div>
            </div>
          `
        }

        ${this.message
          ? html`<div class="msg ${this.message.kind}">${this.message.text}</div>`
          : nothing}
      </div>
    `;
  }
}
