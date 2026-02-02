# OAuth Provider Dashboard Verification Report

## Summary
Checked if OAuth providers (anthropic, openai, google) show OAuth connection options in the Dashboard Admin panel.

## Key Findings

### ❌ OAuth Method Selection Dropdowns: NOT FOUND

The Dashboard Admin panel shows **only API key-based authentication** for all providers. No OAuth connection options are visible.

### Provider Cards Analysis (Lines 52-208)

All 12 API Key Providers follow the same pattern:

**Structure:**
1. **Provider Name** (strong text) - e.g., "anthropic", "openai", "google"
2. **Control Buttons:**
   - "Enable" - Toggle provider on/off
   - "Unlink" - Remove provider completely
3. **Status Display:**
   - "No API Key" - Indication that provider is not configured
   - "0 models" - Number of available models
4. **Configuration Section:**
   - Textbox: "Enter API key"
   - Button: "Validate & Save"
   - Button: "Test"

### Specific Provider Details

#### anthropic (ref=e140)
```
- strong: "anthropic"
- buttons: ["Enable", "Unlink"]
- description: "No API Key"
- models: 0
- inputs: textbox for API key
- actions: Validate & Save, Test
```

#### openai (ref=e154)
```
- strong: "openai"
- buttons: ["Enable", "Unlink"]
- description: "No API Key"
- models: 0
- inputs: textbox for API key
- actions: Validate & Save, Test
```

#### google (ref=e168)
```
- strong: "google"
- buttons: ["Enable", "Unlink"]
- description: "No API Key"
- models: 0
- inputs: textbox for API key
- actions: Validate & Save, Test
```

## Screenshots Captured

1. **dashboard-main.png** - Main Dashboard view
2. **dashboard-admin-providers.png** - Admin Providers panel (full view)
3. **dashboard-admin-full-providers.png** - Complete page screenshot

All screenshots saved to: `/var/folders/pm/4dpkln595vs1mrr9f41bg5_m0000gn/T/playwright-mcp-output/1770072576914/tmp/`

## Conclusion

**The Dashboard Admin panel does NOT currently show OAuth connection options for providers.** Only API key-based authentication is available for all providers including anthropic, openai, and google.

**What's Missing:**
- No OAuth method dropdown (dropdown with options: "API Key", "OAuth", etc.)
- No "Connect with OAuth" button
- No OAuth provider selection interface

**Current UI Focus:**
- API key entry and validation
- Provider enable/disable/unlink
- Connection testing
- Model count display
- Default provider selection

## Recommendation

To add OAuth support to the Dashboard, the following components need to be implemented:

1. **Provider Selection UI:** Add OAuth method dropdown to each provider card
2. **OAuth Configuration UI:** Create OAuth connection flow (redirect to provider, authorization code, etc.)
3. **State Management:** Track OAuth token/expiry in secretStore
4. **Admin Endpoints:** Add admin routes for OAuth initialization and token refresh
5. **Dashboard Components:** Update Lit components to render OAuth UI based on provider configuration
