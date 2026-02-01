# Deployment Guide

This document describes how to deploy and run Amicus in production mode.

## Prerequisites

- [Bun](https://bun.sh) runtime (v1.3.5 or later)
- Node.js-compatible environment
- Git (for cloning)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd amicus

# Install dependencies
bun install
```

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-api03-...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `GOOGLE_API_KEY` | Google AI API key | `...` |
| `AMICUS_API_KEY` | API authentication key (optional) | `your-secret-key` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_BUDGET_DAILY` | Daily LLM budget limit | `10.00` |
| `LLM_BUDGET_ALERT_THRESHOLD` | Budget alert threshold (0-1) | `0.8` |
| `LLM_DEFAULT_MODEL` | Default LLM model | `anthropic:claude-3-5-sonnet-20241022` |
| `GITHUB_TOKEN` | GitHub token for MCP | - |
| `MCP_CONFIG_PATH` | MCP servers config path | `./data/mcp-servers.json` |

## Production Deployment

### 1. Build All Applications

```bash
bun run build
```

This builds:
- `apps/daemon` - Production server bundle
- `apps/dashboard` - Static web assets
- `apps/cli` - CLI bundle
- All packages

### 2. Start Daemon (Required)

```bash
# Production mode
bun run --cwd apps/daemon start

# Or with explicit production env
NODE_ENV=production bun run --cwd apps/daemon start
```

Daemon will start on port 3000 by default.

### 3. Serve Dashboard (Optional)

The dashboard is built as static files:

```bash
# Using Vite preview
bun run --cwd apps/dashboard preview

# Or serve with any static file server
cd apps/dashboard/dist
python3 -m http.server 5173
```

### 4. Health Check

```bash
# Check daemon health
curl http://localhost:3000/health

# Expected response
{"status":"healthy","timestamp":1700000000000}
```

## Docker Deployment (Future)

```dockerfile
FROM oven/bun:1.3.5

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "--cwd", "apps/daemon", "start"]
```

## Systemd Service (Linux)

Create `/etc/systemd/system/amicus.service`:

```ini
[Unit]
Description=Amicus Daemon
After=network.target

[Service]
Type=simple
User=amicus
WorkingDirectory=/opt/amicus
Environment=NODE_ENV=production
EnvironmentFile=/opt/amicus/.env
ExecStart=/usr/local/bin/bun run --cwd apps/daemon start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable amicus
sudo systemctl start amicus
sudo systemctl status amicus
```

## Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name amicus.local;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Security Checklist

- [ ] Set strong `AMICUS_API_KEY` for production
- [ ] Use HTTPS in production
- [ ] Restrict firewall rules (port 3000)
- [ ] Regularly rotate API keys
- [ ] Monitor logs for unauthorized access

## Verification

```bash
# Full system verification
bun run verify

# Check all services
curl http://localhost:3000/health
curl http://localhost:3000/api/status
```
