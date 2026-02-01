# Configuration

Amicus uses a split configuration model:

- **Non-secret configuration** lives in a JSON file: `data/config.json`
- **Secrets (API keys, tokens, admin password)** are never stored in plaintext JSON.
  - They are provided via environment variables (preferred for CI/ops) and/or
  - Persisted encrypted-at-rest in `data/secrets.enc.json` (daemon-only)

This design ensures the Dashboard (browser bundle) never ships or reads secrets.

---

## Non-Secret Config: `data/config.json`

This file is safe to view/edit. It must NOT contain:
- LLM API keys
- GitHub tokens
- Admin passwords

Typical fields:
- `daemon.port`
- `llm.defaultModel`, `llm.dailyBudget`, `llm.budgetAlertThreshold`
- `llm.providers[]` (enabled/disabled + package + envKey)
- `mcp.configPath`

Example:

```json
{
  "daemon": { "port": 3000 },
  "auth": { "enabled": false },
  "admin": { "sessionTtlSeconds": 1800 },
  "mcp": { "configPath": "./data/mcp-servers.json" },
  "llm": {
    "defaultModel": "anthropic:claude-3-5-sonnet-20241022",
    "dailyBudget": 10,
    "budgetAlertThreshold": 0.8,
    "providers": [
      { "id": "anthropic", "enabled": true, "package": "@ai-sdk/anthropic", "envKey": "ANTHROPIC_API_KEY" }
    ]
  }
}
```

Reload behavior:
- The daemon loads `data/config.json` at startup.
- Admins can reload or update config via admin endpoints (see below).

---

## Secrets: Environment Variables and Encrypted Store

### Environment Variables (Secrets)

Secrets can always be provided via environment variables.

Important:
- The Dashboard must NOT use `VITE_*` env vars for secrets.
- Secrets are read only by the daemon.

See `.env.example` for a full list.

### Encrypted Secrets: `data/secrets.enc.json`

When you update API keys at runtime via the admin API, they are persisted encrypted-at-rest.

Requirements:
- Set `CONFIG_ENCRYPTION_KEY` (a strong passphrase) before using runtime secret updates.

Notes:
- The encrypted file is daemon-only.
- Plaintext secrets are never written to JSON config.

---

## Admin API (Runtime Updates)

Admin endpoints are served under `/admin/*` and use an httpOnly session cookie.

### Pairing (no secrets in dashboard bundle)

On daemon startup, a pairing code is printed to the daemon logs.
Use it to create an admin session:

```bash
curl -s -X POST http://localhost:3000/admin/pair \
  -H 'Content-Type: application/json' \
  -d '{"code":"<PAIRING_CODE_FROM_DAEMON_LOG>"}' \
  -c cookies.txt
```

### Login (optional)

If `AMICUS_ADMIN_PASSWORD` is configured (env var or encrypted store):

```bash
curl -s -X POST http://localhost:3000/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"<ADMIN_PASSWORD>"}' \
  -c cookies.txt
```

### Update Provider API Key (persisted encrypted)

```bash
curl -s -X POST http://localhost:3000/admin/providers/anthropic/apikey \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"apiKey":"sk-ant-..."}'
```

### Disable / Unlink Provider

Disable:

```bash
curl -s -X PATCH http://localhost:3000/admin/providers/anthropic \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"enabled":false}'
```

Unlink (disable + delete persisted key):

```bash
curl -s -X DELETE http://localhost:3000/admin/providers/anthropic/unlink \
  -b cookies.txt
```

### Update Non-Secret Config

```bash
curl -s -X PATCH http://localhost:3000/admin/config \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{"llm":{"dailyBudget":20}}'
```

### Audit Log

The daemon writes admin audit events as JSONL files under:
- `data/audit/admin-YYYY-MM-DD.jsonl`

You can query recent events:

```bash
curl -s http://localhost:3000/admin/audit?limit=50 \
  -b cookies.txt
```
