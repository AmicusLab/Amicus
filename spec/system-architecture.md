# 🏛️ Amicus AI V2: Master Architecture Definition

**작성자:** Lead Architect
**개발 원칙:** Modular Monorepo, Trust-First, Protocol-Orientd

## 1. 핵심 설계 철학 (Core Philosophy)

우리는 단순한 챗봇이 아니라, **사용자의 권한을 위임받아 시스템을 운영하는 OS 레이어**를 만듭니다.

1.  **Trust-First (신뢰 우선):** 모든 행동은 **가시적(Visible)**이어야 하며, **복구 가능(Reversible)**해야 한다. (Git 기반 롤백 필수)
2.  **Routine-Driven (루틴 중심):** 대화는 수단일 뿐이다. 에이전트는 사용자가 잠든 사이에도 정해진 규칙(State Machine)에 따라 백그라운드에서 일해야 한다.
3.  **Brain-Body Separation (뇌와 신체의 분리):** 계획하는 놈(Planner)과 실행하는 놈(Executor)을 철저히 분리하여 복잡도를 낮춘다.
4.  **Protocol Interoperability (표준 프로토콜):** 도구는 **MCP**로, 클라이언트는 **ACP**로 표준화하여 확장성을 보장한다.

---

## 2. 시스템 아키텍처 (High-Level Architecture)

시스템은 크게 **두뇌(Core)**, **감각/소통(Gateway)**, **기억(Memory)**, **손발(Tools)**, **안전장치(Safety)**의 5대 모듈로 구성됩니다.

```text
      [User/Apps]                 [Admin/Monitor]
    (Chat/Voice)                  (Dashboard/CLI)
          │                              │
          ▼                              ▼
 ┌──────────────────┐           ┌──────────────────┐
 │   Omni-Gateway   │           │ Control Cockpit  │
 │ (Messaging Hub)  │           │ (Visual Tools)   │
 └────────┬─────────┘           └────────┬─────────┘
          │ (Webhook / REST)             │ (WebSocket)
          ▼                              ▼
┌──────────────────────────────────────────────────────┐
│             Daemon (Central OS Server)               │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │                The Brain (Core)                │  │
│  │                                                │  │
│  │         ┌──────────┐                           │  │
│  │         │  Router  │ (Intent)                  │  │
│  │         │ (Analyst)├───────┐                   │  │
│  │         └────┬─────┘       │ (Complex)         │  │
│  │    (Reflex)  │             ▼                   │  │
│  │          ┌───┴─────┐   ┌───────┐   ┌────────┐  │  │
│  │          │ Instant │   │Planner├──►│Executor│  │  │
│  │          │ & Skills│   │ Agent │   │ Agent  │  │  │
│  │          └───┬─────┘   └───────┘   └───┬────┘  │  │
│  │              │ (Reflex)                │ (Deep)│  │
│  └──────┬───────┼─────────────────────────┼───────┘  │
└─────────┼───────┼─────────────────────────┼──────────┘
          │       │                         │
  (Context│       │                         │ (Action)
   R/W)   │       └───────────┐       ┌─────┘
          ▼                   ▼       ▼
  ┌────────────────┐     ┌────────────────┐
  │ Memory System  │     │  Safety Layer  │
  │ (Qdrant / MD)  │     │ (Git/Council)  │
  └────────────────┘     └───────┬────────┘
                                 │ (Approve)
                                 ▼
                         ┌────────────────┐
                         │  Capabilities  │
                         │ (MCP / Tools)  │
                         └────────────────┘

```

---

## 3. 디렉토리 구조 (Monorepo Specification)

`Bun` 워크스페이스를 사용하는 모노레포 구조입니다.

```bash
amicus-v2/
├── apps/
│   ├── gateway/          # [Adapter] 외부 메신저 연동 (Telegram/Slack Webhook)
│   ├── daemon/           # [Server] Core 로직 및 WebSocket 호스팅 (Hono)
│   ├── dashboard/        # [UI] 웹 시각화 대시보드 (Next.js/Lit)
│   └── cli/              # [UI] 터미널 인터페이스 (React-Ink)
├── packages/
│   ├── core/             # [Brain] Planner, Executor, Routine 엔진
│   ├── memory/           # [Storage] Qdrant + Markdown 하이브리드 관리자
│   ├── safety/           # [Shield] Git 롤백, 권한 제어, 샌드박스
│   ├── skills/           # [Evolution] 자가 진화 스킬 라이브러리 (Voyager)
│   ├── mcp-client/       # [Hands] MCP 도구 연결 및 실행기
│   ├── types/            # [Protocol] 공통 타입 정의 (Zod)
│   └── logger/           # [Log] 구조화된 로깅 및 감사(Audit)
└── data/                 # [Persistence] 로컬 데이터 저장소
    ├── qdrant/           # 벡터 DB 볼륨
    ├── memory/           # MEMORY.md, NOW.md
    └── audit.log         # 변경 불가능한 감사 로그
```

