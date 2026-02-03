import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { APIResponse } from '@amicus/types/dashboard';
import type { OAuthCredential, ProviderAuthConfig } from '@amicus/types';
import { adminAuthMiddleware } from '../middleware/admin-auth.js';
import { configManager, secretStore } from '../services/ConfigService.js';
import { DeviceCodeFlow, PKCEFlow, CodePasteFlow } from '../services/OAuthFlows.js';
import { tokenRefreshManager } from '../services/TokenRefreshManager.js';
import { providerService } from '../services/ProviderService.js';
import { writeAudit } from '../services/AuditLogService.js';
import { llmProviderConfig } from '@amicus/core';

type ProviderWithAuth = {
  id: string;
  enabled: boolean;
  package: string;
  envKey?: string;
  baseURL?: string;
  auth?: ProviderAuthConfig;
};

export const oauthRoutes = new Hono();

type PendingOAuth = {
  providerId: string;
  flow: DeviceCodeFlow | PKCEFlow | CodePasteFlow;
  deviceCode?: string;
  state?: string;
  expiresAt: number;
};

const pendingFlows = new Map<string, PendingOAuth>();

function ok<T>(data: T): APIResponse<T> {
  return {
    success: true,
    data,
    meta: { requestId: randomUUID(), timestamp: Date.now(), duration: 0 },
  };
}

function fail(code: string, message: string): APIResponse<never> {
  return {
    success: false,
    error: { code, message },
    meta: { requestId: randomUUID(), timestamp: Date.now(), duration: 0 },
  };
}

function getProviderConfig(providerId: string): ProviderWithAuth | undefined {
  const defaultProvider = llmProviderConfig.providers.find((p) => p.id === providerId) as ProviderWithAuth | undefined;
  const cfg = configManager.getConfig();
  const userProvider = cfg.llm.providers.find((p) => p.id === providerId);
  
  if (!defaultProvider) {
    return userProvider as ProviderWithAuth | undefined;
  }
  
  if (!userProvider) {
    return defaultProvider;
  }
  
  return {
    ...defaultProvider,
    ...userProvider,
    auth: (userProvider as ProviderWithAuth).auth ?? defaultProvider.auth,
  } as ProviderWithAuth;
}

