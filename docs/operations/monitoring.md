# Monitoring Guide

This document describes how to monitor Amicus system health, logs, and metrics.

## Health Checks

### Daemon Health Endpoint

```bash
# Basic health check
curl http://localhost:3000/health

# Response
{
  "status": "healthy",
  "timestamp": 1700000000000
}

# Detailed health check
curl http://localhost:3000/health/detailed

# Response
{
  "status": "healthy",
  "components": {
    "daemon": "running",
    "websocket": "connected",
    "mcp": "connected"
  },
  "timestamp": 1700000000000
}
```

### System Status

```bash
# Get full system status
curl http://localhost:3000/api/status

# Response includes:
# - System health
# - Running tasks count
# - Connected clients
# - Uptime
```

## Logs

### Application Logs

Logs are output to stdout/stderr by default. In production, configure log aggregation:

```bash
# Run with log file
bun run --cwd apps/daemon start 2>> /var/log/amicus/error.log 1>> /var/log/amicus/app.log

# Using systemd (logs to journald)
journalctl -u amicus -f
```

### Log Levels

The daemon uses `hono/logger` middleware for HTTP request logging:

```
<-- GET /health
--> GET /health 200 1ms
<-- POST /api/tasks/emergency-stop
--> POST /api/tasks/emergency-stop 200 5ms
```

### Structured Logging (Future)

When structured JSON logging is implemented:

```bash
# Logs will be in JSON format
{"level":"info","timestamp":"2024-01-01T00:00:00Z","message":"Task completed","taskId":"task-1"}
```

## Tokenomics Monitoring

### Budget Tracking

```bash
# Get current tokenomics
curl http://localhost:3000/api/tokenomics

# Response
{
  "success": true,
  "data": {
    "spent": 2.50,
    "budget": 10.00,
    "remaining": 7.50,
    "requests": 150,
    "averageCost": 0.0167,
    "budgetUsedPercent": 25.0,
    "status": "normal"
  }
}
```

### Budget Alerts

Budget status levels:
- `normal` - < 80% of budget used
- `warning` - 80-100% of budget used
- `exceeded` - > 100% of budget used

Dashboard shows visual alerts when budget exceeds threshold.

## WebSocket Monitoring

### Connection Status

Dashboard shows real-time connection status:
- 🟢 Connected - WebSocket connection active
- 🔴 Disconnected - WebSocket connection lost

### Client Count

```bash
# WebSocket endpoint shows connected clients
wscat -c ws://localhost:3000/ws

# Server broadcasts client count on connect/disconnect
```

## Task Monitoring

### Running Tasks

```bash
# Get all tasks
curl http://localhost:3000/api/tasks

# Response
{
  "success": true,
  "data": {
    "scheduled": [...],
    "running": ["task-1", "task-2"],
    "count": {
      "scheduled": 5,
      "running": 2
    }
  }
}
```

### Task Actions

Available actions via API:
- `POST /api/tasks/:id/pause` - Pause a running task
- `POST /api/tasks/:id/resume` - Resume a paused task
- `POST /api/tasks/:id/cancel` - Cancel a task
- `POST /api/tasks/emergency-stop` - Cancel all running tasks

## MCP Server Status

```bash
# Get MCP server status
curl http://localhost:3000/api/mcp-servers

# Response
{
  "success": true,
  "data": [
    {
      "id": "filesystem",
      "name": "Secure MCP Filesystem Server",
      "status": "connected",
      "tools": 14
    }
  ]
}
```

## LLM Provider Status

```bash
# Get LLM provider status
curl http://localhost:3000/api/llm-providers

# Response
{
  "success": true,
  "data": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "status": "available",
      "models": [...]
    }
  ]
}
```

## Metrics Collection (Future)

Planned metrics:
- Request latency (p50, p95, p99)
- Task execution time
- Error rates
- MCP tool usage
- LLM token consumption

## Alerting (Future)

Recommended alerts:
- Daemon down
- Budget threshold exceeded
- High error rate
- MCP server disconnected
- Disk space low

## Dashboard Monitoring

The Dashboard provides visual monitoring:
- System health indicator
- Budget usage gauge
- Running tasks list
- Connected clients count
- Real-time thought stream
- MCP server status

Access at: http://localhost:5173
