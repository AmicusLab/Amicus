# Amicus

**Local-First, Trust-Based Autonomous OS Layer**

Amicus는 사용자의 로컬 환경에서 자율적으로 업무를 수행하는 개인 AI 비서입니다.

---

## 시스템 아키텍처

### 계층 구조

| 계층 | 컴포넌트 | 기술 스택 | 포트/경로 |
|------|---------|----------|----------|
| **Interface Layer** | Dashboard (Web) | Lit + Signals | http://localhost:5173 |
| | CLI (Terminal) | React Ink | 터미널 |
| **Service Layer** | Daemon (Server) | Hono + WebSocket | http://localhost:3000 |
| **Core Layer** | RoutineEngine, Planner, Economist | Bun + TypeScript | - |
| | Memory | ContextManager | - |
| | MCP-Client | External Tools | - |

### 데이터 흐름

```
[User] → [Dashboard/CLI] → [Daemon API/WebSocket] → [Core Engine]
                                          ↓
                                    [Memory/MCP-Client]
```

### 의존성

- Dashboard → Daemon (REST API + WebSocket)
- CLI → Daemon (REST API)
- Daemon → Core, Memory, MCP-Client
- 모든 앱은 Daemon이 실행 중일 때만 정상 동작

---

## 빠른 시작

### 1. 의존성 설치

```bash
bun install
```

### 2. 전체 시스템 구동

**터미inal 1 - Daemon (필수)**
```bash
bun run --cwd apps/daemon dev
```

**터미널 2 - Dashboard (선택)**
```bash
bun run --cwd apps/dashboard dev
```

**터미널 3 - CLI (선택)**
```bash
bun run --cwd apps/cli start
```

### 3. 접속 확인

| 서비스 | URL | 설명 |
|--------|-----|------|
| Daemon Health | http://localhost:3000/health | 서버 상태 확인 |
| Dashboard | http://localhost:5173 | 웹 대시보드 |
| API Docs | http://localhost:3000/api | REST API |

---

## 루트에서 한 번에 구동 (개발용)

### 방법 1: Concurrently 사용 (권장)

```bash
# concurrently 설치
bun add -d concurrently

# package.json에 스크립트 추가
```json
{
  "scripts": {
    "dev": "concurrently \"bun run --cwd apps/daemon dev\" \"bun run --cwd apps/dashboard dev\"",
    "dev:all": "concurrently \"bun run --cwd apps/daemon dev\" \"bun run --cwd apps/dashboard dev\" \"sleep 5 && bun run --cwd apps/cli start\""
  }
}
```

```bash
# 실행
bun run dev        # daemon + dashboard
bun run dev:all    # daemon + dashboard + cli
```

### 방법 2: Bun의 동시 실행

```bash
# package.json에 스크립트 추가
```json
{
  "scripts": {
    "start:daemon": "bun run --cwd apps/daemon start",
    "start:dashboard": "bun run --cwd apps/dashboard preview",
    "start:all": "bun run start:daemon & bun run start:dashboard & wait"
  }
}
```

```bash
# 실행
bun run start:all
```

### 방법 3: Procfile (Heroku 스타일)

```bash
# Procfile.dev 생성
echo "daemon: bun run --cwd apps/daemon dev" > Procfile.dev
echo "dashboard: bun run --cwd apps/dashboard dev" >> Procfile.dev
echo "cli: sleep 5 && bun run --cwd apps/cli start" >> Procfile.dev

# foreman 또는 overmind 설치 필요
# gem install foreman
foreman start -f Procfile.dev
```

---

## 개발 워크플로우

### 코드 검증

```bash
# 전체 검증 (typecheck + build + test)
bun run verify

# 인터페이스 테스트만
bun run test:interface

# E2E 테스트 (로컬 전용)
bun run test:e2e
```

### 개발 순서

1. **Daemon 먼저 실행** (필수)
   ```bash
   bun run --cwd apps/daemon dev
   ```

2. **Dashboard 또는 CLI 실행** (선택)
   ```bash
   # 웹 대시보드
   bun run --cwd apps/dashboard dev
   
   # 또는 터미널 UI
   bun run --cwd apps/cli start
   ```

3. **변경 사항 확인**
   - Dashboard: http://localhost:5173
   - CLI: 터미널 출력 확인

---

## 환경 변수

```bash
# Daemon 포트 (기본: 3000)
export PORT=3000

# Dashboard 개발 서버 포트 (기본: 5173)
# vite.config.ts에서 설정

# CLI API 엔드포인트 (기본: http://localhost:3000)
export AMICUS_API_URL=http://localhost:3000
```

---

## 프로젝트 구조

```
.
├── apps/
│   ├── daemon/          # 백그라운드 서버 (Hono + WebSocket)
│   ├── dashboard/       # 웹 대시보드 (Lit + Signals)
│   └── cli/             # 터미널 UI (React Ink)
├── packages/
│   ├── core/            # RoutineEngine, Planner, Economist
│   ├── memory/          # ContextManager
│   ├── mcp-client/      # MCP 클라이언트
│   └── types/           # 공용 타입
├── docs/
│   ├── implementation/  # 구현 문서
│   └── testing/         # 테스트 가이드
└── spec/                # 프로젝트 스펙
```

---

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `bun run verify` | 전체 검증 (typecheck + build + test) |
| `bun run test:interface` | Daemon + CLI 테스트 |
| `bun run test:e2e` | Dashboard E2E 테스트 (로컬) |
| `bun run report` | 작업 리포트 생성 |

---

## 문제 해결

### Daemon이 시작되지 않음

```bash
# 포트 확인
lsof -i :3000

# 또는 다른 포트 사용
PORT=3001 bun run --cwd apps/daemon dev
```

### Dashboard가 Daemon에 연결되지 않음

```bash
# Daemon이 먼저 실행되었는지 확인
curl http://localhost:3000/health

# vite.config.ts의 proxy 설정 확인
```

### CLI가 TTY 모드로 실행됨

```bash
# 비-TTY 모드로 강제
CI=true bun run --cwd apps/cli start
```

---

## 문서

- [개발 워크플로우](docs/WORKFLOW_KR.md)
- [인터페이스 테스트 가이드](docs/testing/interface-testing-guide.md)
- [Phase 4 구현 계획](docs/implementation/phase4-interface-layer.md)

---

## 라이선스

MIT
