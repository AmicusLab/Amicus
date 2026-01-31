#!/usr/bin/env bash
set -euo pipefail

REPORT_DIR="reports"
REPORT_PATH="$REPORT_DIR/task-report.md"

mkdir -p "$REPORT_DIR"

{
  echo "# Task Report"
  echo
  echo "## Environment"
  echo
  echo "- Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'N/A')"
  echo "- Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'N/A')"
  echo "- Bun: $(bun --version 2>/dev/null || echo 'N/A')"
  echo "- Git: $(git --version 2>/dev/null || echo 'N/A')"
  echo
  echo "## Changes"
  echo
  echo "### git status"
  echo
  echo '```'
  git status --porcelain=v1 -b 2>/dev/null || true
  echo '```'
  echo
  echo "### git diff --stat"
  echo
  echo '```'
  git diff --stat 2>/dev/null || true
  echo '```'
  echo
  echo "## Verification"
  echo
  echo "Run: bun run verify"
  echo
  echo '```'
  set +e
  bun run verify 2>&1
  VERIFY_EXIT_CODE=$?
  set -e
  echo '```'
} > "$REPORT_PATH"

echo "Wrote $REPORT_PATH"

exit ${VERIFY_EXIT_CODE:-0}
