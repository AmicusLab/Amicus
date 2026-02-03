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
  adminOAuthStart,
  adminOAuthPoll,
  adminOAuthCallback,
  adminOAuthDisconnect,
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
  @state() private searchQuery = '';

  // OAuth dialog state
  @state() private oauthDialog: {
    open: boolean;
    providerId: string;
    flowId: string;
    flowType: 'device_code' | 'pkce' | 'code_paste';
    userCode?: string;
    verificationUri?: string;
    authorizationUrl?: string;
    polling: boolean;
  } | null = null;

  // OAuth method selection state
  @state() private selectedOAuthMethod: Record<string, string> = {};

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
      if (res.success && res.data) {
        this.providers = res.data;
      }
      
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

  private async setDefaultProvider(id: string): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      const defaultModelsByProvider: Record<string, string> = {
        anthropic: 'claude-3-5-sonnet-20241022',
        openai: 'gpt-4-turbo',
        google: 'gemini-1.5-pro',
        groq: 'llama-3.3-70b-versatile',
        zai: 'glm-4.7',
        'zai-coding-plan': 'glm-4.7',
        'kimi-for-coding': 'kimi-for-coding',
        openrouter: 'openai/gpt-4-turbo',
        moonshot: 'moonshot-v1-128k',
        minimax: 'abab5.5-chat',
      };

      const defaultModelName = defaultModelsByProvider[id];
      if (!defaultModelName) {
        this.setMsg('error', `No default model configured for ${id}`);
        return;
      }

      const newDefaultModel = `${id}:${defaultModelName}`;
      await adminPatchConfig({
        llm: {
          defaultModel: newDefaultModel,
        },
      });

      this.currentDefaultModel = newDefaultModel;
      this.setMsg('ok', `Default provider set to ${id}`);
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Failed to set default provider');
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

  private async startOAuthFlow(providerId: string, methodId?: string): Promise<void> {
    console.log('[AdminPanel] startOAuthFlow:', { providerId, methodId });
    this.loading = true;
    this.message = null;
    try {
      const res = await adminOAuthStart(providerId, methodId);
      console.log('[AdminPanel] OAuth start response:', res);
      if (res.success && res.data) {
        if (res.data.flowType === 'device_code') {
          this.oauthDialog = {
            open: true,
            providerId,
            flowId: res.data.flowId,
            flowType: 'device_code',
            userCode: res.data.userCode,
            verificationUri: res.data.verificationUri,
            polling: false,
          };
          void this.pollOAuthFlow();
        } else if (res.data.flowType === 'pkce') {
          this.oauthDialog = {
            open: true,
            providerId,
            flowId: res.data.flowId,
            flowType: 'pkce',
            polling: false,
          };
          if (res.data.authorizationUrl) {
            const popup = window.open(res.data.authorizationUrl, '_blank', 'width=600,height=700');
            if (popup) {
              void this.listenForOAuthCallback(res.data.state ?? '');
            }
          }
        } else if (res.data.flowType === 'code_paste') {
          this.oauthDialog = {
            open: true,
            providerId,
            flowId: res.data.flowId,
            flowType: 'code_paste',
            authorizationUrl: res.data.authorizationUrl,
            polling: false,
          };
        }
      } else {
        this.setMsg('error', res.error?.message ?? 'OAuth start failed');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'OAuth start failed');
    } finally {
      this.loading = false;
    }
  }

  private async pollOAuthFlow(): Promise<void> {
    if (!this.oauthDialog) return;
    this.oauthDialog = { ...this.oauthDialog, polling: true };

    const { providerId, flowId } = this.oauthDialog;
    const maxAttempts = 60;
    let attempts = 0;

    while (this.oauthDialog?.open && attempts < maxAttempts) {
      try {
        const res = await adminOAuthPoll(providerId, flowId);
        if (res.success && res.data) {
          if (res.data.status === 'success') {
            this.oauthDialog = null;
            this.setMsg('ok', `Connected to ${providerId} via OAuth`);
            await this.loadTabData();
            return;
          }
          if (res.data.status === 'expired' || res.data.status === 'access_denied') {
            this.oauthDialog = null;
            this.setMsg('error', `OAuth ${res.data.status === 'expired' ? 'expired' : 'denied'}`);
            return;
          }
        }
      } catch {
      }
      attempts++;
      await new Promise((r) => setTimeout(r, 5000));
    }

    if (this.oauthDialog) {
      this.oauthDialog = null;
      this.setMsg('error', 'OAuth timeout');
    }
  }

  private closeOAuthDialog(): void {
    this.oauthDialog = null;
  }

  private async listenForOAuthCallback(expectedState: string): Promise<void> {
    const handleMessage = async (event: MessageEvent) => {
      console.log('[AdminPanel] postMessage received:', event.origin, event.data);
      
      const isLocalhost = event.origin.startsWith('http://localhost:') || 
                          event.origin.startsWith('http://127.0.0.1:');
      if (!isLocalhost) {
        console.log('[AdminPanel] Rejected: not localhost');
        return;
      }
      
      if (event.data?.type === 'oauth_success' && this.oauthDialog) {
        console.log('[AdminPanel] oauth_success received, state:', event.data.state);
        console.log('[AdminPanel] expectedState:', expectedState);
        const { state } = event.data;
        if (state !== expectedState) {
          this.setMsg('error', 'OAuth state mismatch');
          this.oauthDialog = null;
          return;
        }

        const { providerId } = this.oauthDialog;
        console.log('[AdminPanel] State validated, updating UI for provider:', providerId);
        this.oauthDialog = null;
        this.setMsg('ok', `Connected to ${providerId} via OAuth`);
        console.log('[AdminPanel] Loading tab data...');
        await this.loadTabData();
        console.log('[AdminPanel] Tab data loaded, OAuth complete');
        window.removeEventListener('message', handleMessage);
      } else if (event.data?.type === 'oauth_callback' && this.oauthDialog) {
        const { code, state } = event.data;
        if (state !== expectedState) {
          this.setMsg('error', 'OAuth state mismatch');
          this.oauthDialog = null;
          return;
        }

        const { providerId, flowId } = this.oauthDialog;
        try {
          const res = await adminOAuthCallback(providerId, flowId, code, state);
          if (res.success && res.data?.connected) {
            this.oauthDialog = null;
            this.setMsg('ok', `Connected to ${providerId} via OAuth`);
            await this.loadTabData();
          } else {
            this.setMsg('error', res.error?.message ?? 'OAuth callback failed');
            this.oauthDialog = null;
          }
        } catch (e) {
          this.setMsg('error', e instanceof Error ? e.message : 'OAuth callback failed');
          this.oauthDialog = null;
        }
        
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      if (this.oauthDialog?.flowType === 'pkce') {
        this.setMsg('error', 'OAuth timeout - no response from popup');
        this.oauthDialog = null;
      }
    }, 5 * 60 * 1000);
  }

  private pastedCode = '';

  private async submitPastedCode(): Promise<void> {
    if (!this.oauthDialog || this.oauthDialog.flowType !== 'code_paste') return;
    if (!this.pastedCode.trim()) {
      this.setMsg('error', 'Please enter the authorization code');
      return;
    }

    this.loading = true;
    try {
      const { providerId, flowId } = this.oauthDialog;
      const res = await adminOAuthCallback(providerId, flowId, this.pastedCode.trim(), '');
      if (res.success && res.data?.connected) {
        this.oauthDialog = null;
        this.pastedCode = '';
        this.setMsg('ok', `Connected to ${providerId} via OAuth`);
        await this.loadTabData();
      } else {
        this.setMsg('error', res.error?.message ?? 'OAuth callback failed');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'OAuth callback failed');
    } finally {
      this.loading = false;
    }
  }

  private async disconnectOAuth(providerId: string): Promise<void> {
    this.loading = true;
    this.message = null;
    try {
      const res = await adminOAuthDisconnect(providerId);
      if (res.success) {
        this.setMsg('ok', `Disconnected ${providerId} OAuth`);
        await this.loadTabData();
      } else {
        this.setMsg('error', res.error?.message ?? 'Disconnect failed');
      }
    } catch (e) {
      this.setMsg('error', e instanceof Error ? e.message : 'Disconnect failed');
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

  private isOAuthProvider(p: AdminProviderView): boolean {
    return p.authMethod === 'oauth' || p.authMethod === 'both';
  }

  private renderProviderCard(p: AdminProviderView) {
    const isOAuth = this.isOAuthProvider(p);
    const hasMultipleOAuthMethods = p.oauthMethods && p.oauthMethods.length > 1;
    
    return html`
      <div class="card ${p.error ? 'danger' : ''}">
        <div class="provider">
          <div class="provider-header">
            <strong>${p.id}</strong>
            <div class="provider-header-actions">
              ${p.available && !this.currentDefaultModel.startsWith(p.id + ':')
                ? html`<button
                    class="btn primary"
                    ?disabled=${this.loading}
                    @click=${() => void this.setDefaultProvider(p.id)}
                    title="Set as default provider"
                  >
                    Set as Default
                  </button>`
                : nothing
              }
              <button class="btn" ?disabled=${this.loading} @click=${() => void this.toggleProvider(p.id, !p.enabled)}>
                ${p.enabled ? 'Disable' : 'Enable'}
              </button>
              ${isOAuth && p.oauthStatus === 'connected'
                ? html`<button
                    class="btn danger"
                    ?disabled=${this.loading}
                    @click=${() => void this.disconnectOAuth(p.id)}
                    title="Disconnect OAuth"
                  >
                    Disconnect
                  </button>`
                : html`<button
                    class="btn danger"
                    ?disabled=${this.loading}
                    @click=${() => void this.unlinkProvider(p.id)}
                    title="Disable and delete persisted key"
                  >
                    Unlink
                  </button>`
              }
            </div>
          </div>
          
          <div class="provider-status">
            ${p.available 
              ? html`<span class="status-badge registered">✓ Connected</span>`
              : isOAuth
                ? html`<span class="status-badge not-registered">OAuth Required</span>`
                : html`<span class="status-badge not-registered">No API Key</span>`
            }
            ${this.currentDefaultModel.startsWith(p.id + ':')
              ? html`<span class="status-badge default">★ Default Provider</span>`
              : nothing
            }
            <span class="provider-meta">${p.modelCount} model${p.modelCount !== 1 ? 's' : ''}</span>
          </div>
          ${p.error ? html`<div class="provider-meta" style="color: #ff6a6a;">Error: ${p.error}</div>` : nothing}
          
          ${isOAuth
            ? html`<div class="provider-controls">
                ${hasMultipleOAuthMethods
                  ? html`
                      <select
                        style="min-width:200px;"
                        .value=${this.selectedOAuthMethod[p.id] || p.oauthMethods?.[0]?.id || ''}
                        @change=${(e: Event) => {
                          const select = e.target as HTMLSelectElement;
                          this.selectedOAuthMethod[p.id] = select.value;
                          console.log('[AdminPanel] OAuth method selected:', { providerId: p.id, methodId: select.value });
                        }}
                      >
                        ${p.oauthMethods?.map((method) => html`
                          <option value=${method.id}>${method.label}</option>
                        `)}
                      </select>
                      <button
                        class="btn primary"
                        ?disabled=${this.loading || p.available}
                        @click=${() => {
                          const methodId = this.selectedOAuthMethod[p.id] || p.oauthMethods?.[0]?.id;
                          console.log('[AdminPanel] Connect clicked:', { providerId: p.id, methodId, allMethods: p.oauthMethods });
                          void this.startOAuthFlow(p.id, methodId);
                        }}
                      >
                        ${p.available ? 'Connected' : 'Connect'}
                      </button>
                    `
                  : html`
                      <button
                        class="btn primary"
                        ?disabled=${this.loading || p.available}
                        @click=${() => void this.startOAuthFlow(p.id, p.oauthMethods?.[0]?.id)}
                      >
                        ${p.available ? 'Connected' : 'Connect with OAuth'}
                      </button>
                    `
                }
              </div>`
            : html`<div class="provider-controls">
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
              </div>`
          }
        </div>
      </div>
    `;
  }

  private renderOAuthDialog() {
    if (!this.oauthDialog?.open) return nothing;

    if (this.oauthDialog.flowType === 'device_code') {
      return html`
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;">
          <div class="card" style="max-width:400px;background:#111;">
            <h3 style="margin:0 0 1rem 0;">Connect to ${this.oauthDialog.providerId}</h3>
            <p>Step 1: Visit the link below</p>
            <div style="background:#0b0b0b;padding:0.5rem;border-radius:8px;margin:0.5rem 0;">
              <a href="${this.oauthDialog.verificationUri ?? '#'}" target="_blank" style="color:#6aa7ff;word-break:break-all;">
                ${this.oauthDialog.verificationUri}
              </a>
            </div>
            <p>Step 2: Enter this code</p>
            <div style="background:#0b0b0b;padding:1rem;border-radius:8px;text-align:center;font-size:1.5rem;font-family:monospace;letter-spacing:0.2em;">
              ${this.oauthDialog.userCode}
            </div>
            <div style="margin-top:1rem;text-align:center;color:#aaa;">
              ${this.oauthDialog.polling ? 'Waiting for authorization...' : ''}
            </div>
            <div style="margin-top:1rem;text-align:right;">
              <button class="btn" @click=${() => this.closeOAuthDialog()}>Cancel</button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.oauthDialog.flowType === 'pkce') {
      return html`
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;">
          <div class="card" style="max-width:400px;background:#111;">
            <h3 style="margin:0 0 1rem 0;">Connect to ${this.oauthDialog.providerId}</h3>
            <p style="text-align:center;">Opening browser for authorization...</p>
            <p style="text-align:center;color:#aaa;font-size:0.85rem;">If the popup was blocked, please allow popups for this site.</p>
            <div style="margin-top:1rem;text-align:center;color:#aaa;">
              Waiting for authorization...
            </div>
            <div style="margin-top:1rem;text-align:right;">
              <button class="btn" @click=${() => this.closeOAuthDialog()}>Cancel</button>
            </div>
          </div>
        </div>
      `;
    }

    if (this.oauthDialog.flowType === 'code_paste') {
      return html`
        <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;">
          <div class="card" style="max-width:500px;background:#111;">
            <h3 style="margin:0 0 1rem 0;">Connect to ${this.oauthDialog.providerId}</h3>
            <p>Step 1: Visit the authorization URL</p>
            <div style="background:#0b0b0b;padding:0.5rem;border-radius:8px;margin:0.5rem 0;">
              <a href="${this.oauthDialog.authorizationUrl ?? '#'}" target="_blank" style="color:#6aa7ff;word-break:break-all;">
                ${this.oauthDialog.authorizationUrl}
              </a>
            </div>
            <p>Step 2: Paste the authorization code below</p>
            <input
              type="text"
              placeholder="Enter authorization code"
              .value=${this.pastedCode}
              @input=${(e: InputEvent) => {
                this.pastedCode = (e.target as HTMLInputElement).value;
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  void this.submitPastedCode();
                }
              }}
              style="width:100%;margin:0.5rem 0;"
            />
            <div style="margin-top:1rem;display:flex;gap:0.5rem;justify-content:flex-end;">
              <button class="btn" @click=${() => this.closeOAuthDialog()}>Cancel</button>
              <button class="btn primary" ?disabled=${this.loading} @click=${() => void this.submitPastedCode()}>
                Connect
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return nothing;
  }

  private renderProviders() {
    const query = this.searchQuery.toLowerCase();
    const filtered = this.providers.filter((p) => p.id.toLowerCase().includes(query));
    
    const connected = filtered.filter((p) => p.available);
    const apiKeyProviders = filtered.filter((p) => !p.available && !this.isOAuthProvider(p));
    const oauthProviders = filtered.filter((p) => !p.available && this.isOAuthProvider(p));

    return html`
      <div style="margin-bottom:1rem;">
        <input
          type="text"
          placeholder="Search providers..."
          .value=${this.searchQuery}
          @input=${(e: InputEvent) => {
            this.searchQuery = (e.target as HTMLInputElement).value;
          }}
          style="width:100%;max-width:300px;"
        />
      </div>

      ${connected.length > 0 ? html`
        <h3 style="margin:1rem 0 0.5rem 0;font-size:0.9rem;color:#6aff6a;">Connected (${connected.length})</h3>
        <div class="grid">${connected.map((p) => this.renderProviderCard(p))}</div>
      ` : nothing}

      ${apiKeyProviders.length > 0 ? html`
        <h3 style="margin:1rem 0 0.5rem 0;font-size:0.9rem;color:#aaa;">API Key Providers (${apiKeyProviders.length})</h3>
        <div class="grid">${apiKeyProviders.map((p) => this.renderProviderCard(p))}</div>
      ` : nothing}

      ${oauthProviders.length > 0 ? html`
        <h3 style="margin:1rem 0 0.5rem 0;font-size:0.9rem;color:#ffa;">OAuth Providers (${oauthProviders.length})</h3>
        <div class="grid">${oauthProviders.map((p) => this.renderProviderCard(p))}</div>
      ` : nothing}

      ${this.renderOAuthDialog()}

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
