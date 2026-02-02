import type {
  OAuthCredential,
  OAuthFlowConfig,
  isTokenExpired,
  isDeviceCodeFlowConfig,
} from '@amicus/types';
import { DeviceCodeFlow, PKCEFlow } from './OAuthFlows.js';
import { secretStore } from './ConfigService.js';

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

type RefreshCallback = (providerId: string, credential: OAuthCredential) => void;

class TokenRefreshManager {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private flowConfigs = new Map<string, OAuthFlowConfig>();
  private refreshing = new Set<string>();
  private onRefreshCallbacks: RefreshCallback[] = [];

  registerProvider(providerId: string, config: OAuthFlowConfig): void {
    this.flowConfigs.set(providerId, config);
  }

  unregisterProvider(providerId: string): void {
    this.cancelRefresh(providerId);
    this.flowConfigs.delete(providerId);
  }

  onRefresh(callback: RefreshCallback): void {
    this.onRefreshCallbacks.push(callback);
  }

  scheduleRefresh(providerId: string, expiresAt: number): void {
    this.cancelRefresh(providerId);

    const refreshAt = expiresAt - REFRESH_BUFFER_MS;
    const delay = Math.max(0, refreshAt - Date.now());

    if (delay === 0) {
      this.doRefresh(providerId).catch((err) => {
        console.error(`[TokenRefreshManager] Immediate refresh failed for ${providerId}:`, err);
      });
      return;
    }

    const timer = setTimeout(() => {
      this.timers.delete(providerId);
      this.doRefresh(providerId).catch((err) => {
        console.error(`[TokenRefreshManager] Scheduled refresh failed for ${providerId}:`, err);
      });
    }, delay);

    this.timers.set(providerId, timer);
    console.log(
      `[TokenRefreshManager] Scheduled refresh for ${providerId} in ${Math.round(delay / 1000)}s`
    );
  }

  cancelRefresh(providerId: string): void {
    const timer = this.timers.get(providerId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(providerId);
    }
  }

  async doRefresh(providerId: string): Promise<OAuthCredential | null> {
    if (this.refreshing.has(providerId)) {
      console.log(`[TokenRefreshManager] Already refreshing ${providerId}, skipping`);
      return null;
    }

    const config = this.flowConfigs.get(providerId);
    if (!config) {
      console.warn(`[TokenRefreshManager] No flow config for ${providerId}`);
      return null;
    }

    const credential = secretStore.getCredential(providerId);
    if (!credential || credential.type !== 'oauth') {
      console.warn(`[TokenRefreshManager] No OAuth credential for ${providerId}`);
      return null;
    }

    if (!credential.refreshToken) {
      console.warn(`[TokenRefreshManager] No refresh token for ${providerId}`);
      return null;
    }

    this.refreshing.add(providerId);
    try {
      console.log(`[TokenRefreshManager] Refreshing token for ${providerId}`);

      let tokens;
      if (config.flow === 'device_code') {
        const flow = new DeviceCodeFlow(config);
        tokens = await flow.refresh(credential.refreshToken);
      } else {
        const flow = new PKCEFlow(config);
        tokens = await flow.refresh(credential.refreshToken);
      }

      const newCredential: OAuthCredential = {
        type: 'oauth',
        accessToken: tokens.accessToken,
      };
      if (tokens.refreshToken) newCredential.refreshToken = tokens.refreshToken;
      else if (credential.refreshToken) newCredential.refreshToken = credential.refreshToken;
      if (tokens.tokenType) newCredential.tokenType = tokens.tokenType;
      if (tokens.scope) newCredential.scope = tokens.scope;
      if (tokens.expiresIn) {
        newCredential.expiresAt = Date.now() + tokens.expiresIn * 1000;
      }

      await secretStore.setCredential(providerId, newCredential);

      if (newCredential.expiresAt) {
        this.scheduleRefresh(providerId, newCredential.expiresAt);
      }

      for (const cb of this.onRefreshCallbacks) {
        try {
          cb(providerId, newCredential);
        } catch (err) {
          console.error(`[TokenRefreshManager] Callback error:`, err);
        }
      }

      console.log(`[TokenRefreshManager] Token refreshed for ${providerId}`);
      return newCredential;
    } catch (err) {
      console.error(`[TokenRefreshManager] Refresh failed for ${providerId}:`, err);
      throw err;
    } finally {
      this.refreshing.delete(providerId);
    }
  }

  async handleUnauthorized(providerId: string): Promise<OAuthCredential | null> {
    return this.doRefresh(providerId);
  }

  stopAll(): void {
    for (const [providerId] of this.timers) {
      this.cancelRefresh(providerId);
    }
    this.flowConfigs.clear();
    this.onRefreshCallbacks = [];
  }
}

export const tokenRefreshManager = new TokenRefreshManager();
