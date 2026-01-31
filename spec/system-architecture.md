# Amicus System Architecture

## 1. 아키텍처 개요 (Overview)

### 계층 구조

| 계층 | 패키지/앱 | 역할 | 기술 스택 |
|------|----------|------|----------|
| **Interface Layer** | `apps/cli` | 터미널 UI | React Ink |
| | `apps/dashboard` | 웹 대시보드 | Lit + Signals |
| **Orchestration Layer** | `apps/daemon` | 백그라운드 서버 | Hono + WebSocket |
| **Core Intelligence** | `packages/core` | 에이전트 두뇌 | Bun + TypeScript |
| **Safety Layer** | `packages/safety` | 파일 시스템 보호 | simple-git |
| **Persistence** | `packages/memory` | 컨텍스트 관리 | Markdown |
| **Capability** | `packages/mcp-client` | 외부 도구 연결 | MCP Protocol |

### 컴포넌트 관계도

```
                         ┌─────────────────┐
                         │  User/Developer │
                         └────────┬────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │   apps/cli      │  │ apps/dashboard  │  │  External IDE   │
    │  (Terminal UI)  │  │   (Web UI)      │  │   (ACP Client)  │
    └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
             │                    │                    │
             └────────────────────┼────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │     apps/daemon         │
                    │   (Hono HTTP Server)    │
                    │   (WebSocket Server)    │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │ packages/core   │ │ packages/memory │ │packages/mcp-cli-│
    │  - RoutineEngine│ │  - ContextManager│ │ent              │
    │  - Planner      │ │  - NOW.md       │ │  - Tool Registry│
    │  - Economist    │ │  - MEMORY.md    │ │  - External APIs│
    └─────────────────┘ └─────────────────┘ └─────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │    File System / Git    │
                    │    (Safety Layer)       │
                    └─────────────────────────┘
```

---

## 2. 계층별 상세 설명 (Layer Details)

### 2.1 Interface Layer (`apps/cli`, `apps/dashboard`)

**역할:** 사용자와의 접점. 상태 모니터링 및 즉각적인 명령 전달.

**기술:**
- CLI: React Ink
- Dashboard: Lit + Signals

**주요 기능:**
- 실시간 "생각(Thought)" 스트리밍 표시
- 중요 의사결정에 대한 사용자 승인(Human-in-the-loop) UI
- 현재 Routine 상태 시각화

**통신:**
- REST API: `http://localhost:3000/api/*`
- WebSocket: `ws://localhost:3000/ws`

### 2.2 Orchestration Layer (`apps/daemon`)

**역할:** 시스템의 심장. 멈추지 않고 루틴을 점검하고 이벤트를 처리.

**기술:** Bun, Hono, WebSocket

**주요 기능:**
- `cron` 스타일의 정기 작업 스케줄링
- IDE나 OS로부터 오는 ACP 요청 수신
- Core 로직 구동 및 생명주기 관리

**엔드포인트:**
| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 헬스체크 |
| GET | `/api/status` | 시스템 상태 |
| GET | `/api/tasks` | 태스크 목록 |
| POST | `/api/tasks/:id/pause` | 태스크 일시정지 |
| POST | `/api/tasks/:id/resume` | 태스크 재개 |
| POST | `/api/tasks/:id/cancel` | 태스크 취소 |
| GET | `/api/tokenomics` | 토큰 사용량 |
| WS | `/ws` | 실시간 이벤트 |

### 2.3 Core Intelligence Layer (`packages/core`)

**역할:** 두뇌. 무엇을 해야 할지 판단하고 계획 수립.

**주요 컴포넌트:**

| 컴포넌트 | 역할 |
|---------|------|
| **RoutineEngine** | XState 기반 작업 실행 및 스케줄링 |
| **Planner** | 복잡한 작업을 단계별로 분해 |
| **Economist** | 난이도에 따라 모델 선택 (Claude vs Gemini) |

**데이터 흐름:**
```
[Task Input] → [Planner] → [Sub-tasks] → [Economist] → [Model Selection] → [Execution]
```

### 2.4 Safety Layer (`packages/safety`)

**역할:** 시스템 보호. 모든 "부수 효과(Side-effect)"는 이 계층을 통과해야 함.

**핵심 로직 (Trust-First):**

| 단계 | 동작 |
|------|------|
| 1. Pre-Action | Git 스냅샷 생성 (stash/commit) |
| 2. Action | 실제 작업 수행 |
| 3. Verification | 작업 결과 검증 |
| 4. Post-Action | 실패 시 롤백, 성공 시 audit.log 기록 |

### 2.5 Persistence Layer (`packages/memory`)

**역할:** 컨텍스트 관리. Human-Readable 마크다운 사용.

| 파일 | 용도 | 수명 |
|------|------|------|
| `data/NOW.md` | 현재 진행 중인 태스크, 단기 메모리 | 세션 단위 |
| `data/MEMORY.md` | 장기 기억, 사용자 선호도, 레슨 런 | 영구 |

### 2.6 Capability Layer (`packages/mcp-client`)

**역할:** 외부 도구 연결. 표준 MCP 프로토콜 사용.

**지원 도구:**
- GitHub API
- Slack
- 브라우저 자동화
- 로컬 유틸리티

---

## 3. 데이터 흐름 (Data Flow)

### 정상 플로우

```
1. Trigger
   └─ 시간(Cron) 또는 사용자 입력(CLI)

2. Context Loading
   └─ Memory 패키지가 NOW.md 로드

3. Reasoning
   └─ Core가 목표 달성을 위한 최적의 도구와 모델 결정

4. Safety Check
   └─ 위험한 작업 시 CLI를 통해 사용자 승인 요청

5. Execution
   └─ Safety 래퍼 내에서 MCP 또는 파일 조작 수행

6. Updates
   └─ 결과에 따라 MEMORY.md 업데이트 및 경험 축적
```

### 실시간 이벤트 플로우 (WebSocket)

```
[Core] → [Event Emit] → [Daemon] → [WebSocket Broadcast] → [Dashboard/CLI]
```

**이벤트 타입:**
- `task:started` - 태스크 시작
- `task:completed` - 태스크 완료
- `task:failed` - 태스크 실패
- `thought:new` - 새로운 생각/로그
- `heartbeat` - 연결 유지

---

## 4. 배포 및 실행

### 개발 모드

```bash
# 1. Daemon (필수)
bun run --cwd apps/daemon dev

# 2. Dashboard (선택)
bun run --cwd apps/dashboard dev

# 3. CLI (선택)
bun run --cwd apps/cli start
```

### 또는 한 번에 실행

```bash
# Daemon + Dashboard
bun run dev

# 전체 (Daemon + Dashboard + CLI)
bun run dev:all
```

### 프로덕션 모드

```bash
bun run start:all
```

---

## 5. 참고 문서

- [Directory Structure](./directory-structure.md)
- [Master Specification](./spec.md)
- [Interface Testing Guide](../docs/testing/interface-testing-guide.md)
