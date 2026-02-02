import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  adminGetSession,
  adminPair,
  adminLogin,
  adminLogout,
  adminGetConfig,
  adminPatchConfig,
  adminListProviders,
  adminSetProviderEnabled,
  adminSetProviderApiKey,
  adminUnlinkProvider,
  adminGetAudit,
  adminRenewPairing,
  adminSetPassword,
  adminValidateProviderApiKey,
  adminTestProviderConnection,
  type AdminProviderView,
} from '../api/client.js';
import './ModelSelector.js';

type AdminTab = 'providers' | 'models' | 'audit' | 'password';

@customElement('admin-panel')
export class AdminPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 1rem;
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
    .tabs {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .tab {
      border: 1px solid #333;
      border-radius: 999px;
      padding: 0.35rem 0.75rem;
      background: transparent;
      color: #e6e6e6;
      cursor: pointer;
    }
    .tab.active {
      border-color: #6aa7ff;
      color: #6aa7ff;
    }
    h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.1rem;
    }
    p {
      margin: 0.25rem 0;
      color: #aaa;
    }
    .card {
      border: 1px solid #333;
      border-radius: 12px;
      padding: 0.75rem;
      margin-top: 0.75rem;
    }
    .danger {
      border-color: #7a2e2e;
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
    .btn.danger {
      border-color: #ff6a6a;
      color: #ff6a6a;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    input {
      border: 1px solid #333;
      border-radius: 10px;
      padding: 0.5rem 0.6rem;
      background: #0b0b0b;
      color: #e6e6e6;
      min-width: 220px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }
    .provider {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .provider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .provider-header-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .provider-meta {
      font-size: 0.85rem;
      color: #aaa;
      margin-top: -0.5rem;
    }
    .provider-status {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-top: 0.25rem;
      flex-wrap: wrap;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .status-badge.registered {
      background: #1a3a1a;
      color: #6aff6a;
      border: 1px solid #2a4a2a;
    }
    .status-badge.not-registered {
      background: #3a3a1a;
      color: #ffa;
      border: 1px solid #4a4a2a;
    }
    .status-badge.default {
      background: #1a2a3a;
      color: #6aa7ff;
      border: 1px solid #2a3a4a;
    }
    .provider-controls {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .provider-controls input {
      flex: 1;
      min-width: 200px;
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
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th, td {
      border-bottom: 1px solid #222;
      padding: 0.45rem 0.35rem;
      text-align: left;
    }
    th {
      color: #aaa;
      font-weight: 600;
    }
  `;

  @state() private authed = false;
  @state() private tab: AdminTab = 'providers';
  @state() private loading = false;
  @state() private message: { kind: 'ok' | 'error'; text: string } | null = null;

  // login inputs (not persisted)
  @state() private pairingCode = '';
  @state() private password = '';

  // password change inputs (not persisted)
  @state() private newPassword = '';
  @state() private confirmPassword = '';

  // data
  @state() private providers: AdminProviderView[] = [];
  @state() private audit: Array<{ timestamp: string; action: string; resource: string; result: string; message?: string }> = [];
  @state() private currentDefaultModel = '';
  @state() private dailyBudget = '';
  @state() private budgetAlertThreshold = '';

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  disconnectedCallback(): void {
    // Clear sensitive inputs when component is removed from DOM
    this.password = '';
    this.pairingCode = '';
    this.newPassword = '';
    this.confirmPassword = '';
    super.disconnectedCallback();
  }

  private setMsg(kind: 'ok' | 'error', text: string) {
    this.message = { kind, text };
  }

  private async refresh(): Promise<void> {
    this.loading = true;
    try {
      await adminGetSession();
      this.authed = true;
      if (this.authed) {
        await this.loadTabData();
      }
    } catch (e) {
      this.authed = false;
      this.setMsg('error', e instanceof Error ? e.message : 'Failed to refresh');
    } finally {
      this.loading = false;
    }
  }

  private async loadTabData(): Promise<void> {
    if (!this.authed) return;
    if (this.tab === 'providers') {
      const res = await adminListProviders();
      if (res.success && res.data) this.providers = res.data;
      
      const configRes = await adminGetConfig();
      if (configRes.success && configRes.data) {
        const llm = configRes.data['llm'] as Record<string, unknown> | undefined;
        const defaultModel = llm?.['defaultModel'] as string | undefined;
        this.currentDefaultModel = defaultModel ?? '';
        this.dailyBudget = typeof llm?.['dailyBudget'] === 'number' ? String(llm['dailyBudget']) : '';
        this.budgetAlertThreshold = typeof llm?.['budgetAlertThreshold'] === 'number' ? String(llm['budgetAlertThreshold']) : '';
      }
    }
    if (this.tab === 'audit') {
      const res = await adminGetAudit(50);
      if (res.success) {
        const data = res.data ?? [];
        this.audit = data.map((e) => ({
          timestamp: e.timestamp,
          action: e.action,
          resource: e.resource,
          result: e.result,
          ...(e.message ? { message: e.message } : {}),
        }));
      }
    }
  }

  private async doPair(): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      const res = await adminPair(this.pairingCode.trim());
      if (res.success) {
        this.authed = true;
        this.pairingCode = '';
        this.setMsg('ok', 'Paired successfully');
        await this.loadTabData();
      } else {
        this.setMsg('error', res.error?.message ?? 'Pairing failed');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Pairing failed');
    } finally {
      this.loading = false;
    }
  }

  private async doLogin(): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      const res = await adminLogin(this.password);
      if (res.success) {
        this.authed = true;
        this.password = '';
        this.setMsg('ok', 'Logged in successfully');
        await this.loadTabData();
      } else {
        this.setMsg('error', res.error?.message ?? 'Login failed');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Login failed');
    } finally {
      this.loading = false;
    }
  }

  private async doLogout(): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      await adminLogout();
      this.authed = false;
      this.providers = [];
      this.audit = [];
      this.setMsg('ok', 'Logged out');
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Logout failed');
    } finally {
      this.loading = false;
    }
  }

  private async toggleProvider(id: string, enabled: boolean): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      await adminSetProviderEnabled(id, enabled);
      this.setMsg('ok', `Provider ${id} ${enabled ? 'enabled' : 'disabled'}`);
      await this.loadTabData();
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Update failed');
    } finally {
      this.loading = false;
    }
  }

  private async setProviderKey(id: string, apiKey: string): Promise<void> {
    await adminSetProviderApiKey(id, apiKey);
    await this.loadTabData();
  }

  private async unlinkProvider(id: string): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      const wasDefaultProvider = this.currentDefaultModel.startsWith(id + ':');
      
      await adminUnlinkProvider(id);
      
      if (wasDefaultProvider) {
        await adminPatchConfig({ llm: { defaultModel: null } });
        this.currentDefaultModel = '';
        this.setMsg('ok', `Provider ${id} unlinked. Default model cleared because it belonged to this provider.`);
      } else {
        this.setMsg('ok', `Provider ${id} unlinked`);
      }
      
      await this.loadTabData();
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Unlink failed');
    } finally {
      this.loading = false;
    }
  }

  private async validateAndSaveProviderKey(id: string, apiKey: string): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      const res = await adminValidateProviderApiKey(id, apiKey);
      if (res.success && res.data) {
        if (res.data.valid) {
          await this.setProviderKey(id, apiKey);
          this.setMsg('ok', `API key for ${id} validated and saved successfully`);
        } else {
          this.setMsg('error', `API key validation failed: ${res.data.error ?? 'Unknown error'}`);
        }
      } else {
        this.setMsg('error', res.error?.message ?? 'Validation failed');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Validation failed');
    } finally {
      this.loading = false;
    }
  }

  private async testProviderConnection(id: string): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      const res = await adminTestProviderConnection(id);
      if (res.success && res.data) {
        if (res.data.valid) {
          this.setMsg('ok', `Connection to ${id} successful`);
        } else {
          this.setMsg('error', `Connection test failed: ${res.data.error ?? 'Unknown error'}`);
        }
      } else {
        this.setMsg('error', res.error?.message ?? 'Connection test failed');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Connection test failed');
    } finally {
      this.loading = false;
    }
  }

  private async setPassword(): Promise<void> {
    if (!this.newPassword || this.newPassword.length < 8) {
      this.setMsg('error', 'Password must be at least 8 characters');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.setMsg('error', 'Passwords do not match');
      return;
    }

    this.loading = true;
    this.message = null;
    try {
      await adminSetPassword(this.newPassword);
      this.setMsg('ok', 'Password updated successfully. Use it for next login.');
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Password update failed');
    } finally {
      this.loading = false;
    }
  }

  private async updateBudgetSettings(): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      const dailyBudgetNum = this.dailyBudget ? Number(this.dailyBudget) : undefined;
      const budgetAlertThresholdNum = this.budgetAlertThreshold ? Number(this.budgetAlertThreshold) : undefined;

      if (dailyBudgetNum !== undefined && (isNaN(dailyBudgetNum) || dailyBudgetNum < 0)) {
        this.setMsg('error', 'Daily budget must be a positive number');
        return;
      }

      if (budgetAlertThresholdNum !== undefined && (isNaN(budgetAlertThresholdNum) || budgetAlertThresholdNum < 0)) {
        this.setMsg('error', 'Alert threshold must be a positive number');
        return;
      }

      const patch: Record<string, unknown> = {
        llm: {
          ...(dailyBudgetNum !== undefined && { dailyBudget: dailyBudgetNum }),
          ...(budgetAlertThresholdNum !== undefined && { budgetAlertThreshold: budgetAlertThresholdNum }),
        },
      };

      const res = await adminPatchConfig(patch);
      if (res.success) {
        this.setMsg('ok', 'Budget settings updated');
        await this.loadTabData();
      } else {
        this.setMsg('error', res.error?.message ?? 'Budget update failed');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Budget update failed');
    } finally {
      this.loading = false;
    }
  }



  private renderLogin() {
    return html`
      <h2>Admin</h2>
      <p>Pair using the code printed in the daemon logs, or login with password (if enabled).</p>

      <div class="card">
        <div class="row">
          <div>
            <p><strong>Pairing code</strong></p>
            <input
              placeholder="pairing code"
              .value=${this.pairingCode}
              @input=${(e: InputEvent) => {
                this.pairingCode = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
          <button class="btn primary" ?disabled=${this.loading} @click=${() => void this.doPair()}>
            Pair
          </button>
        </div>
      </div>

      <div class="card">
        <div class="row row-inline">
          <div>
            <p><strong>Password login (optional)</strong></p>
            <input
              type="password"
              placeholder="admin password"
              .value=${this.password}
              @input=${(e: InputEvent) => {
                this.password = (e.target as HTMLInputElement).value;
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  void this.doLogin();
                }
              }}
            />
          </div>
          <button class="btn" ?disabled=${this.loading} @click=${() => void this.doLogin()}>
            Login
          </button>
        </div>
      </div>
    `;
  }

  private renderProviders() {
    return html`
      <div class="grid">
        ${this.providers.map((p) => html`
          <div class="card ${p.error ? 'danger' : ''}">
            <div class="provider">
              <div class="provider-header">
                <strong>${p.id}</strong>
                <div class="provider-header-actions">
                  <button class="btn" ?disabled=${this.loading} @click=${() => void this.toggleProvider(p.id, !p.enabled)}>
                    ${p.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    class="btn danger"
                    ?disabled=${this.loading}
                    @click=${() => void this.unlinkProvider(p.id)}
                    title="Disable and delete persisted key"
                  >
                    Unlink
                  </button>
                </div>
              </div>
              
              <div class="provider-status">
                ${p.available 
                  ? html`<span class="status-badge registered">✓ Registered</span>`
                  : html`<span class="status-badge not-registered">No API Key</span>`
                }
                ${this.currentDefaultModel.startsWith(p.id + ':')
                  ? html`<span class="status-badge default">★ Default Provider</span>`
                  : nothing
                }
                <span class="provider-meta">${p.modelCount} model${p.modelCount !== 1 ? 's' : ''}</span>
              </div>
              ${p.error ? html`<div class="provider-meta" style="color: #ff6a6a;">Error: ${p.error}</div>` : nothing}
              
              <div class="provider-controls">
                <input
                  type="password"
                  placeholder="Enter API key"
                  data-provider=${p.id}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                      const el = e.target as HTMLInputElement;
                      const key = el.value;
                      if (key) {
                        void this.validateAndSaveProviderKey(p.id, key).then(() => {
                          el.value = '';
                        });
                      }
                    }
                  }}
                />
                <button
                  class="btn primary"
                  ?disabled=${this.loading}
                  @click=${(e: Event) => {
                    const input = (e.target as HTMLElement).parentElement?.querySelector('input') as HTMLInputElement;
                    const key = input?.value ?? '';
                    if (key) {
                      void this.validateAndSaveProviderKey(p.id, key).then(() => {
                        if (input) input.value = '';
                      });
                    } else {
                      this.setMsg('error', 'Please enter an API key');
                    }
                  }}
                >
                  Validate & Save
                </button>
                <button
                  class="btn"
                  ?disabled=${this.loading}
                  @click=${() => void this.testProviderConnection(p.id)}
                >
                  Test
                </button>
              </div>
            </div>
          </div>
        `)}
      </div>

      <div class="card" style="margin-top: 1rem;">
        <h3 style="margin: 0 0 0.75rem 0; font-size: 1rem;">Usage & Budget</h3>
        <p style="font-size: 0.85rem; margin-bottom: 1rem;">Configure daily token budget and alert thresholds for cost management.</p>
        <div class="row">
          <div>
            <p><strong>Daily Budget (tokens)</strong></p>
            <input
              type="number"
              placeholder="e.g., 1000000"
              .value=${this.dailyBudget}
              @input=${(e: InputEvent) => {
                this.dailyBudget = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
          <div>
            <p><strong>Alert Threshold (tokens)</strong></p>
            <input
              type="number"
              placeholder="e.g., 800000"
              .value=${this.budgetAlertThreshold}
              @input=${(e: InputEvent) => {
                this.budgetAlertThreshold = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
          <button 
            class="btn primary" 
            ?disabled=${this.loading}
            @click=${() => void this.updateBudgetSettings()}
          >
            Save Budget
          </button>
        </div>
      </div>
    `;
  }



  private renderAudit() {
    return html`
      <div class="card">
        <div class="row">
          <button class="btn" ?disabled=${this.loading} @click=${() => void this.loadTabData()}>
            Refresh
          </button>
        </div>
      </div>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>time</th>
              <th>action</th>
              <th>resource</th>
              <th>result</th>
              <th>message</th>
            </tr>
          </thead>
          <tbody>
            ${this.audit.map((e) => html`
              <tr>
                <td>${e.timestamp}</td>
                <td>${e.action}</td>
                <td>${e.resource}</td>
                <td>${e.result}</td>
                <td>${e.message ?? ''}</td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderPassword() {
    return html`
      <div class="card">
        <h3>Change Admin Password</h3>
        <div class="row">
          <div>
            <p><strong>New Password</strong></p>
            <input
              type="password"
              placeholder="at least 8 characters"
              .value=${this.newPassword}
              @input=${(e: InputEvent) => {
                this.newPassword = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        </div>
        <div class="row" style="margin-top:0.5rem;">
          <div>
            <p><strong>Confirm Password</strong></p>
            <input
              type="password"
              placeholder="re-enter password"
              .value=${this.confirmPassword}
              @input=${(e: InputEvent) => {
                this.confirmPassword = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        </div>
        <div class="row" style="margin-top:1rem;">
          <button class="btn primary" ?disabled=${this.loading} @click=${() => void this.setPassword()}>
            Save Password
          </button>
        </div>
      </div>
    `;
  }

  private renderModels() {
    return html`<model-selector></model-selector>`;
  }

  private renderAuthed() {
    return html`
      <div class="row">
        <h2>Admin</h2>
        <div class="row">
          <button class="btn" ?disabled=${this.loading} @click=${() => void this.renewPairing()} title="Generate a new pairing code without restarting the daemon">
            New pairing code
          </button>
          <button class="btn" ?disabled=${this.loading} @click=${() => void this.doLogout()}>Logout</button>
        </div>
      </div>

      <div class="row" style="margin-top:0.5rem;">
        <div class="tabs">
          <button class="tab ${this.tab === 'providers' ? 'active' : ''}" @click=${() => void this.switchTab('providers')}>Providers</button>
          <button class="tab ${this.tab === 'models' ? 'active' : ''}" @click=${() => void this.switchTab('models')}>Models</button>
          <button class="tab ${this.tab === 'audit' ? 'active' : ''}" @click=${() => void this.switchTab('audit')}>Audit</button>
          <button class="tab ${this.tab === 'password' ? 'active' : ''}" @click=${() => void this.switchTab('password')}>Password</button>
        </div>
      </div>

      ${this.tab === 'providers'
        ? this.renderProviders()
        : this.tab === 'models'
          ? this.renderModels()
          : this.tab === 'audit'
            ? this.renderAudit()
            : this.renderPassword()}
    `;
  }

  private async renewPairing(): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      const res = await adminRenewPairing();
      if (res.success && res.data) {
        this.setMsg('ok', `New pairing code: ${res.data.code} (expires ${new Date(res.data.expiresAtMs).toISOString()})`);
      } else {
        this.setMsg('error', res.error?.message ?? 'Pairing renew failed');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Pairing renew failed');
    } finally {
      this.loading = false;
    }
  }

  private async switchTab(next: AdminTab): Promise<void> {
    this.tab = next;
    this.message = null;
    this.loading = true;
    try {
      await this.loadTabData();
    } finally {
      this.loading = false;
    }
  }

  render() {
    return html`
      ${this.authed ? this.renderAuthed() : this.renderLogin()}
      ${this.message
        ? html`<div class="msg ${this.message.kind === 'error' ? 'error' : ''}">${this.message.text}</div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'admin-panel': AdminPanel;
  }
}
