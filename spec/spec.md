# Amicus 상세 사양서 (Detailed Specification)

본 문서는 Amicus 프로젝트의 구현을 위한 상세 사양서입니다. `spec-base.md`의 핵심 철학을 계승하며, `structure.md`와 `architecture.md`에서 정의된 구조를 기반으로 작성되었습니다.

## 1. 프로젝트 비전 (Vision)

Amicus는 **"Local-First, Trust-Based Autonomous OS Layer"**입니다.
단순한 챗봇이 아니라, 사용자의 로컬 환경에서 시스템 권한을 안전하게 위임받아 자율적으로 업무를 수행하는 개인 비서입니다.

## 2. 핵심 원칙 (The 4 Manifestos)

1.  **Trust-First (신뢰 우선):**
    *   모든 파일 변경은 되돌릴 수 있어야 합니다(Undoable).
    *   Git 기반 버전 관리를 통해 변경 이력을 추적합니다.
    *   중요 작업은 사용자 승인을 거칩니다.
2.  **Protocol-First (표준 준수):**
    *   Tool 사용은 **MCP**(Model Context Protocol)를 따릅니다.
    *   IDE/Client 통신은 **ACP**(Agent Client Protocol)를 지향합니다.
3.  **Decision-Centric Memory (의사결정 기억):**
    *   단순 로그가 아닌 "이유(Why)"를 기록합니다.
    *   사람이 읽을 수 있는 Markdown(`MEMORY.md`)을 DB로 사용합니다.
4.  **Economic Intelligence (비용 지능):**
    *   작업의 경중에 따라 Model(Claude Opus vs Gemini Flash 등)을 동적으로 선택하여 비용을 최적화합니다.

## 3. 시스템 구성 (System Organization)

### 3.1 디렉토리 구조 (Monorepo)
`pnpm workspace` 기반의 모노레포 구조를 따릅니다.

*   **apps/**
    *   `cli`: React Ink 기반의 터미널 UI. 사용자 인터페이스.
    *   `daemon`: 백그라운드 서비스. Cron 작업, 이벤트 리스너, HTTP 서버.
*   **packages/**
    *   `core`: RoutineEngine, Planner, 의사결정 로직.
    *   `memory`: ContextManager (NOW.md, MEMORY.md 파싱 및 업데이트).
    *   `mcp-client`: 외부 도구 연결 및 실행기.
    *   `types`: 공용 타입 정의.

## 4. 단계별 구현 명세 (Implementation Phases)

### Phase 1: Infrastructure (기반 구축)
가장 비파괴적이고 안전한 기반을 먼저 만듭니다.

*   **목표:** "안정적인 기반을 만든다."
*   **패키지:** `packages/types`, `packages/memory`
*   **핵심 기능:**
    *   공용 타입 정의 및 검증.
    *   마크다운 기반 컨텍스트 관리 시스템.

### Phase 2: Memory & Context (기억 시스템)
에이전트가 "현재 상태"와 "과거의 배움"을 알게 합니다.

*   **목표:** "맥락을 잃어버리지 않는다."
*   **패키지:** `packages/memory`
*   **데이터:**
    *   `data/NOW.md`: 현재 진행 중인 태스크 상태, 단기 메모리.
    *   `data/MEMORY.md`: 장기 기억, 사용자 선호도, 과거의 결정, 레슨 런(Lesson Learned).
*   **핵심 기능 (`ContextManager`):**
    *   `loadContext()`: 두 마크다운 파일을 읽어 LLM 프롬프트에 주입할 텍스트 생성.
    *   `updateShortTerm(content)`: `NOW.md` 갱신.
    *   `consolidate()`: 하루가 끝나거나 세션 종료 시, `NOW.md`의 중요 내용을 요약하여 `MEMORY.md`로 이동(Archiving).

### Phase 3: Core & Routine (지능 및 행동)
에이전트에게 행동 능력을 부여합니다.

*   **목표:** "스스로 일한다."
*   **패키지:** `packages/core`, `packages/mcp-client`
*   **핵심 기능 (`RoutineEngine`):**
    *   Cron 표현식을 지원하는 스케줄러.
    *   각 루틴은 `Task` 객체로 정의됨.
    *   **LLM Router:** 작업의 난이도(프롬프트 길이, 복잡도 메타데이터)를 분석하여 API 호출 분기.
        *   Simple: Gemini Flash / Claude Haiku
        *   Complex: Claude 3.5 Sonnet / GPT-4
*   **MCP 통합:**
    *   표준 MCP 클라이언트를 통해 로컬 툴(파일, 터미널) 및 원격 툴(검색 등) 연결.

### Phase 4: Interface Layer (Cockpit & Dashboard)
사용자가 에이전트를 모니터링(Reading)하고 제어(Writing)하는 모든 인터페이스입니다.

*   **앱:** `apps/dashboard` (Main), `apps/cli` (Lite)
*   **기술:** Lit + Signals (Web), React Ink (CLI)
*   **핵심 UI 구성요소:**
    1.  **Global Status Board (종합 상황판):**
        *   **System Health:** Daemon 상태, Uptime, CPU/Memory 점유율.
        *   **Tokenomics:** 연결된 LLM별(Claude, Gemini 등) 실시간 토큰 소모량 및 예상 비용 ($).
    2.  **Orchestrator Monitor (서브 에이전트 현황):**
        *   **Agent Grid:** 병렬 실행 중인 서브 에이전트(Worker)들의 상태 시각화 (Idle / Working / Error).
        *   **Task Progress:** 각 에이전트가 현재 수행 중인 구체적인 작업 내용 표시.
    3.  **Control Center (설정 및 제어):**
        *   **Configuration:** 프롬프트 템플릿 수정, API Key 관리, 모델 라우팅 전략 변경.
        *   **Manual Override:** 긴급 정지(Kill Switch), 승인 대기 작업에 대한 수동 승인/거절.
    4.  **Thought Stream:** 메인 브레인 및 서브 에이전트들의 로그/생각(Chain of Thought) 스트리밍.

## 5. 기술 스택 (Tech Stack)

*   **Runtime & Toolchain:** **Bun** (Node.js 및 pnpm 대체) - 패키지 관리, 테스트, 런타임 통합.
*   **Language:** TypeScript (Bun 내장)
*   **Repo Manager:** Bun Workspaces (Turborepo와 호환)
*   **State Management:** **XState** (루틴/워크플로우 제어)
*   **UI Library (Web):** **Lit + Signals** (표준 웹 컴포넌트 기반 초고속 렌더링)
*   **UI Library (CLI):** React Ink
*   **Git Control:** simple-git
*   **LLM Integration:** Vercel AI SDK (다양한 모델 추상화)

## 6. 개발 로드맵 요약

1.  모노레포 설정 및 `packages/types`, `packages/memory` 구현.
2.  `packages/core`에서 간단한 "Hello World" 루틴 실행.
3.  `apps/cli`로 시각화.
4.  `apps/dashboard`로 웹 인터페이스 구현.
