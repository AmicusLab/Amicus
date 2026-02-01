# API Reference

This document describes the Amicus Daemon REST API endpoints.

**Base URL:** `http://localhost:3000`

**Authentication:** Optional Bearer token (if `AMICUS_API_KEY` is set)
```
Authorization: Bearer <your-api-key>
```

---

## Health Endpoints

### GET /health

Basic health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1700000000000
}
```

### GET /health/detailed

Detailed health check with component status.

**Response:**
```json
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

---

## System Status

### GET /api/status

Get full system status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 3600,
    "version": "0.1.0"
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": 1700000000000,
    "duration": 0
  }
}
```

---

## Task Management

### GET /api/tasks

List all tasks.

**Response:**
```json
{
  "success": true,
  "data": {
    "scheduled": [
      {
        "taskId": "task-1",
        "cronExpression": "0 0 * * *"
      }
    ],
    "running": ["task-2"],
    "count": {
      "scheduled": 1,
      "running": 1
    }
  }
}
```

### POST /api/tasks/:id/pause

Pause a running task.

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "task-1",
    "action": "paused"
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task task-1 not found or not running"
  }
}
```

### POST /api/tasks/:id/resume

Resume a paused task.

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "task-1",
    "action": "resumed"
  }
}
```

### POST /api/tasks/:id/cancel

Cancel a running or scheduled task.

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "task-1",
    "action": "cancelled"
  }
}
```

### POST /api/tasks/emergency-stop

Cancel all running tasks (emergency stop).

**Response:**
```json
{
  "success": true,
  "data": {
    "action": "emergency_stop",
    "cancelledCount": 2,
    "cancelledIds": ["task-1", "task-2"]
  }
}
```

---

## Tokenomics

### GET /api/tokenomics

Get current tokenomics/budget status.

**Response:**
```json
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

**Status values:**
- `normal` - Budget usage < 80%
- `warning` - Budget usage 80-100%
- `exceeded` - Budget usage > 100%

---

## LLM Providers

### GET /api/llm-providers

List configured LLM providers.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "status": "available",
      "models": [
        {
          "id": "claude-3-5-sonnet-20241022",
          "name": "Claude 3.5 Sonnet"
        }
      ]
    }
  ]
}
```

---

## MCP Servers

### GET /api/mcp-servers

List connected MCP servers.

**Response:**
```json
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

---

## WebSocket

### GET /ws

WebSocket endpoint for real-time updates.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
```

**Events:**

| Event | Description |
|-------|-------------|
| `connect` | Client connected |
| `disconnect` | Client disconnected |
| `heartbeat` | Server heartbeat |
| `taskStarted` | Task started |
| `taskCompleted` | Task completed |
| `taskFailed` | Task failed |
| `taskStatusChanged` | Task status changed |

**Message Format:**
```json
{
  "type": "heartbeat",
  "payload": {
    "timestamp": 1700000000000,
    "clients": 5
  },
  "timestamp": 1700000000000,
  "correlationId": "uuid"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": 1700000000000,
    "duration": 0
  }
}
```

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 401 | Unauthorized - Missing or invalid API key |
| 404 | Not Found - Task or resource not found |
| 500 | Internal Server Error |

---

## Rate Limits

Currently no rate limits are enforced. Future versions may implement:
- Per-client request limits
- Budget-based throttling
- Concurrent task limits

---

## Examples

### cURL Examples

```bash
# Health check
curl http://localhost:3000/health

# Get tasks with auth
curl -H "Authorization: Bearer my-key" http://localhost:3000/api/tasks

# Emergency stop
curl -X POST http://localhost:3000/api/tasks/emergency-stop

# Pause a task
curl -X POST http://localhost:3000/api/tasks/task-1/pause
```

### JavaScript Examples

```javascript
// Get status
const status = await fetch('http://localhost:3000/api/status')
  .then(r => r.json());

// Cancel task with auth
const result = await fetch('http://localhost:3000/api/tasks/task-1/cancel', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer my-key'
  }
}).then(r => r.json());
```
