/**
 * OAuth Authentication Types (RFC 8628 Device Code, RFC 7636 PKCE)
 */

export interface ApiKeyCredential {
  type: 'api_key';
  apiKey: string;
}

export interface OAuthCredential {
  type: 'oauth';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
}

export interface TokenCredential {
  type: 'token';
  token: string;
  expiresAt?: number;
}

export type Credential = ApiKeyCredential | OAuthCredential | TokenCredential;

export type AuthStatus = 'disconnected' | 'connected' | 'expired' | 'error';

export type OAuthFlowType = 'device_code' | 'pkce' | 'code_paste';

export interface DeviceCodeFlowConfig {
  flow: 'device_code';
  clientId: string;
  deviceCodeUrl: string;
  tokenUrl: string;
  scope?: string;
}

export interface PKCEFlowConfig {
  flow: 'pkce';
  clientId: string;
  authorizationUrl: string;
  tokenUrl: string;
  callbackUrl: string;
  scope?: string;
}

export interface CodePasteFlowConfig {
  flow: 'code_paste';
  clientId: string;
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope?: string;
}

export type OAuthFlowConfig = DeviceCodeFlowConfig | PKCEFlowConfig | CodePasteFlowConfig;

export interface OAuthMethod {
  id: string;
  label: string;
  flow: OAuthFlowType;
  description?: string;
}

export type AuthMethod = 'api_key' | 'oauth' | 'both';

export interface ProviderAuthConfig {
  method: AuthMethod;
  envKey?: string;
  oauth?: OAuthFlowConfig;
  oauthMethods?: OAuthMethodConfig[];
}

export interface OAuthMethodConfig {
  id: string;
  label: string;
  flow: OAuthFlowConfig;
}

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
}

export interface OAuthTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  refreshToken?: string;
  scope?: string;
}

export type OAuthPollResult =
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'expired' }
  | { status: 'access_denied' }
  | { status: 'success'; tokens: OAuthTokenResponse };

export interface StoredCredential {
  providerId: string;
  credential: Credential;
  updatedAt: number;
}

export function isApiKeyCredential(cred: Credential): cred is ApiKeyCredential {
  return cred.type === 'api_key';
}

export function isOAuthCredential(cred: Credential): cred is OAuthCredential {
  return cred.type === 'oauth';
}

export function isTokenCredential(cred: Credential): cred is TokenCredential {
  return cred.type === 'token';
}

export function isDeviceCodeFlowConfig(config: OAuthFlowConfig): config is DeviceCodeFlowConfig {
  return config.flow === 'device_code';
}

export function isPKCEFlowConfig(config: OAuthFlowConfig): config is PKCEFlowConfig {
  return config.flow === 'pkce';
}

export function isTokenExpired(
  credential: OAuthCredential | TokenCredential,
  bufferMs: number = 5 * 60 * 1000
): boolean {
  if (!credential.expiresAt) return false;
  return Date.now() + bufferMs >= credential.expiresAt;
}