oauthRoutes.post('/providers/:id/oauth/start', adminAuthMiddleware, async (c) => {
  const providerId = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { methodId?: string } | null;
  console.log('[OAuth] Start request:', { providerId, body });
  
  const provider = getProviderConfig(providerId);

  if (!provider) {
    console.log('[OAuth] Provider not found:', providerId);
    return c.json(fail('NOT_FOUND', `Unknown provider: ${providerId}`), 404);
  }

  if (!provider.auth) {
    console.log('[OAuth] Provider has no auth config:', providerId);
    return c.json(fail('NOT_SUPPORTED', `Provider ${providerId} does not support OAuth`), 400);
  }

  console.log('[OAuth] Provider auth config:', { 
    providerId, 
    hasOAuthMethods: !!provider.auth.oauthMethods,
    oauthMethodsCount: provider.auth.oauthMethods?.length,
    hasOAuth: !!provider.auth.oauth
  });

  let oauthConfig;
  if (provider.auth.oauthMethods && provider.auth.oauthMethods.length > 0) {
    const methodId = body?.methodId;
    console.log('[OAuth] Looking for method:', { methodId, availableMethods: provider.auth.oauthMethods.map(m => m.id) });
    
    const method = methodId
      ? provider.auth.oauthMethods.find((m) => m.id === methodId)
      : provider.auth.oauthMethods[0];
    
    if (!method) {
      console.log('[OAuth] Method not found:', { methodId, availableMethods: provider.auth.oauthMethods.map(m => m.id) });
      return c.json(fail('INVALID_METHOD', `OAuth method ${methodId ?? 'default'} not found`), 400);
    }
    
    console.log('[OAuth] Selected method:', { methodId: method.id, flowType: method.flow.flow });
    oauthConfig = method.flow;
  } else if (provider.auth.oauth) {
    oauthConfig = provider.auth.oauth;
  } else {
    console.log('[OAuth] No OAuth methods or oauth config found');
    return c.json(fail('NOT_SUPPORTED', `Provider ${providerId} does not support OAuth`), 400);
  }

  try {
    if (oauthConfig.flow === 'device_code') {
      const flow = new DeviceCodeFlow(oauthConfig);
      const deviceCodeResponse = await flow.start();

      const flowId = randomUUID();
      pendingFlows.set(flowId, {
        providerId,
        flow,
        deviceCode: deviceCodeResponse.deviceCode,
        expiresAt: Date.now() + deviceCodeResponse.expiresIn * 1000,
      });

      writeAudit({
        timestamp: new Date().toISOString(),
        eventId: randomUUID(),
        actor: 'admin',
        action: 'oauth.start',
        resource: `provider:${providerId}`,
        result: 'success',
      });

      return c.json(
        ok({
          flowId,
          flowType: 'device_code',
          userCode: deviceCodeResponse.userCode,
          verificationUri: deviceCodeResponse.verificationUri,
          verificationUriComplete: deviceCodeResponse.verificationUriComplete,
          expiresIn: deviceCodeResponse.expiresIn,
          interval: deviceCodeResponse.interval,
        })
      );
    } else if (oauthConfig.flow === 'pkce') {
      const flow = new PKCEFlow(oauthConfig);
      const { url, state } = flow.generateAuthUrl();
      
      console.log('[OAuth] PKCE flow generated URL:', url);
      console.log('[OAuth] PKCE state:', state);

      const flowId = randomUUID();
      pendingFlows.set(flowId, {
        providerId,
        flow,
        state,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      flow.startCallbackServer({
        expectedState: state,
        timeoutMs: 5 * 60 * 1000,
      }).then(async ({ code, state }) => {
        console.log('[OAuth] Callback received, exchanging code for token');
        try {
          const credential = await flow.exchangeCode(code, state);
          await secretStore.setCredential(providerId, credential);
          pendingFlows.delete(flowId);

          const provider = getProviderConfig(providerId);
          if (provider?.auth?.oauth) {
            tokenRefreshManager.registerProvider(providerId, provider.auth.oauth);
            if (credential.expiresAt) {
              tokenRefreshManager.scheduleRefresh(providerId, credential.expiresAt);
            }
          }

          const cfg = configManager.getConfig();
          const providerEntry = cfg.llm.providers.find((p) => p.id === providerId);
          if (providerEntry && !providerEntry.enabled) {
            await configManager.update({
              llm: {
                providers: cfg.llm.providers.map((p) =>
                  p.id === providerId ? { ...p, enabled: true } : p
                ),
              },
            });
            await providerService.reload();
          }

          writeAudit({
            timestamp: new Date().toISOString(),
            eventId: randomUUID(),
            actor: 'admin',
            action: 'oauth.complete',
            resource: `provider:${providerId}`,
            result: 'success',
          });

          console.log('[OAuth] PKCE flow completed successfully');
        } catch (err) {
          console.error('[OAuth] Token exchange failed:', err);
          pendingFlows.delete(flowId);
          writeAudit({
            timestamp: new Date().toISOString(),
            eventId: randomUUID(),
            actor: 'admin',
            action: 'oauth.callback',
            resource: `provider:${providerId}`,
            result: 'failure',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }).catch((err) => {
        console.error('[OAuth] Callback server error:', err);
        pendingFlows.delete(flowId);
        writeAudit({
          timestamp: new Date().toISOString(),
          eventId: randomUUID(),
          actor: 'admin',
          action: 'oauth.start',
          resource: `provider:${providerId}`,
          result: 'failure',
          message: err instanceof Error ? err.message : String(err),
        });
      });

      writeAudit({
        timestamp: new Date().toISOString(),
        eventId: randomUUID(),
        actor: 'admin',
        action: 'oauth.start',
        resource: `provider:${providerId}`,
        result: 'success',
      });

      return c.json(
        ok({
          flowId,
          flowType: 'pkce',
          authorizationUrl: url,
          state,
        })
      );
    } else if (oauthConfig.flow === 'code_paste') {
      const flow = new CodePasteFlow(oauthConfig);
      const { url, state } = flow.generateAuthUrl();

      const flowId = randomUUID();
      pendingFlows.set(flowId, {
        providerId,
        flow,
        state,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      writeAudit({
        timestamp: new Date().toISOString(),
        eventId: randomUUID(),
        actor: 'admin',
        action: 'oauth.start',
        resource: `provider:${providerId}`,
        result: 'success',
      });

      return c.json(
        ok({
          flowId,
          flowType: 'code_paste',
          authorizationUrl: url,
          state,
        })
      );
    } else {
      return c.json(fail('UNSUPPORTED_FLOW', `Flow type not supported`), 400);
    }
  } catch (e) {
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'oauth.start',
      resource: `provider:${providerId}`,
      result: 'failure',
      message: e instanceof Error ? e.message : String(e),
    });
    return c.json(fail('OAUTH_START_FAILED', e instanceof Error ? e.message : String(e)), 500);
  }
});

oauthRoutes.get('/providers/:id/oauth/poll', adminAuthMiddleware, async (c) => {
  const providerId = c.req.param('id');
  const flowId = c.req.query('flowId');

  if (!flowId) {
    return c.json(fail('INVALID_PARAMS', 'Missing flowId'), 400);
  }

  const pending = pendingFlows.get(flowId);
  if (!pending || pending.providerId !== providerId) {
    return c.json(fail('NOT_FOUND', 'OAuth flow not found or expired'), 404);
  }

  if (Date.now() > pending.expiresAt) {
    pendingFlows.delete(flowId);
    return c.json(fail('EXPIRED', 'OAuth flow expired'), 410);
  }

  if (!(pending.flow instanceof DeviceCodeFlow) || !pending.deviceCode) {
    return c.json(fail('INVALID_FLOW', 'This flow does not support polling'), 400);
  }

  try {
    const result = await pending.flow.poll(pending.deviceCode);

    if (result.status === 'success') {
      const credential: OAuthCredential = {
        type: 'oauth',
        accessToken: result.tokens.accessToken,
      };
      if (result.tokens.refreshToken) credential.refreshToken = result.tokens.refreshToken;
      if (result.tokens.tokenType) credential.tokenType = result.tokens.tokenType;
      if (result.tokens.scope) credential.scope = result.tokens.scope;
      if (result.tokens.expiresIn) {
        credential.expiresAt = Date.now() + result.tokens.expiresIn * 1000;
      }

      await secretStore.setCredential(providerId, credential);
      pendingFlows.delete(flowId);

      const provider = getProviderConfig(providerId);
      if (provider?.auth?.oauth) {
        tokenRefreshManager.registerProvider(providerId, provider.auth.oauth);
        if (credential.expiresAt) {
          tokenRefreshManager.scheduleRefresh(providerId, credential.expiresAt);
        }
      }

      const cfg = configManager.getConfig();
      const providerEntry = cfg.llm.providers.find((p) => p.id === providerId);
      if (providerEntry && !providerEntry.enabled) {
        await configManager.update({
          llm: {
            providers: cfg.llm.providers.map((p) =>
              p.id === providerId ? { ...p, enabled: true } : p
            ),
          },
        });
        await providerService.reload();
      }

      writeAudit({
        timestamp: new Date().toISOString(),
        eventId: randomUUID(),
        actor: 'admin',
        action: 'oauth.complete',
        resource: `provider:${providerId}`,
        result: 'success',
      });

      return c.json(ok({ status: 'success', connected: true }));
    }

    return c.json(ok({ status: result.status }));
  } catch (e) {
    pendingFlows.delete(flowId);
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'oauth.poll',
      resource: `provider:${providerId}`,
      result: 'failure',
      message: e instanceof Error ? e.message : String(e),
    });
    return c.json(fail('POLL_FAILED', e instanceof Error ? e.message : String(e)), 500);
  }
});

oauthRoutes.post('/providers/:id/oauth/callback', adminAuthMiddleware, async (c) => {
  const providerId = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { flowId?: string; code?: string; state?: string } | null;

  if (!body?.flowId || !body?.code || !body?.state) {
    return c.json(fail('INVALID_BODY', 'Expected { flowId, code, state }'), 400);
  }

  const pending = pendingFlows.get(body.flowId);
  if (!pending || pending.providerId !== providerId) {
    return c.json(fail('NOT_FOUND', 'OAuth flow not found or expired'), 404);
  }

  if (!(pending.flow instanceof PKCEFlow || pending.flow instanceof CodePasteFlow) || !pending.state) {
    return c.json(fail('INVALID_FLOW', 'This flow does not support callback'), 400);
  }

  try {
    const credential = await pending.flow.exchangeCode(body.code, body.state);
    await secretStore.setCredential(providerId, credential);
    pendingFlows.delete(body.flowId);

    const provider = getProviderConfig(providerId);
    if (provider?.auth?.oauth) {
      tokenRefreshManager.registerProvider(providerId, provider.auth.oauth);
      if (credential.expiresAt) {
        tokenRefreshManager.scheduleRefresh(providerId, credential.expiresAt);
      }
    }

    const cfg = configManager.getConfig();
    const providerEntry = cfg.llm.providers.find((p) => p.id === providerId);
    if (providerEntry && !providerEntry.enabled) {
      await configManager.update({
        llm: {
          providers: cfg.llm.providers.map((p) =>
            p.id === providerId ? { ...p, enabled: true } : p
          ),
        },
      });
      await providerService.reload();
    }

    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'oauth.callback',
      resource: `provider:${providerId}`,
      result: 'success',
    });

    return c.json(ok({ status: 'success', connected: true }));
  } catch (e) {
    pendingFlows.delete(body.flowId);
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'oauth.callback',
      resource: `provider:${providerId}`,
      result: 'failure',
      message: e instanceof Error ? e.message : String(e),
    });
    return c.json(fail('CALLBACK_FAILED', e instanceof Error ? e.message : String(e)), 500);
  }
});

