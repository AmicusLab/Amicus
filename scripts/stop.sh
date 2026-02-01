#!/bin/bash

# Amicus 종료 스크립트
# 모든 Amicus 관련 프로세스를 찾아 종료합니다

echo "🛑 Stopping Amicus services..."

# 1. Daemon 프로세스 종료
echo "  → Stopping daemon..."
pkill -f "bun run --cwd apps/daemon" 2>/dev/null
pkill -f "bun run src/index.ts" 2>/dev/null

# 2. Dashboard 프로세스 종료
echo "  → Stopping dashboard..."
pkill -f "bun run --cwd apps/dashboard" 2>/dev/null
pkill -f "vite" 2>/dev/null

# 3. CLI 프로세스 종료
echo "  → Stopping CLI..."
pkill -f "bun run --cwd apps/cli" 2>/dev/null

# 4. MCP 서버 프로세스 종료
echo "  → Stopping MCP servers..."
pkill -f "mcp-server-filesystem" 2>/dev/null
pkill -f "mcp-server-github" 2>/dev/null
pkill -f "@modelcontextprotocol/server-filesystem" 2>/dev/null
pkill -f "@modelcontextprotocol/server-github" 2>/dev/null

# 5. Concurrently 프로세스 종료
echo "  → Stopping concurrently..."
pkill -f "concurrently" 2>/dev/null

# 6. 포트 사용 확인 및 종료
echo "  → Checking ports..."
for port in 3000 5173 5174; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "    Killing process on port $port (PID: $pid)"
    kill -9 $pid 2>/dev/null
  fi
done

# 7. 잠시 대기 후 확인
sleep 2

echo ""
echo "✅ Amicus services stopped"
echo ""

# 남은 프로세스 확인
remaining=$(pgrep -f "bun run --cwd apps/(daemon|dashboard|cli)" | wc -l)
if [ "$remaining" -gt 0 ]; then
  echo "⚠️  Warning: $remaining process(es) may still be running"
  echo "   Run 'ps aux | grep bun' to check"
else
  echo "✓ All processes cleaned up"
fi
