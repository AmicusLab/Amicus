# Troubleshooting Guide

This document provides solutions for common issues when running Amicus.

## Quick Diagnostics

```bash
# Full system verification
bun run verify

# Check daemon health
curl http://localhost:3000/health

# Check all services status
curl http://localhost:3000/api/status
```

## Common Issues

### Daemon Won't Start

**Symptom:** Port 3000 is already in use

```bash
# Check what's using port 3000
lsof -i :3000

# Use a different port
PORT=3001 bun run --cwd apps/daemon dev
```

**Symptom:** Missing environment variables

```bash
# Copy example env file
cp .env.example .env

# Edit with your API keys
nano .env
```

**Symptom:** Build errors

```bash
# Clean and rebuild
rm -rf node_modules bun.lockb
bun install
bun run build
```

### Dashboard Can't Connect to Daemon

**Symptom:** Dashboard shows "Disconnected" status

```bash
# 1. Verify daemon is running
curl http://localhost:3000/health

# 2. Check daemon logs
bun run --cwd apps/daemon dev

# 3. Verify vite.config.ts proxy settings
# Should proxy /api to http://localhost:3000
```

**Symptom:** CORS errors in browser

```bash
# Dashboard uses Vite proxy in development
# Check vite.config.ts has:
# server: { proxy: { '/api': 'http://localhost:3000' } }
```

### CLI Runs in TTY Mode

**Symptom:** CLI shows interactive prompts instead of running task

```bash
# Force non-TTY mode
CI=true bun run --cwd apps/cli start

# Or use the task command directly
bun run --cwd apps/cli start --task "your task"
```

### Tests Fail

**Symptom:** `bun run verify` fails

```bash
# Run tests with verbose output
bun test --verbose

# Run specific test file
bun test apps/daemon/__tests__/api.test.ts

# Check for type errors
bun run typecheck
```

**Symptom:** MCP tests fail with connection errors

```bash
# MCP tests require filesystem server
# These errors are expected if server isn't running
# Tests will skip gracefully
```

### API Authentication Errors

**Symptom:** 401 Unauthorized errors

```bash
# If AMICUS_API_KEY is set, you must include:
# Authorization: Bearer <your-api-key>

# Example:
curl -H "Authorization: Bearer your-key" http://localhost:3000/api/status

# Or unset AMICUS_API_KEY to disable auth (development only)
unset AMICUS_API_KEY
```

### Budget Exceeded

**Symptom:** LLM requests fail with budget error

```bash
# Check current usage
curl http://localhost:3000/api/tokenomics

# Increase daily budget in .env
LLM_BUDGET_DAILY=20.00
```

### WebSocket Connection Issues

**Symptom:** Dashboard doesn't show real-time updates

```bash
# Check WebSocket endpoint
curl http://localhost:3000/ws

# Should return upgrade required (expected)
# Check browser console for WebSocket errors
```

## Known Issues

### MCP Server Connection

- **Issue:** MCP servers may fail to connect on first attempt
- **Workaround:** Retry logic is built-in, connections usually succeed on retry
- **Status:** Under investigation

### LLM Provider Loading

- **Issue:** Some providers fail to load if API key is missing
- **Workaround:** Set at least one provider's API key
- **Status:** Expected behavior - graceful degradation

### Memory File Permissions

- **Issue:** ContextManager may fail if `data/` directory is not writable
- **Workaround:** Ensure write permissions: `chmod -R 755 data/`
- **Status:** Expected behavior

## Debug Mode

Enable verbose logging:

```bash
# Debug level logging
DEBUG=* bun run --cwd apps/daemon dev

# Specific component debug
DEBUG=amicus:* bun run --cwd apps/daemon dev
```

## Getting Help

1. Check this troubleshooting guide
2. Review [Monitoring Guide](monitoring.md) for health checks
3. Check [API Reference](api-reference.md) for endpoint details
4. Review logs: `bun run --cwd apps/daemon dev 2>&1 | tee amicus.log`

## Reporting Issues

When reporting issues, include:

```bash
# System info
bun --version
node --version
uname -a

# Verification output
bun run verify 2>&1

# Health check
curl http://localhost:3000/health
curl http://localhost:3000/api/status
```