---

## 4. 모듈별 상세 기능 명세 (Feature Spec)

### **Phase 1: 신경망 및 안전장치 (Gateway, Daemon & Safety)**
*가장 먼저 개발해야 할 기반 시설입니다.*

1.  **Omni-Gateway (`apps/gateway`)**
    *   **Messenger Adapter:** 텔레그램, 슬랙, 카카오톡의 Webhook을 받아 표준화된 API로 `Daemon`에 전달.
    *   **Lightweight:** 로직 없이 단순 포워딩 역할만 수행 (Stateless).
    *   **ACP Server:** IDE(VS Code, Cursor)와 연동하여 코파일럿 역할을 수행하는 Agent Client Protocol 서버.

2.  **Central Daemon (`apps/daemon`)**
    *   **Core Server:** Hono 기반의 메인 서버. `The Brain`을 호스팅.
    *   **WebSocket Hub:** Gateway, Dashboard, CLI와 실시간 양방향 통신.
    *   **Task Scheduling:** `cron` 작업 및 백그라운드 에이전트 실행 관리.
    *   **Identity Mapping:** `telegram_user_1`과 `slack_user_A`를 동일한 `User ID`로 매핑.

3.  **Safety Executor (`packages/safety`)**
    *   **Atomic Snapshots:** 파일 쓰기/삭제 도구 실행 직전 `git commit` 자동 생성.
    *   **Instant Rollback:** `/undo` 명령 시 `git reset --hard HEAD~1` 수행.
    *   **Access Control:** `amicus.json` 정책에 따라 도구별 실행 권한(Allow/Deny/Ask) 제어.

### **Phase 2: 기억과 학습 (Memory Intelligence)**
*AI가 문맥을 잃어버리지 않게 합니다.*

4.  **Memory System (`packages/memory`)**
    *   **Context Management:** 사용자와의 대화 이력, 사용자 선호도, 과거 작업 내역 저장.
    *   **Granular Access Control:** Core Engine 내 각 에이전트(Router, Planner, Executor, Instant)별로 메모리 접근 권한(Read-Only, Read-Write, None)을 차등 부여하여 보안 및 데이터 무결성 강화.
    *   **Context GC:** 토큰 한계 도달 시, 오래된 대화를 롤링 요약(Rolling Summary)하여 압축하고 최신 맥락 유지.
    *   **Dual Storage:**
        *   **Short-term:** Redis/In-Memory (진행 중인 대화 맥락).
        *   **Long-term:** Qdrant (벡터 검색, RAG) + Markdown (직관적 문서화).

5.  **Memorizer Agent**
    *   세션 종료 시 백그라운드에서 실행되어, 대화 속에서 **사실(Fact)**과 **선호(Preference)**를 추출하여 장기 기억에 업데이트.

### **Phase 3: 공통 프로토콜 (The Protocol)**
*모든 시스템이 소통하는 언어입니다.*

6.  **Amicus Message Protocol (`packages/types`)**
    *   **Universal Payload:** 시스템 내 모든 컴포넌트(Gateway, Daemon, CLI)가 주고받는 표준 메시지 포맷.
    *   **Structure:**
        ```json
        {
          "id": "uuid",
          "source": "telegram" | "slack" | "cli" | "dashboard",
          "userId": "mapped_user_id",
          "type": "text" | "image" | "file" | "command",
          "content": "payload",
          "timestamp": "ISO8601"
        }
        ```
    *   **Role:** Gateway는 외부 메시지를 이 포맷으로 정규화하여 Daemon에 전송.

### **Phase 4: 지능형 두뇌 (Core Engine)**
*단순 LLM 호출을 넘어선 에이전트 아키텍처입니다.*

7.  **Intelligent Router (Analyst)**
    *   **Intent Analysis:** 사용자의 발화가 단순 대화/질문인지, 복잡한 작업(Task)인지 판단.
    *   **Reflex Mode (Fast Track):** 단순 질문이나 **검증된 스킬(Verified Skill)** 실행은 Planner를 거치지 않고 즉시 수행 (`/weather`, `/summary` 등).
    *   **Deep Mode (Agent Loop):** 새로운 문제 해결, 코드 작성, 복합 추론이 필요한 작업은 Planner로 이관.

