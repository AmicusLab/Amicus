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

### Severity Legend

| Severity | Description | Action Required |
|----------|-------------|-----------------|
| **Critical** | System unusable, immediate fix required | Stop and fix immediately |
| **High** | Major functionality impaired | Fix before continuing work |
| **Medium** | Workaround available, partial impact | Address when convenient |
| **Low** | Minor inconvenience, cosmetic | Fix at leisure |

---

### [HIGH] MCP Server Connection Errors

**Symptom:** MCP tests fail with connection errors, external tools unavailable

**Log Example:**
```
[ERROR] MCP connection failed: Error: connect ECONNREFUSED 127.0.0.1:3001
[WARN]  Retrying connection (attempt 2/5)...
```

**Root Cause:**
- MCP 서버가 아직 시작되지 않음
- 네트워크 연결 문제
- MCP 서버 프로세스가 크래시됨

**Solution:**
1. MCP 서버가 실행 중인지 확인
   ```bash
   ps aux | grep mcp
   ```
2. Daemon 로그에서 MCP 초기화 확인
   ```bash
   bun run --cwd apps/daemon dev 2>&1 | grep -i mcp
   ```
3. 수동으로 MCP 서버 재시작
   ```bash
   # Daemon 재시작 (MCP 서버도 함께 재시작됨)
   pkill -f "apps/daemon"
   bun run --cwd apps/daemon dev
   ```

**Prevention:**
- Daemon 시작 시 MCP 서버 자동 시작 확인
- Health check 엔드포인트로 MCP 상태 모니터링
- `bun run verify`로 MCP 연결 테스트

---

### [MEDIUM] LLM Provider Loading Failures

**Symptom:** Some LLM providers fail to load, limited model availability

**Log Example:**
```
[WARN]  Provider 'openai' failed to load: API key not found
[INFO]  Provider 'anthropic' loaded successfully
[WARN]  Only 1/3 providers available
```

**Root Cause:**
- API 키가 설정되지 않음
- `.env` 파일 누락 또는 잘못된 설정
- 지원되지 않는 provider 설정

**Solution:**
1. 환경 변수 확인
   ```bash
   cat .env | grep -E "(OPENAI|ANTHROPIC|GOOGLE)"
   ```
2. `.env` 파일 생성/수정
   ```bash
   cp .env.example .env
   nano .env
   ```
3. 최소 하나의 provider API 키 설정
   ```bash
   # OpenAI 예시
   OPENAI_API_KEY=sk-...
   ```

**Prevention:**
- `bun run init`로 초기 설정 완료
- `.env.example` 참고하여 필수 키 확인
- 여러 provider 설정으로 fallback 확보

---

### [CRITICAL] ContextManager File Permission Errors

**Symptom:** ContextManager fails, memory operations fail, data loss risk

**Log Example:**
```
[ERROR] ContextManager: EACCES: permission denied, open 'data/memory.json'
[FATAL] Failed to initialize memory system
[ERROR] Cannot write to data/ directory
```

**Root Cause:**
- `data/` 디렉토리에 쓰기 권한 없음
- 디렉토리 소유자가 현재 사용자와 다름
- 디스크 공간 부족

**Solution:**
1. 권한 확인 및 수정
   ```bash
   # 현재 권한 확인
   ls -la data/
   
   # 쓰기 권한 추가
   chmod -R 755 data/
   
   # 소유자 변경 (필요시)
   sudo chown -R $(whoami) data/
   ```
2. 디스크 공간 확인
   ```bash
   df -h
   ```
3. 데이터 디렉토리 재생성
   ```bash
   mkdir -p data/
   chmod 755 data/
   ```

**Prevention:**
- 프로젝트 클론 후 `bun run init` 실행
- 정기적으로 `data/` 권한 확인
- 백업 스크립트로 데이터 보호

---

### [HIGH] Bun Windows CMD Crash (Issue #26530)

