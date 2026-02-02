import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { DeviceCodeFlow, PKCEFlow } from '../src/services/OAuthFlows.js';

// Mock OAuth Server for testing
class MockOAuthServer {
  private server: Server | null = null;
  private port = 0;
  private authorized = false;
  private pollCount = 0;

  async start(): Promise<number> {
    return new Promise((resolve) => {
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', `http://localhost:${this.port}`);
        this.handleRequest(req, res, url);
      });

      this.server.listen(0, () => {
        const addr = this.server!.address();
        this.port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve(this.port);
      });
    });
  }

  setAuthorized(value: boolean): void {
    this.authorized = value;
  }

  resetPollCount(): void {
    this.pollCount = 0;
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse, url: URL): void {
    res.setHeader('Content-Type', 'application/json');

    if (url.pathname === '/device/code' && req.method === 'POST') {
      res.statusCode = 200;
      res.end(
        JSON.stringify({
          device_code: 'test-device-code',
          user_code: 'ABCD-1234',
          verification_uri: `http://localhost:${this.port}/verify`,
          verification_uri_complete: `http://localhost:${this.port}/verify?code=ABCD-1234`,
          expires_in: 900,
          interval: 1,
        })
      );
      return;
    }

    if (url.pathname === '/token' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const params = new URLSearchParams(body);
        const grantType = params.get('grant_type');

        if (grantType === 'urn:ietf:params:oauth:grant-type:device_code') {
          this.pollCount++;
          if (this.authorized) {
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                access_token: 'test-access-token',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'test-refresh-token',
                scope: 'model:read model:write',
              })
            );
          } else {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'authorization_pending' }));
          }
          return;
        }

        if (grantType === 'refresh_token') {
          const refreshToken = params.get('refresh_token');
          if (refreshToken === 'test-refresh-token') {
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                access_token: 'new-access-token',
                token_type: 'Bearer',
                expires_in: 3600,
              })
            );
          } else {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'invalid_grant' }));
          }
          return;
        }

        if (grantType === 'authorization_code') {
          const code = params.get('code');
          if (code === 'valid-auth-code') {
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                access_token: 'pkce-access-token',
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: 'pkce-refresh-token',
                scope: 'openid profile',
              })
            );
          } else {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'invalid_grant' }));
          }
          return;
        }

        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'unsupported_grant_type' }));
      });
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not_found' }));
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

