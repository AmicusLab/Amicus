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

async function adminValidateModel(
  provider: string,
  id: string
): Promise<{ success: boolean; data?: ValidationResponse; error?: { message: string } }> {
  return fetchJSON(`/admin/models/${provider}/${id}/validate`, {
    method: 'POST',
  });
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
  @state() private providers: AdminProviderView[] = [];
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
        await this.validateCurrentDefaultModel();
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
      this.models = [];
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
      this.models = allModels;
      
      if (this.currentDefaultModel && !this.selectedModelId) {
        console.log('[ModelSelector] Auto-selecting current default model:', this.currentDefaultModel);
        this.selectedModelId = this.currentDefaultModel;
        this.requestUpdate();
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Failed to load models');
    } finally {
      this.loading = false;
    }
  }

  private async loadCurrentDefaultModel(): Promise<void> {
    try {
      console.log('[ModelSelector] Loading current default model...');
      const res = await fetchJSON<{ success: boolean; data?: Record<string, unknown>; error?: { message: string } }>('/admin/config');
      console.log('[ModelSelector] Config response:', res);
      if (res.success && res.data) {
        const llm = res.data['llm'] as Record<string, unknown> | undefined;
        const defaultModel = llm?.['defaultModel'] as string | undefined;
        console.log('[ModelSelector] Default model from config:', defaultModel);
        this.currentDefaultModel = defaultModel ?? '';
        console.log('[ModelSelector] Set currentDefaultModel to:', this.currentDefaultModel);
      }
    } catch (e) {
      console.error('[ModelSelector] Failed to load default model:', e);
    }
  }

  private async validateCurrentDefaultModel(): Promise<void> {
    if (!this.currentDefaultModel) return;

    const modelProviderId = this.currentDefaultModel.split(':')[0];
    const isProviderAvailable = this.providers.some(p => p.id === modelProviderId);

    if (!isProviderAvailable) {
      this.setMsg('error', `Current default model is unavailable (provider "${modelProviderId}" not registered). Please select a new default model.`);
      await adminPatchConfig({ llm: { defaultModel: null } });
      this.currentDefaultModel = '';
    }
  }

  private async changeDefaultModel(): Promise<void> {
    if (!this.selectedModelId) {
      this.setMsg('error', 'Please select a model first');
      return;
    }

    this.loading = true;
    this.message = null;
    try {
      console.log('[ModelSelector] Setting default model to:', this.selectedModelId);
      const res = await adminPatchConfig({ llm: { defaultModel: this.selectedModelId } });
      console.log('[ModelSelector] Config update response:', res);
      if (res.success) {
        this.currentDefaultModel = this.selectedModelId;
        this.setMsg('success', `Default model changed to ${this.selectedModelId}`);
        console.log('[ModelSelector] Current default model set to:', this.currentDefaultModel);
      } else {
        this.setMsg('error', res.error?.message ?? 'Failed to change default model');
      }
    } catch (e) {
      console.error('[ModelSelector] Failed to change default model:', e);
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

    const colonIndex = this.selectedModelId.indexOf(':');
    if (colonIndex === -1) {
      this.setMsg('error', 'Invalid model ID format (expected provider:model)');
      return;
    }

    const providerId = this.selectedModelId.slice(0, colonIndex);
    const modelId = this.selectedModelId.slice(colonIndex + 1);

    if (!providerId || !modelId) {
      this.setMsg('error', 'Invalid model ID format');
      return;
    }

    this.loading = true;
    this.message = null;
    try {
      console.log('[ModelSelector] Validating model:', { providerId, modelId, fullId: this.selectedModelId });
      const res = await adminValidateModel(providerId, modelId);
      console.log('[ModelSelector] Validation response:', res);
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
      console.error('[ModelSelector] Validation error:', e);
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
    const fullModelId = `${model.provider}:${model.id}`;
    const isDefault = fullModelId === this.currentDefaultModel;
    const isSelected = fullModelId === this.selectedModelId;
    return html`
      <option value="${fullModelId}" ?selected="${isSelected}">
        ${statusIcon} ${model.name} ${isDefault ? '(default)' : ''} - ${model.provider}
      </option>
    `;
  }

  render() {
    return html`
      <div class="card">
        <h3>Model Selection</h3>
        <p style="margin: 0 0 1rem 0; color: #aaa; font-size: 0.9rem;">
          Select the <strong>system-wide default model</strong> used for all LLM tasks unless overridden by specific task requirements.
          The model is selected based on task complexity, and this default serves as a fallback when no suitable model is found.
        </p>
        ${this.providers.length === 0
          ? html`
            <p style="margin: 0 0 1rem 0; color: #ff6a6a; font-size: 0.85rem;">
              <strong>Warning:</strong> No providers are registered. Go to <strong>Providers</strong> tab to add API keys.
            </p>
          `
          : html`
            <p style="margin: 0 0 1rem 0; color: #888; font-size: 0.85rem;">
              <strong>Note:</strong> Showing models from ${this.providers.length} registered provider${this.providers.length > 1 ? 's' : ''}: 
              <strong>${this.providers.map(p => p.id).join(', ')}</strong>
            </p>
          `
        }
        
        <div class="current-model">
          <div class="current-model-label">Current Default Model</div>
          <div class="current-model-value">
            ${this.currentDefaultModel 
              ? html`<span style="color: #6aa7ff;">${this.currentDefaultModel}</span>`
              : this.providers.length === 0
                ? html`<span style="color: #ff6a6a;">Not set - Add a provider first</span>`
                : html`<span style="color: #ffa;">Not set - Will be auto-configured when you add an API key</span>`
            }
          </div>
        </div>

        <div class="row row-inline">
          <div>
            <p>Select Model</p>
            <select
              @change="${(e: Event) => { this.selectedModelId = (e.target as HTMLSelectElement).value; }}"
              ?disabled="${this.loading}"
            >
              <option value="" ?selected="${!this.selectedModelId}">-- Select a model --</option>
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

        <div style="margin-top: 1rem; padding: 0.75rem; background: #1a1a1a; border-radius: 8px;">
          <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #ccc;">
            <strong>Model Validation</strong>
          </p>
          <p style="margin: 0 0 0.75rem 0; font-size: 0.85rem; color: #888;">
            Test if the selected model is accessible and working using the saved API key from the Providers tab.
          </p>
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
                const fullModelId = `${model.provider}:${model.id}`;
                const isDefault = fullModelId === this.currentDefaultModel;
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
