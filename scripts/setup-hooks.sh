#!/bin/bash
# Git hooks 설치 스크립트
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_SRC="$REPO_ROOT/scripts/hooks/pre-commit"
HOOK_DEST="$REPO_ROOT/.git/hooks/pre-commit"

mkdir -p "$REPO_ROOT/scripts/hooks"
cat > "$HOOK_SRC" << 'EOF'
#!/bin/bash
set -e
echo "🔍 Pre-commit checks..."

echo "  ▸ Typechecking..."
bun run typecheck 2>&1
echo "  ✅ Typecheck passed"

echo "  ▸ Building..."
bun run build 2>&1
echo "  ✅ Build passed"

echo "  ▸ Running tests..."
bun run test 2>&1
echo "  ✅ Tests passed"

echo "✅ All checks passed. Committing..."
EOF

chmod +x "$HOOK_SRC"
ln -sf "$HOOK_SRC" "$HOOK_DEST"
echo "✅ Git hooks installed. Pre-commit hook active."