describe('OAuth', () => {
  let mockServer: MockOAuthServer;
  let mockPort: number;

  beforeAll(async () => {
    mockServer = new MockOAuthServer();
    mockPort = await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  describe('DeviceCodeFlow', () => {
    test('start() returns device code response', async () => {
      const flow = new DeviceCodeFlow({
        flow: 'device_code',
        clientId: 'test-client',
        deviceCodeUrl: `http://localhost:${mockPort}/device/code`,
        tokenUrl: `http://localhost:${mockPort}/token`,
        scope: 'model:read',
      });

      const result = await flow.start();

      expect(result.deviceCode).toBe('test-device-code');
      expect(result.userCode).toBe('ABCD-1234');
      expect(result.verificationUri).toBe(`http://localhost:${mockPort}/verify`);
      expect(result.expiresIn).toBe(900);
      expect(result.interval).toBe(1);
    });

    test('poll() returns pending when not authorized', async () => {
      mockServer.setAuthorized(false);
      mockServer.resetPollCount();

      const flow = new DeviceCodeFlow({
        flow: 'device_code',
        clientId: 'test-client',
        deviceCodeUrl: `http://localhost:${mockPort}/device/code`,
        tokenUrl: `http://localhost:${mockPort}/token`,
      });

      const result = await flow.poll('test-device-code');

      expect(result.status).toBe('pending');
    });

    test('poll() returns success with tokens when authorized', async () => {
      mockServer.setAuthorized(true);

      const flow = new DeviceCodeFlow({
        flow: 'device_code',
        clientId: 'test-client',
        deviceCodeUrl: `http://localhost:${mockPort}/device/code`,
        tokenUrl: `http://localhost:${mockPort}/token`,
      });

      const result = await flow.poll('test-device-code');

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.tokens.accessToken).toBe('test-access-token');
        expect(result.tokens.refreshToken).toBe('test-refresh-token');
        expect(result.tokens.expiresIn).toBe(3600);
      }
    });

    test('refresh() exchanges refresh token for new access token', async () => {
      const flow = new DeviceCodeFlow({
        flow: 'device_code',
        clientId: 'test-client',
        deviceCodeUrl: `http://localhost:${mockPort}/device/code`,
        tokenUrl: `http://localhost:${mockPort}/token`,
      });

      const result = await flow.refresh('test-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
    });

    test('pollUntilComplete() resolves when authorized', async () => {
      mockServer.setAuthorized(false);
      mockServer.resetPollCount();

      const flow = new DeviceCodeFlow({
        flow: 'device_code',
        clientId: 'test-client',
        deviceCodeUrl: `http://localhost:${mockPort}/device/code`,
        tokenUrl: `http://localhost:${mockPort}/token`,
      });

      // Authorize after 100ms
      setTimeout(() => mockServer.setAuthorized(true), 100);

      const credential = await flow.pollUntilComplete('test-device-code', {
        expiresIn: 10,
        interval: 0.05, // 50ms for faster testing
      });

      expect(credential.type).toBe('oauth');
      expect(credential.accessToken).toBe('test-access-token');
      expect(credential.refreshToken).toBe('test-refresh-token');
    });
  });

  describe('PKCEFlow', () => {
    test('generateAuthUrl() returns URL with PKCE parameters', () => {
      const flow = new PKCEFlow({
        flow: 'pkce',
        clientId: 'test-client',
        authorizationUrl: `http://localhost:${mockPort}/authorize`,
        tokenUrl: `http://localhost:${mockPort}/token`,
        callbackUrl: 'http://localhost:9999/callback',
        scope: 'openid profile',
      });

      const { url, state } = flow.generateAuthUrl();
      const parsedUrl = new URL(url);

      expect(parsedUrl.searchParams.get('client_id')).toBe('test-client');
      expect(parsedUrl.searchParams.get('response_type')).toBe('code');
      expect(parsedUrl.searchParams.get('redirect_uri')).toBe('http://localhost:9999/callback');
      expect(parsedUrl.searchParams.get('code_challenge')).toBeTruthy();
      expect(parsedUrl.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsedUrl.searchParams.get('state')).toBe(state);
    });

    test('exchangeCode() validates state and exchanges code for tokens', async () => {
      const flow = new PKCEFlow({
        flow: 'pkce',
        clientId: 'test-client',
        authorizationUrl: `http://localhost:${mockPort}/authorize`,
        tokenUrl: `http://localhost:${mockPort}/token`,
        callbackUrl: 'http://localhost:9999/callback',
      });

      const { state } = flow.generateAuthUrl();

      const credential = await flow.exchangeCode('valid-auth-code', state);

      expect(credential.type).toBe('oauth');
      expect(credential.accessToken).toBe('pkce-access-token');
      expect(credential.refreshToken).toBe('pkce-refresh-token');
    });

    test('exchangeCode() throws on state mismatch', async () => {
      const flow = new PKCEFlow({
        flow: 'pkce',
        clientId: 'test-client',
        authorizationUrl: `http://localhost:${mockPort}/authorize`,
        tokenUrl: `http://localhost:${mockPort}/token`,
        callbackUrl: 'http://localhost:9999/callback',
      });

      flow.generateAuthUrl();

      await expect(flow.exchangeCode('valid-auth-code', 'wrong-state')).rejects.toThrow(
        'OAuth state mismatch'
      );
    });

    test('refresh() exchanges refresh token for new access token', async () => {
      const flow = new PKCEFlow({
        flow: 'pkce',
        clientId: 'test-client',
        authorizationUrl: `http://localhost:${mockPort}/authorize`,
        tokenUrl: `http://localhost:${mockPort}/token`,
        callbackUrl: 'http://localhost:9999/callback',
      });

      const result = await flow.refresh('test-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.tokenType).toBe('Bearer');
    });
  });

});
