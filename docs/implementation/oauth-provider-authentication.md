# OAuth Provider Authentication Implementation

## Overview

Amicus now supports OAuth authentication for LLM providers in addition to API keys. This enables users to authenticate using their existing accounts (e.g., Claude Pro, ChatGPT Plus, GitHub Copilot) without managing API keys.

## Supported OAuth Providers

### Anthropic
- **claude-pro**: Claude Pro/Max subscription OAuth (Code Paste flow)
- **create-api-key**: Create API Key OAuth (Code Paste flow)

### OpenAI
- **chatgpt-browser**: ChatGPT Pro/Plus (PKCE browser flow)
- **chatgpt-headless**: ChatGPT Pro/Plus (Device Code headless flow)

### Google
- **gemini-browser**: Google Gemini (PKCE browser flow)

### GitHub Copilot
- **copilot-device**: GitHub Copilot (Device Code with special token exchange)

## OAuth Flow Types

### 1. Device Code Flow (RFC 8628)
**Used by**: OpenAI (headless), GitHub Copilot

**Flow**:
1. User clicks "Connect" → Backend requests device code
2. UI shows verification URL + user code
3. User visits URL in browser and enters code
4. UI polls backend every 5 seconds
5. Backend polls OAuth server until authorized
6. Tokens stored in SecretStore

**Implementation**:
- `apps/daemon/src/services/OAuthFlows.ts`: `DeviceCodeFlow` class
- Special handling for GitHub Copilot: Device code → GitHub token → Copilot API token

### 2. PKCE Flow (RFC 7636)
**Used by**: OpenAI (browser), Google

**Flow**:
1. User clicks "Connect" → Backend generates PKCE challenge + starts ephemeral callback server on port 1455
2. UI opens popup window with authorization URL
3. User authorizes in popup → OAuth redirects to `http://localhost:1455/auth/callback`
4. Ephemeral server receives code → automatically exchanges for tokens
5. Server stores credentials and shuts down (3-minute timeout)
6. UI polls backend for completion status

**Implementation**:
- `apps/daemon/src/services/OAuthFlows.ts`: `PKCEFlow` class with `startCallbackServer()` method
- Ephemeral HTTP server on port 1455 (based on OpenCode pattern)
- Auto-shutdown after callback or 3-minute timeout
- `apps/dashboard/src/components/AdminPanel.ts`: Opens popup window

### 3. Code Paste Flow (Anthropic)
**Used by**: Anthropic

**Flow**:
1. User clicks "Connect" → UI shows authorization URL
2. User opens URL in browser and authorizes
3. OAuth page shows authorization code
4. User pastes code into Amicus UI
5. Backend exchanges code for tokens

**Implementation**:
- `apps/daemon/src/services/OAuthFlows.ts`: `CodePasteFlow` class
- `apps/dashboard/src/components/AdminPanel.ts`: `submitPastedCode()` method

## Architecture

### Backend (Daemon)

#### OAuth Flow Management
```
apps/daemon/src/services/
├── OAuthFlows.ts           # DeviceCodeFlow, PKCEFlow, CodePasteFlow classes
├── SecretStore.ts          # Stores OAuth tokens (OAuthCredential)
└── ProviderService.ts      # Provider management with OAuth support
```

#### API Routes
```
POST /admin/providers/:id/oauth/start
  Body: { methodId?: string }
  Response: { flowId, flowType, userCode?, verificationUri?, authorizationUrl? }

GET /admin/providers/:id/oauth/poll?flowId=...
  Response: { status: 'pending' | 'success' | 'expired' | 'access_denied' }

POST /admin/providers/:id/oauth/callback
  Body: { flowId, code, state }
  Response: { status, connected }

DELETE /admin/providers/:id/oauth
  Response: { disconnected: boolean }
```

#### Configuration
```typescript
// config/llm-providers.ts
{
  id: 'anthropic',
  auth: {
    method: 'both',  // Supports both API key and OAuth
    oauthMethods: [
      {
        id: 'claude-pro',
        label: 'Claude Pro/Max',
        flow: {
          flow: 'code_paste',
          clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
          authorizationUrl: 'https://claude.ai/oauth/authorize',
          tokenUrl: 'https://console.anthropic.com/v1/oauth/token',
          redirectUri: 'https://console.anthropic.com/oauth/code/callback',
          scope: 'org:create_api_key user:profile user:inference',
        },
      },
    ],
  },
}
```

### Frontend (Dashboard)

#### UI Components
```
apps/dashboard/src/components/AdminPanel.ts
├── renderProviderCard()           # Shows OAuth method dropdown
├── startOAuthFlow()               # Initiates OAuth flow
├── renderOAuthDialog()            # Shows flow-specific UI
│   ├── Device Code: Shows user code + verification URL
│   ├── PKCE: Shows "Opening browser..." message
│   └── Code Paste: Shows authorization URL + paste input
├── pollOAuthFlow()                # Polls device code status
├── listenForOAuthCallback()       # Listens for PKCE callback
└── submitPastedCode()             # Submits pasted authorization code
```

