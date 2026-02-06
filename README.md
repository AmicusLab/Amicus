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

## CLI Chat 명령어

**대화형 AI 챗봇 (Vertical Slice 구현)**

Amicus는 CLI를 통해 LLM과 대화하고 도구를 실행할 수 있는 대화형 인터페이스를 제공합니다.

### 사용법

```bash
# Terminal 1: Daemon 실행 (필수)
bun run --cwd apps/daemon dev

# Terminal 2: CLI Chat 시작
bun run --cwd apps/cli start chat
```

### 기능

- **LLM 대화**: Claude, GPT 등 설정된 LLM과 자연어 대화
- **파일 생성**: "Create file test.txt with content: Hello" 형태의 명령으로 파일 자동 생성
- **Git 안전장치**: 파일 생성 전 자동 git commit (변경사항 보호)
- **대화 히스토리**: 최근 5개 메시지 표시 (인메모리)

### 예시

```
Session: a1b2c3d4

You: Hello
Amicus: Hello! I'm Amicus, your local-first AI assistant. How can I help you today?

You: Create file test.txt with content: Hello World
Amicus: I've created the file test.txt with the content "Hello World".

You: exit
Goodbye!
```

### 필수 설정

LLM API 키가 환경변수로 설정되어 있어야 합니다:

```bash
# Anthropic Claude
export ANTHROPIC_API_KEY="your-api-key"

# 또는 OpenAI
export OPENAI_API_KEY="your-api-key"
```

### 제약사항

- 단일 도구만 지원: `write_file` (파일 쓰기)
- 요청당 1회 도구 호출만 가능 (순차 호출 불가)
- 대화 히스토리는 메모리에만 저장 (재시작 시 초기화)

자세한 내용은 [Vertical Slice 문서](docs/implementation/vertical-slice.md)를 참고하세요.

---

## Safety: Git 기반 안전장치

Amicus는 파일을 변경하는 도구 실행 전 자동으로 Git 스냅샷을 생성하여, 실수로 파일을 망가뜨려도 되돌릴 수 있습니다.

### 자동 스냅샷

도구 실행 시 자동으로 Git 커밋이 생성됩니다:
- `create_file`: 파일 생성 전 스냅샷
- `edit_file`: 파일 수정 전 스냅샷
- `delete_file`: 파일 삭제 전 스냅샷

읽기 전용 도구 (read_file 등)는 스냅샷을 건너뛰어 성능을 최적화합니다.

### Undo 기능

CLI에서 `/undo` 명령으로 직전 상태로 복구:

```bash
You: Create file test.txt with content: Hello
Amicus: Successfully created file test.txt

You: /undo
Amicus: ✅ 성공적으로 이전 상태로 되돌렸습니다.
```

### 제약사항

- 단일 undo만 지원 (한 번에 한 단계만 되돌리기)
- Git 레포지토리가 없으면 자동으로 초기화됩니다

자세한 내용은 [Vertical Slice 3 구현 문서](docs/implementation/vertical-slice-3-safety.md)를 참고하세요.

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

## 라이선스

MIT
