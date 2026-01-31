#!/usr/bin/env bash
set -euo pipefail

REPORT_DIR="reports"
REPORT_PATH="$REPORT_DIR/phase3-report.md"

mkdir -p "$REPORT_DIR"

run_section() {
  local title="$1"
  shift

  echo "## ${title}"
  echo
  echo '```'
  set +e
  "$@" 2>&1
  local code=$?
  set -e
  echo '```'
  echo
  echo "Exit Code: ${code}"
  echo
  return 0
}

{
  echo "# Phase 3 Verification Report"
  echo
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo

  echo "## Environment"
  echo
  echo "- Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'N/A')"
  echo "- Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
  echo "- Bun: $(bun --version 2>/dev/null || echo 'N/A')"
  echo "- Node: $(node --version 2>/dev/null || echo 'N/A')"
  echo "- Git: $(git --version 2>/dev/null || echo 'N/A')"
  echo

  echo "## Phase 3 Scope (Spec Alignment Notes)"
  echo
  echo "- Phase 3 targets: packages/core (RoutineEngine, Planner, LLM Router) + packages/mcp-client (MCP client)."
  echo "- NOTE: packages/safety (SafetyExecutor) has been removed in this repo; execution safety is now injected via OperationExecutor."
  echo

  run_section "Repo Layout" ls -la packages scripts
  run_section "Key Packages" ls -la packages/core packages/mcp-client packages/types packages/memory

  run_section "Build" bun run build
  run_section "Tests" bun test
  run_section "Coverage" bun test --coverage
  run_section "Demo (Visual)" bun run scripts/demo.ts
} > "$REPORT_PATH"

echo "Wrote $REPORT_PATH"