**Symptom:** Bun crashes with `panic: index out of bounds` on Windows CMD

**Log Example:**
```
panic: index out of bounds
C:\bun\src\bun.js\webcore\streams.zig:1234:56
???:?:?: 0x7ff6... in ??? (bun.exe)
```

**Root Cause:**
- Bun v1.1.x의 Windows CMD 호환성 버그 ([oven-sh/bun#26530](https://github.com/oven-sh/bun/issues/26530))
- 터미널 출력 버퍼 관리 문제

**Solution:**
1. **권장: Windows Terminal 사용**
   ```powershell
   # Windows Terminal에서 실행
   wt bun run --cwd apps/daemon dev
   ```

2. **PowerShell 사용**
   ```powershell
   # PowerShell 7+ 권장
   pwsh -c "bun run --cwd apps/daemon dev"
   ```

3. **Git Bash 사용**
   ```bash
   # Git for Windows 포함
   "C:\Program Files\Git\bin\bash.exe" -c "bun run --cwd apps/daemon dev"
   ```

**Prevention:**
- Windows 개발 시 Windows Terminal 필수 사용
- CI/CD에서는 PowerShell Core 사용
- Bun 업데이트로 버그 수정 확인

**Workaround:**
- 개발 환경을 WSL2로 마이그레이션
- Docker Desktop + Dev Containers 사용

---

### [MEDIUM] React Ink React 19 Compatibility

**Symptom:** CLI shows warnings or errors about React version incompatibility

**Log Example:**
```
[warn] React Ink requires React ^18.0.0
[warn] Current React version: 19.0.0
[error] Cannot read properties of undefined (reading 'useState')
```

**Root Cause:**
- React Ink가 React 19를 아직 공식 지원하지 않음
- Peer dependency 충돌

**Solution:**
1. React 버전 확인
   ```bash
   bun list react | grep react
   ```

2. React 18로 다운그레이드 (필요시)
   ```bash
   bun install react@^18.0.0 react-dom@^18.0.0
   ```

3. 강제 설치 (경고 무시)
   ```bash
   # package.json에 overrides 추가
   {
     "overrides": {
       "react": "^19.0.0",
       "react-dom": "^19.0.0"
     }
   }
   ```

**Prevention:**
- `package.json`에서 React 버전 고정
- React Ink 업데이트 확인
- CLI 테스트로 호환성 검증

**Status:** React Ink 팀에서 React 19 지원 작업 중

---

## Quick Diagnostic Checklist

### Before Reporting Issues

- [ ] `bun --version` 확인 (권장: 1.1.0+)
- [ ] `bun run verify` 실행 결과 확인
- [ ] `.env` 파일 존재 및 설정 확인
- [ ] `data/` 디렉토리 권한 확인 (`ls -la data/`)
- [ ] 포트 충돌 확인 (`lsof -i :3000`)

### Daemon Issues

- [ ] Health check: `curl http://localhost:3000/health`
- [ ] Status check: `curl http://localhost:3000/api/status`
- [ ] 로그 확인: `bun run --cwd apps/daemon dev 2>&1 | tee daemon.log`
- [ ] 다른 포트 테스트: `PORT=3001 bun run --cwd apps/daemon dev`

### Dashboard Issues

- [ ] Daemon이 먼저 실행 중인지 확인
- [ ] Vite proxy 설정 확인 (`vite.config.ts`)
- [ ] 브라우저 콘솔 에러 확인
- [ ] `bun run --cwd apps/dashboard build` 성공 여부

### CLI Issues

- [ ] TTY 모드 확인: `CI=true`로 비대화형 테스트
- [ ] React 버전 호환성 확인
- [ ] Windows Terminal 사용 (Windows 개발자)

### Test Failures

- [ ] 단일 테스트 실행: `bun test <specific-file>`
- [ ] Verbose 모드: `bun test --verbose`
- [ ] Type errors: `bun run typecheck`
- [ ] MCP 서버 상태 확인

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