oauthRoutes.delete('/providers/:id/oauth', adminAuthMiddleware, async (c) => {
  const providerId = c.req.param('id');
  const provider = getProviderConfig(providerId);

  if (!provider) {
    return c.json(fail('NOT_FOUND', `Unknown provider: ${providerId}`), 404);
  }

  try {
    await secretStore.deleteCredential(providerId);
    tokenRefreshManager.unregisterProvider(providerId);

    const cfg = configManager.getConfig();
    await configManager.update({
      llm: {
        providers: cfg.llm.providers.map((p) =>
          p.id === providerId ? { ...p, enabled: false } : p
        ),
      },
    });
    await providerService.reload();

    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'oauth.disconnect',
      resource: `provider:${providerId}`,
      result: 'success',
    });

    return c.json(ok({ disconnected: true }));
  } catch (e) {
    writeAudit({
      timestamp: new Date().toISOString(),
      eventId: randomUUID(),
      actor: 'admin',
      action: 'oauth.disconnect',
      resource: `provider:${providerId}`,
      result: 'failure',
      message: e instanceof Error ? e.message : String(e),
    });
    return c.json(fail('DISCONNECT_FAILED', e instanceof Error ? e.message : String(e)), 500);
  }
});

oauthRoutes.get('/providers/:id/oauth/status', adminAuthMiddleware, (c) => {
  const providerId = c.req.param('id');
  const provider = getProviderConfig(providerId);

  if (!provider) {
    return c.json(fail('NOT_FOUND', `Unknown provider: ${providerId}`), 404);
  }

  const credential = secretStore.getCredential(providerId);

  if (!credential || credential.type !== 'oauth') {
    return c.json(ok({ status: 'disconnected' }));
  }

  const now = Date.now();
  if (credential.expiresAt && credential.expiresAt < now) {
    return c.json(ok({ status: 'expired', expiresAt: credential.expiresAt }));
  }

  return c.json(
    ok({
      status: 'connected',
      expiresAt: credential.expiresAt,
      scope: credential.scope,
    })
  );
});

oauthRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.html(
      `<!DOCTYPE html><html><body><h2>Authorization Failed</h2><p>${error}</p><script>window.close();</script></body></html>`
    );
  }

  if (!code || !state) {
    return c.html(
      '<!DOCTYPE html><html><body><h2>Missing parameters</h2><script>window.close();</script></body></html>'
    );
  }

  return c.html(
    `<!DOCTYPE html><html><body>
      <h2>Authorization Complete</h2>
      <p>You can close this window.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth-callback', code: '${code}', state: '${state}' }, '*');
        }
        setTimeout(() => window.close(), 2000);
      </script>
    </body></html>`
  );
});

setInterval(() => {
  const now = Date.now();
  for (const [flowId, pending] of pendingFlows) {
    if (now > pending.expiresAt) {
      pendingFlows.delete(flowId);
    }
  }
}, 60 * 1000);
