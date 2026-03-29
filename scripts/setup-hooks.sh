#!/bin/bash
# Git hooks 설치 스크립트
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_SRC="$REPO_ROOT/scripts/hooks/pre-commit"
HOOK_DEST="$REPO_ROOT/.git/hooks/pre-commit"

if [ ! -f "$HOOK_SRC" ]; then
  echo "❌ Error: Pre-commit hook not found at $HOOK_SRC"
  exit 1
fi

ln -sf "$HOOK_SRC" "$HOOK_DEST"
echo "✅ Git hooks installed. Pre-commit hook active."
