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

### 2. 초기 설정 (최초 1회)

```bash
# 관리자 비밀번호 및 세션 시크릿 자동 생성
bun run init

# 생성된 .env 파일 확인
cat .env
```

**옵션:**
- `--dry-run`: 실제 변경 없이 미리보기
- `--force`: 기존 값 덮어쓰기
- `--password <pw>`: 특정 비밀번호 지정
- `--no-password`: 비밀번호 생성 생략

**예시:**
```bash
bun run init --dry-run        # 미리보기
bun run init --password admin123  # 특정 비밀번호 설정
```

### 3. 전체 시스템 구동

**터미널 1 - Daemon (필수)**
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

## z.ai Model Management

### GitHub Actions Weekly Validation

The repository includes an automated workflow that validates z.ai model availability weekly:

**Workflow**: `.github/workflows/validate-models.yml`
- **Schedule**: Every Sunday at 00:00 UTC
- **Manual Trigger**: Available via `workflow_dispatch`
- **Required Secret**: `ZAI_API_KEY` (set in GitHub repository settings)

**What it does**:
1. Runs `bun run validate:zai` with API key from secrets
2. Validates all 15 z.ai models using Tokenizer API
3. Updates `config/models/zai.json` with availability status
4. Creates a pull request if availability changes are detected

**Usage**:
```bash
# Manual validation
export ZAI_API_KEY="your-api-key"
bun run validate:zai
```

### Model API Endpoints

**Public endpoints**:
- `GET /api/models/zai` - List all models with availability
- `GET /api/models/zai/:id` - Get specific model details

**Admin endpoints**:
- `POST /admin/models/zai/refresh` - Refresh all model availability
- `POST /admin/models/zai/:id/validate` - Validate specific model

### Documentation

See `docs/implementation/zai-model-management.md` for complete documentation on:
- Architecture overview
- Model metadata (15 models)
- Availability tracking system
- Usage instructions

### 문제 해결

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

## Code Review

### CodeRabbit 한글 리뷰

이 프로젝트는 [CodeRabbit](https://coderabbit.ai)을 사용하여 Pull Request를 자동으로 한글로 리뷰합니다.

**주요 기능:**
- 🇰🇷 **한글 리뷰**: 모든 리뷰 코멘트가 한국어로 제공됩니다
- 🤖 **자동 리뷰**: PR 생성 시 자동으로 코드 분석 및 리뷰 수행
- 🛠️ **프로젝트 맞춤**: Bun, TypeScript, Hono, Lit 등 프로젝트 기술 스택에 최적화
- 📝 **경로별 가이드**: 각 디렉토리별 특화된 리뷰 가이드 적용

**설정:**
- 설정 파일: `.coderabbit.yaml`
- 리뷰 프로필: `chill` (친화적인 톤)
- 자동 리뷰: 활성화 (Draft/WIP 제외)

**사용법:**
1. PR 생성 시 자동으로 CodeRabbit이 리뷰를 시작합니다
2. 리뷰 코멘트에 답변하거나 수정할 수 있습니다
3. `@coderabbitai` 멘션으로 추가 질문 가능

**지원 도구:**
- ✅ GitHub Checks
- ✅ AST-grep (패턴 매칭)
- ✅ Biome (JS/TS 린팅)
- ✅ Markdownlint
- ✅ Shellcheck
- ✅ Yamllint

---

## 라이선스

MIT