#### State Management
```typescript
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

@state() private selectedOAuthMethod: Record<string, string> = {};
```

### Types

```typescript
// packages/types/src/auth.ts
export type OAuthFlowType = 'device_code' | 'pkce' | 'code_paste';

export interface OAuthMethodConfig {
  id: string;
  label: string;
  flow: OAuthFlowConfig;
}

export interface ProviderAuthConfig {
  method: 'api_key' | 'oauth' | 'both';
  envKey?: string;
  oauthMethods?: OAuthMethodConfig[];
}
```

## Security Considerations

### Client IDs
All OAuth client IDs are **public** and safe to commit:
- Anthropic: `9d1c250a-e61b-44d9-88ed-5944d1962f5e` (verified from 10+ open-source projects)
- OpenAI: `app_EMoamEEZ73f0CkXaXp7hrann` (official ChatGPT app client ID)
- GitHub Copilot: `Ov23li8tweQw6odWQebz` (public GitHub OAuth app)

### Token Storage
- OAuth tokens stored in `data/secrets.json` (encrypted at rest)
- Only accessible via SecretStore service
- Never exposed in API responses

### PKCE Security
- State parameter validated on callback
- Code verifier/challenge generated per flow
- Ephemeral callback server only accepts expected state
- Server auto-shuts down after callback or 3-minute timeout

### OpenAI OAuth Specifics
- **Client ID**: `app_EMoamEEZ73f0CkXaXp7hrann` (shared public client, used by OpenCode, claude-code-mux, and others)
- **Redirect URI**: Fixed to `http://localhost:1455/auth/callback` (hardcoded in OpenAI's OAuth app)
- **Special Parameters**:
  - `codex_cli_simplified_flow=true`: Enables CLI-optimized OAuth flow
  - `id_token_add_organizations=true`: Includes organization info in ID token
  - `originator=amicus`: Identifies the client application
- **Port 1455**: Ephemeral HTTP server started only during OAuth flow
- **Based on**: OpenCode's ephemeral server pattern ([reference](https://github.com/numman-ali/opencode-openai-codex-auth))

## Testing

### Manual Testing

1. **Start Daemon + Dashboard**:
   ```bash
   bun run --cwd apps/daemon dev
   bun run --cwd apps/dashboard dev
   ```

2. **Test Device Code Flow** (OpenAI headless):
   - Navigate to Admin → Providers
   - Find "openai" provider
   - Select "ChatGPT Pro/Plus (Headless)"
   - Click "Connect"
   - Open verification URL in browser
   - Enter user code
   - Verify connection in Dashboard

3. **Test PKCE Flow** (OpenAI browser):
   - Select "ChatGPT Pro/Plus (Browser)"
   - Click "Connect"
   - Authorize in popup window
   - Verify connection in Dashboard

4. **Test Code Paste Flow** (Anthropic):
   - Find "anthropic" provider
   - Select "Claude Pro/Max"
   - Click "Connect"
   - Open authorization URL
   - Copy authorization code
   - Paste into Dashboard
   - Click "Connect"
   - Verify connection

### Automated Testing

E2E tests for OAuth flows:
```bash
bun run --cwd apps/dashboard test:e2e
```

## Future Enhancements

### Token Refresh
- Currently implemented for Device Code and PKCE flows
- Refresh tokens stored alongside access tokens
- Automatic refresh when token expires

### Additional Providers
To add a new OAuth provider:

1. Add provider config to `config/llm-providers.ts`:
   ```typescript
   {
     id: 'new-provider',
     auth: {
       method: 'oauth',
       oauthMethods: [
         {
           id: 'oauth-method',
           label: 'OAuth Method Label',
           flow: {
             flow: 'device_code',  // or 'pkce' or 'code_paste'
             clientId: 'client-id',
             deviceCodeUrl: 'https://...',
             tokenUrl: 'https://...',
             scope: 'scope',
           },
         },
       ],
     },
   }
   ```

2. No code changes needed - flows auto-detected from config

### Admin UI Improvements
- [ ] Show token expiration time
- [ ] Add "Refresh Token" button
- [ ] Show OAuth scope/permissions
- [ ] Add OAuth flow selection persistence

## Troubleshooting

### "OAuth timeout - no response from popup"
- Check popup blocker settings
- Verify callback URL matches OAuth app configuration
- Check browser console for CORS errors

### "OAuth state mismatch"
- Clear browser cache and retry
- Verify callback page is served correctly

### "Device code expired"
- User took too long to authorize (typically 10-15 minutes)
- Restart OAuth flow

## References

- RFC 8628: OAuth 2.0 Device Authorization Grant
- RFC 7636: Proof Key for Code Exchange (PKCE)
- Anthropic OAuth Documentation: https://docs.anthropic.com/oauth
- OpenAI OAuth Documentation: https://platform.openai.com/docs/oauth
