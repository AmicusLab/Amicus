import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type {
  DeviceCodeFlowConfig,
  PKCEFlowConfig,
  CodePasteFlowConfig,
  DeviceCodeResponse,
  OAuthTokenResponse,
  OAuthPollResult,
  OAuthCredential,
} from '@amicus/types';

export class DeviceCodeFlow {
  constructor(private config: DeviceCodeFlowConfig) {}

  async start(): Promise<DeviceCodeResponse> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      scope: this.config.scope ?? '',
    });

    const res = await fetch(this.config.deviceCodeUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Device code request failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const result: DeviceCodeResponse = {
      deviceCode: String(json.device_code ?? ''),
      userCode: String(json.user_code ?? ''),
      verificationUri: String(json.verification_uri ?? ''),
      expiresIn: Number(json.expires_in ?? 900),
      interval: Number(json.interval ?? 5),
    };
    if (json.verification_uri_complete) {
      result.verificationUriComplete = String(json.verification_uri_complete);
    }
    return result;
  }

  async poll(deviceCode: string): Promise<OAuthPollResult> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok && res.status !== 400) {
      throw new Error(`Token poll failed: ${res.status}`);
    }

    const json = (await res.json()) as Record<string, unknown>;

    if (json.access_token) {
      const tokens: OAuthTokenResponse = {
        accessToken: String(json.access_token),
        tokenType: String(json.token_type ?? 'Bearer'),
      };
      if (json.expires_in != null) tokens.expiresIn = Number(json.expires_in);
      if (json.refresh_token) tokens.refreshToken = String(json.refresh_token);
      if (json.scope) tokens.scope = String(json.scope);
      return { status: 'success', tokens };
    }

    const error = String(json.error ?? '');
    switch (error) {
      case 'authorization_pending':
        return { status: 'pending' };
      case 'slow_down':
        return { status: 'slow_down', interval: Number(json.interval ?? 10) };
      case 'expired_token':
        return { status: 'expired' };
      case 'access_denied':
        return { status: 'access_denied' };
      default:
        throw new Error(`OAuth error: ${error} - ${json.error_description ?? ''}`);
    }
  }

  async refresh(refreshToken: string): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Token refresh failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const result: OAuthTokenResponse = {
      accessToken: String(json.access_token ?? ''),
      tokenType: String(json.token_type ?? 'Bearer'),
    };
    if (json.expires_in != null) result.expiresIn = Number(json.expires_in);
    if (json.refresh_token) result.refreshToken = String(json.refresh_token);
    if (json.scope) result.scope = String(json.scope);
    return result;
  }

  async pollUntilComplete(
    deviceCode: string,
    opts: { expiresIn: number; interval: number; onPoll?: () => void }
  ): Promise<OAuthCredential> {
    const expiresAt = Date.now() + opts.expiresIn * 1000;
    let intervalMs = opts.interval * 1000;

    while (Date.now() < expiresAt) {
      opts.onPoll?.();
      const result = await this.poll(deviceCode);

      if (result.status === 'success') {
        let accessToken = result.tokens.accessToken;

        if (this.config.copilotTokenUrl) {
          accessToken = await this.getCopilotToken(accessToken);
        }

        const cred: OAuthCredential = {
          type: 'oauth',
          accessToken,
        };
        if (result.tokens.refreshToken) cred.refreshToken = result.tokens.refreshToken;
        if (result.tokens.tokenType) cred.tokenType = result.tokens.tokenType;
        if (result.tokens.scope) cred.scope = result.tokens.scope;
        if (result.tokens.expiresIn) {
          cred.expiresAt = Date.now() + result.tokens.expiresIn * 1000;
        }
        return cred;
      }

      if (result.status === 'slow_down') {
        intervalMs = result.interval * 1000;
      } else if (result.status === 'expired') {
        throw new Error('Device code expired');
      } else if (result.status === 'access_denied') {
        throw new Error('Authorization denied by user');
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error('Device code expired');
  }

  private async getCopilotToken(githubToken: string): Promise<string> {
    if (!this.config.copilotTokenUrl) {
      throw new Error('Copilot token URL not configured');
    }

    const res = await fetch(this.config.copilotTokenUrl, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Copilot token request failed: ${res.status}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    return String(json.token ?? '');
  }
}

export class PKCEFlow {
  private verifier: string = '';
  private challenge: string = '';

  constructor(private config: PKCEFlowConfig) {}

  generateAuthUrl(): { url: string; state: string } {
    this.verifier = randomBytes(32).toString('hex');
    this.challenge = createHash('sha256').update(this.verifier).digest('base64url');

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.callbackUrl,
      scope: this.config.scope ?? '',
      code_challenge: this.challenge,
      code_challenge_method: 'S256',
      state: this.verifier,
      id_token_add_organizations: 'true',
      codex_cli_simplified_flow: 'true',
      originator: 'amicus',
    });
    
    console.log('[PKCEFlow] Generated auth URL params:', {
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      scope: this.config.scope,
      code_challenge_method: 'S256',
      state_length: this.verifier.length,
      challenge_length: this.challenge.length,
    });

    return {
      url: `${this.config.authorizationUrl}?${params.toString()}`,
      state: this.verifier,
    };
  }

  async exchangeCode(code: string, state: string): Promise<OAuthCredential> {
    if (state !== this.verifier) {
      throw new Error('OAuth state mismatch');
    }

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.config.callbackUrl,
      code_verifier: this.verifier,
    });

    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Token exchange failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const cred: OAuthCredential = {
      type: 'oauth',
      accessToken: String(json.access_token ?? ''),
    };
    if (json.refresh_token) cred.refreshToken = String(json.refresh_token);
    if (json.token_type) cred.tokenType = String(json.token_type);
    if (json.scope) cred.scope = String(json.scope);
    if (json.expires_in) {
      cred.expiresAt = Date.now() + Number(json.expires_in) * 1000;
    }
    return cred;
  }

  async refresh(refreshToken: string): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Token refresh failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const result: OAuthTokenResponse = {
      accessToken: String(json.access_token ?? ''),
      tokenType: String(json.token_type ?? 'Bearer'),
    };
    if (json.expires_in != null) result.expiresIn = Number(json.expires_in);
    if (json.refresh_token) result.refreshToken = String(json.refresh_token);
    if (json.scope) result.scope = String(json.scope);
    return result;
  }

  startCallbackServer(opts: {
    expectedState: string;
    timeoutMs: number;
  }): Promise<{ code: string; state: string }> {
    return new Promise((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout> | null = null;
      let server: Server | null = null;

      const finish = (err?: Error, result?: { code: string; state: string }) => {
        if (timeout) clearTimeout(timeout);
        server?.close();
        if (err) reject(err);
        else if (result) resolve(result);
      };

      const url = new URL(this.config.callbackUrl);
      const port = Number(url.port) || 3000;
      const pathname = url.pathname;

      server = createServer((req, res) => {
        const reqUrl = new URL(req.url ?? '/', `http://localhost:${port}`);
        if (reqUrl.pathname !== pathname) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        const error = reqUrl.searchParams.get('error');
        const code = reqUrl.searchParams.get('code');
        const state = reqUrl.searchParams.get('state');

        if (error) {
          res.statusCode = 400;
          res.end(`OAuth error: ${error}`);
          finish(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code || !state) {
          res.statusCode = 400;
          res.end('Missing code or state');
          finish(new Error('Missing OAuth code or state'));
          return;
        }

        if (state !== opts.expectedState) {
          res.statusCode = 400;
          res.end('Invalid state');
          finish(new Error('OAuth state mismatch'));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(
          '<!DOCTYPE html><html><body><h2>Authorization complete</h2>' +
            '<p>You can close this window.</p></body></html>'
        );
        finish(undefined, { code, state });
      });

      server.once('error', (err) => finish(err));
      server.listen(port, 'localhost');

      timeout = setTimeout(() => {
        finish(new Error('OAuth callback timeout'));
      }, opts.timeoutMs);
    });
  }
}

export class CodePasteFlow {
  private verifier: string = '';
  private challenge: string = '';

  constructor(private config: CodePasteFlowConfig) {}

  generateAuthUrl(): { url: string; state: string } {
    this.verifier = randomBytes(32).toString('hex');
    this.challenge = createHash('sha256').update(this.verifier).digest('base64url');

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope ?? '',
      code_challenge: this.challenge,
      code_challenge_method: 'S256',
      state: this.verifier,
    });

    return {
      url: `${this.config.authorizationUrl}?${params.toString()}`,
      state: this.verifier,
    };
  }

  async exchangeCode(code: string, state: string): Promise<OAuthCredential> {
    if (state !== this.verifier) {
      throw new Error('OAuth state mismatch');
    }

    const body = new URLSearchParams({
      client_id: this.config.clientId,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.config.redirectUri,
      code_verifier: this.verifier,
    });

    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Token exchange failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const cred: OAuthCredential = {
      type: 'oauth',
      accessToken: String(json.access_token ?? ''),
    };
    if (json.refresh_token) cred.refreshToken = String(json.refresh_token);
    if (json.token_type) cred.tokenType = String(json.token_type);
    if (json.scope) cred.scope = String(json.scope);
    if (json.expires_in) {
      cred.expiresAt = Date.now() + Number(json.expires_in) * 1000;
    }
    return cred;
  }

  async refresh(refreshToken: string): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Token refresh failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const result: OAuthTokenResponse = {
      accessToken: String(json.access_token ?? ''),
      tokenType: String(json.token_type ?? 'Bearer'),
    };
    if (json.expires_in != null) result.expiresIn = Number(json.expires_in);
    if (json.refresh_token) result.refreshToken = String(json.refresh_token);
    if (json.scope) result.scope = String(json.scope);
    return result;
  }
}
