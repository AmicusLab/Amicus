import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  adminGetSession,
  adminPair,
  adminLogin,
  adminLogout,
  adminGetConfig,
  adminPatchConfig,
  adminReloadConfig,
  adminListProviders,
  adminSetProviderEnabled,
  adminSetProviderApiKey,
  adminUnlinkProvider,
  adminGetAudit,
  adminRenewPairing,
  adminSetPassword,
  type AdminProviderView,
} from '../api/client.js';

type AdminTab = 'providers' | 'config' | 'audit' | 'password';

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
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.75rem;
      align-items: start;
    }
    .provider-meta {
      font-size: 0.85rem;
      color: #aaa;
    }
    .provider-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: flex-end;
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
  @state() private safeConfig: Record<string, unknown> | null = null;
  @state() private audit: Array<{ timestamp: string; action: string; resource: string; result: string; message?: string }> = [];

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
    }
    if (this.tab === 'config') {
      const res = await adminGetConfig();
      if (res.success && res.data) this.safeConfig = res.data;
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
      this.safeConfig = null;
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
    this.loading = true;
    this.message = null;
    try {
      await adminSetProviderApiKey(id, apiKey);
      this.setMsg('ok', `API key updated for ${id}`);
      await this.loadTabData();
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Update failed');
    } finally {
      this.loading = false;
    }
  }

  private async unlinkProvider(id: string): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      await adminUnlinkProvider(id);
      this.setMsg('ok', `Provider ${id} unlinked`);
      await this.loadTabData();
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Unlink failed');
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

  private async patchConfig(patch: Record<string, unknown>): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      const res = await adminPatchConfig(patch);
      if (res.success) {
        this.safeConfig = res.data ?? null;
        this.setMsg('ok', 'Config updated');
      } else {
        this.setMsg('error', res.error?.message ?? 'Config update failed');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Config update failed');
    } finally {
      this.loading = false;
    }
  }

  private async reloadConfig(): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      await adminReloadConfig();
      this.setMsg('ok', 'Config reloaded');
      await this.loadTabData();
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Reload failed');
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
              <div>
                <div class="row">
                  <div>
                    <strong>${p.id}</strong>
                    <div class="provider-meta">
                      enabled: ${String(p.enabled)} | loaded: ${String(p.loaded)} | available: ${String(p.available)} | models: ${p.modelCount}
                    </div>
                    ${p.error ? html`<p class="provider-meta">error: ${p.error}</p>` : nothing}
                  </div>
                </div>
                <div class="row" style="margin-top:0.5rem;">
                  <input
                    type="password"
                    placeholder="set API key (not stored in browser)"
                    data-provider=${p.id}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === 'Enter') {
                        const el = e.target as HTMLInputElement;
                        const key = el.value;
                        if (key) {
                          el.value = '';
                          void this.setProviderKey(p.id, key);
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div class="provider-actions">
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
          </div>
        `)}
      </div>
    `;
  }

  private renderConfig() {
    const cfg = this.safeConfig;
    if (!cfg) return html`<p>Loading...</p>`;
    const llm = (cfg['llm'] as Record<string, unknown> | undefined) ?? {};
    const auth = (cfg['auth'] as Record<string, unknown> | undefined) ?? {};
    const dailyBudget = typeof llm['dailyBudget'] === 'number' ? String(llm['dailyBudget']) : '';
    const budgetAlertThreshold = typeof llm['budgetAlertThreshold'] === 'number' ? String(llm['budgetAlertThreshold']) : '';
    const defaultModel = typeof llm['defaultModel'] === 'string' ? llm['defaultModel'] : '';
    const authEnabled = typeof auth['enabled'] === 'boolean' ? auth['enabled'] : false;

    return html`
      <div class="card">
        <div class="row">
          <button class="btn" ?disabled=${this.loading} @click=${() => void this.reloadConfig()}>
            Reload from disk
          </button>
        </div>
      </div>

      <div class="card">
        <h2>LLM</h2>
        <div class="row">
          <div>
            <p>defaultModel</p>
            <input
              .value=${defaultModel}
              @change=${(e: Event) => {
                const value = (e.target as HTMLInputElement).value;
                void this.patchConfig({ llm: { defaultModel: value } });
              }}
            />
          </div>
          <div>
            <p>dailyBudget</p>
            <input
              .value=${dailyBudget}
              @change=${(e: Event) => {
                const value = Number((e.target as HTMLInputElement).value);
                if (Number.isFinite(value)) {
                  void this.patchConfig({ llm: { dailyBudget: value } });
                }
              }}
            />
          </div>
          <div>
            <p>budgetAlertThreshold</p>
            <input
              .value=${budgetAlertThreshold}
              @change=${(e: Event) => {
                const value = Number((e.target as HTMLInputElement).value);
                if (Number.isFinite(value)) {
                  void this.patchConfig({ llm: { budgetAlertThreshold: value } });
                }
              }}
            />
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Auth</h2>
        <div class="row">
          <p>auth.enabled: <strong>${String(authEnabled)}</strong></p>
          <button class="btn" ?disabled=${this.loading} @click=${() => void this.patchConfig({ auth: { enabled: !authEnabled } })}>
            Toggle
          </button>
        </div>
        <p>If enabled, API endpoints require either an admin session cookie or a Bearer API key.</p>
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
          <button class="tab ${this.tab === 'config' ? 'active' : ''}" @click=${() => void this.switchTab('config')}>Config</button>
          <button class="tab ${this.tab === 'audit' ? 'active' : ''}" @click=${() => void this.switchTab('audit')}>Audit</button>
          <button class="tab ${this.tab === 'password' ? 'active' : ''}" @click=${() => void this.switchTab('password')}>Password</button>
        </div>
      </div>

      ${this.tab === 'providers'
        ? this.renderProviders()
        : this.tab === 'config'
          ? this.renderConfig()
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