8.  **Session Manager**
    *   **Context Isolation:** 주식 분석, 이메일 정리 등 병렬 작업을 수행할 때 각 작업의 맥락(Context)을 독립된 세션으로 격리.
    *   **Global Merge:** 각 세션에서 도출된 중요 정보는 메인 메모리에 병합.

9.  **Researcher Agent**
    *   **Deep Retrieval:** Planner가 계획을 수립하기 전, 다단계 웹 검색 및 문서 분석(Deep Research)을 수행하여 풍부한 맥락 제공.
    *   **Fact Checking:** 수집된 정보의 신뢰성을 교차 검증.

10. **Planner & Executor (`packages/core`)**
    *   **Planner:** Deep Mode로 진입한 복잡한 요청에 대해 `JSON Plan`을 수립.
    *   **Executor:** Plan에 따라 순차적으로 도구를 실행. 오류 발생 시 스스로 수정(Self-Correction) 시도.
    *   **Debate Council:** 위험도가 높은 작업(파일 삭제 등) 전, `SafetyAgent`와 `UserProxy`가 토론하여 실행 승인 여부 결정.

11. **Background Routine Engine**
    *   **State Machine:** 사용자의 반복 업무(뉴스 브리핑, 서버 점검)를 상태 기반(Start -> Running -> Completed)으로 관리.
    *   **Auto-Recovery:** 작업 실패 시 지수 백오프(Exponential Backoff)로 재시도 및 복구.

12. **Economist (Cost Router)**
    *   작업 난이도(단순/복잡) 분류기.
    *   **Dynamic Routing:** 단순 조회 → `Gemini Flash`, 복잡한 코딩 → `Claude 4.5 Sonnet`.
    *   예산 초과 시 작업 차단 및 알림.

### **Phase 5: 실행 및 진화 (Tools & Skills)**
*손발을 달아주고 스스로 성장하게 합니다.*

13. **MCP Integration (`packages/mcp-client`)**
    *   표준 MCP 프로토콜을 통해 로컬 파일 시스템, 브라우저, 외부 API 도구 연결.
    *   Docker 컨테이너 내부에서 도구를 실행하여 호스트 격리 (Sandbox).

14. **Voyager Skill Engine (`packages/skills`)**
    *   **Skill Generator:** 반복되는 작업 패턴을 감지하면 파이썬/TS 코드로 변환하여 저장.
    *   **Reflexion Loop:** 스킬 실행 실패 시 에러 로그를 분석해 코드를 스스로 수정하고 재저장.

### **Phase 6: 관제탑 (Cockpit Interface)**
*모든 것을 시각화합니다.*

15. **Visual Dashboard (`apps/dashboard`)**
    *   **Agent Graph:** 현재 실행 중인 에이전트(Planner, Executor)의 상태와 작업 흐름을 노드 그래프로 시각화.
    *   **Memory Map:** Qdrant에 저장된 지식들의 연관 관계를 시각화.
    *   **Control Panel:** 에이전트 일시정지, 승인 대기 작업 처리(Approve/Reject).
    *   **Approval UI:** 위험 작업 발생 시 사용자 승인 요청 팝업.

---

## 5. 개발 실행 가이드 (Reboot Strategy)

OpenCode에게 이 순서대로 지시하여 "제대로" 다시 만드십시오.

1.  **Initialize:** "Bun과 Turborepo를 써서 위 디렉토리 구조대로 프로젝트 뼈대를 만들어줘."
2.  **Safety First:** "`packages/safety`에 `simple-git`을 이용한 롤백 시스템부터 구현해. 이게 안 되면 다음으로 안 넘어간다."
3.  **Gateway:** "`apps/gateway`에 Hono 서버를 만들고 텔레그램 웹훅을 받아서 로그를 찍는 것까지 해줘."
4.  **Memory:** "`packages/memory`에 Qdrant Docker를 연결하고 텍스트를 저장/검색하는 클래스를 만들어."
5.  **Core:** "이제 `Planner`와 `Executor`를 분리해서 구현하자. 처음엔 도구 없이 `echo`만 하도록."

이 아키텍처는 **PLAN-AND-ACT**의 논리적 구조, **Voyager**의 진화 능력, **Mem0**의 메모리 관리, **OpenClaw**의 연결성을 모두 통합한 **최종판**입니다.
