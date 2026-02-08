# Configuration Guide

Amicus uses `./data/amicus.json` to store all configuration including provider credentials with inline encryption.

---

## File Structure

```json
{
  "daemon": {
    "port": 3000
  },
  "llm": {
    "providers": [
      {
        "id": "openai",
        "enabled": true,
        "package": "@ai-sdk/openai",
        "apiKey": "enc:v1:aGVsbG93b3JsZC4uLg=="
      },
      {
        "id": "anthropic",
        "enabled": true,
        "package": "@ai-sdk/anthropic",
        "accessToken": "enc:v1:b2F1dGh0b2tlbi4uLg==",
        "refreshToken": "enc:v1:cmVmcmVzaC4uLg=="
      }
    ],
    "defaultModel": "openai:gpt-4o-mini",
    "dailyBudget": 10,
    "budgetAlertThreshold": 0.8
  }
}
```

---

## Encrypted Values

Sensitive fields (apiKey, accessToken, refreshToken) are automatically encrypted with the `enc:v1:` prefix:

- **Format**: `enc:v1:{base64-encoded-encrypted-data}`
- **Algorithm**: AES-256-GCM with PBKDF2 (200,000 iterations)
- **Encryption Key**: `CONFIG_ENCRYPTION_KEY` environment variable (required)

---

## Adding API Keys

1. Edit `./data/amicus.json` manually
2. Add plaintext API key:
   ```json
   {
     "id": "openai",
     "apiKey": "sk-your-actual-api-key-here"
   }
   ```
3. On next save/update, Amicus automatically encrypts it to `enc:v1:...` format

---

## Environment Variable

```bash
# Required for encryption/decryption
export CONFIG_ENCRYPTION_KEY="your-encryption-key-here"
```

**Security**: Keep this key secret! Store in `.env` file (not committed to git).

---

## Error Messages

- **"CONFIG_ENCRYPTION_KEY missing or invalid"**: Set the encryption key environment variable
- **"Failed to decrypt"**: Wrong encryption key or corrupted data

---

## Storage Architecture

- **amicus.json**: All provider configuration with inline encrypted credentials
- **secrets.enc.json**: Admin password only (separate security layer)
- Both use CONFIG_ENCRYPTION_KEY for encryption/decryption

---

## Provider Configuration

### Supported Providers

Amicus supports the following LLM providers:

| Provider | Package | Auth Type |
|----------|---------|-----------|
| OpenAI | `@ai-sdk/openai` | API Key |
| Anthropic | `@ai-sdk/anthropic` | API Key |
| Groq | `@ai-sdk/groq` | API Key |
| Moonshot | `@moonshot-ai/moonshot` | API Key |
| Minimax | `@minimax-ai/minimax` | API Key |
| OpenRouter | `@openrouter/ai-sdk-provider` | API Key |
| z.ai (Kimi) | `@ai-sdk/openai` (compatible) | API Key |
| z.ai (Coding) | `@ai-sdk/openai` (compatible) | API Key |
| z.ai (Coding Plan) | `@ai-sdk/openai` (compatible) | API Key |

### Example Configuration

```json
{
  "llm": {
    "providers": [
      {
        "id": "openai",
        "enabled": true,
        "package": "@ai-sdk/openai",
        "apiKey": "sk-your-openai-api-key"
      },
      {
        "id": "anthropic",
        "enabled": true,
        "package": "@ai-sdk/anthropic",
        "apiKey": "sk-ant-your-anthropic-api-key"
      }
    ],
    "defaultModel": "openai:gpt-4o-mini",
    "dailyBudget": 10,
    "budgetAlertThreshold": 0.8
  }
}
```

### OAuth Providers (Future)

Some providers may support OAuth authentication. When OAuth is configured:

```json
{
  "id": "google",
  "enabled": true,
  "package": "@ai-sdk/google",
  "accessToken": "enc:v1:...",
  "refreshToken": "enc:v1:...",
  "expiresAt": 1234567890,
  "scope": "openid profile email"
}
```

---

## Daemon Configuration

### Port Settings

```json
{
  "daemon": {
    "port": 3000
  }
}
```

Default port is 3000. Can be overridden with `PORT` environment variable.

---

## Admin Configuration

### Session Settings

```json
{
  "admin": {
    "sessionTtlSeconds": 1800,
    "password": "enc:v1:..."
  }
}
```

- `sessionTtlSeconds`: Admin session timeout (default: 1800 = 30 minutes)
- `password`: Admin password (automatically encrypted)

---

## MCP Configuration

### MCP Server Configuration

```json
{
  "mcp": {
    "configPath": "./data/mcp-servers.json"
  }
}
```

MCP (Model Context Protocol) server configuration is stored in a separate file. See `./data/mcp-servers.json` for details.

---

## Troubleshooting

### Daemon fails to start

**Error:** `CONFIG_ENCRYPTION_KEY missing or invalid`

**Solution:** Set the encryption key environment variable:
```bash
export CONFIG_ENCRYPTION_KEY="your-encryption-key-here"
```

### API keys not working

**Symptom:** Providers show as "unavailable" or authentication fails

**Checklist:**
1. Check if API key is properly set in `amicus.json`
2. Verify `CONFIG_ENCRYPTION_KEY` is set correctly
3. Check if provider is enabled: `"enabled": true`
4. Restart daemon after configuration changes

### How to rotate encryption key

**Current limitation:** Key rotation not supported in this version.

**Workaround:**
1. Backup current `amicus.json`
2. Extract plaintext API keys manually (requires old key)
3. Set new `CONFIG_ENCRYPTION_KEY`
4. Re-add API keys to `amicus.json` (will be encrypted with new key)
5. Restart daemon

---

## Best Practices

### Security

1. **Never commit secrets**: Add `.env` and `./data/amicus.json` to `.gitignore`
2. **Use strong encryption key**: Generate with `openssl rand -base64 32`
3. **Rotate keys regularly**: Although manual, rotate encryption keys periodically
4. **Restrict file permissions**: `chmod 600 ./data/amicus.json`

### Configuration Management

1. **Version control**: Keep a `amicus.example.json` template (no real keys)
2. **Documentation**: Document which API keys are required for your setup
3. **Backup**: Regularly backup `amicus.json` (encrypted storage only)

---

## Migration from Environment Variables

If you previously used environment variables for API keys (OPENAI_API_KEY, etc.), follow these steps:

### Step 1: Extract existing keys

```bash
echo "OpenAI: $OPENAI_API_KEY"
echo "Anthropic: $ANTHROPIC_API_KEY"
```

### Step 2: Add to amicus.json

Edit `./data/amicus.json`:

```json
{
  "llm": {
    "providers": [
      {
        "id": "openai",
        "enabled": true,
        "package": "@ai-sdk/openai",
        "apiKey": "sk-your-actual-openai-key"
      }
    ]
  }
}
```

### Step 3: Remove environment variables

Remove from `.env` or shell profile:
```bash
# No longer needed:
# export OPENAI_API_KEY="..."
# export ANTHROPIC_API_KEY="..."
```

### Step 4: Restart daemon

```bash
bun run --cwd apps/daemon dev
```

Amicus will automatically encrypt the plaintext keys on first read.

---

## Related Documentation

- [Development Workflow](WORKFLOW_KR.md)
- [Testing Guide](testing/interface-testing-guide.md)
- [Architecture Overview](../spec/architecture.md)
