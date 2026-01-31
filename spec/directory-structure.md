# Amicus Directory Structure Proposal

## 1. 개요 (Overview)
Amicus는 모노레포(Monorepo) 구조를 채택하여 여러 애플리케이션(UI, 서버 등)과 공유 패키지(로직, 유틸리티)를 효율적으로 관리합니다.
기존의 평면적인 `packages/` 구조에서, 실행 가능한 애플리케이션과 재사용 가능한 라이브러리를 명확히 분리하는 `apps/`와 `packages/` 구조로 재편합니다.

## 2. 권장 디렉토리 트리 (Directory Tree)

```text
. (Current Directory)
├── apps/                  # 실행 가능한 애플리케이션 모음
│   ├── cli/               # (Classic) 터미널 대시보드 (React Ink)
│   ├── dashboard/         # (Modern) 웹 기반 실시간 상태 모니터링 (Lit + Signals)
│   └── daemon/            # 백그라운드 뇌 & 서버 (Hono + Bun)
│
 ├── packages/              # 공유 라이브러리 및 코어 모듈
│   ├── core/              # 에이전트 핵심 로직 (Brain, Decision Making)
│   ├── orchestrator/      # (신규) 다중 서브 에이전트 병렬 실행 및 스케줄링 관리 (Worker Manager)
│   ├── memory/            # (신규) NOW.md, MEMORY.md 등 컨텍스트 관리 모듈
│   ├── mcp-client/        # (구 mcp-engine) 외부 MCP 서버와의 통신 클라이언트
│   └── types/             # (신규) 프로젝트 전반에서 공유되는 TypeScript 타입 정의
│
├── data/                  # 런타임 데이터 (Git 추적 제외 권장, 혹은 별도 관리)
│   ├── memory/            # MEMORY.md, NOW.md 저장소
│   └── logs/              # audit.log 등 로그 파일
│
├── spec/                  # 프로젝트 스펙 및 설계 문서
│   ├── spec-base.md       # 원본 스펙 개요
│   ├── structure.md       # 디렉토리 구조 설명 (본 문서)
│   ├── architecture.md    # 시스템 아키텍처 다이어그램 및 흐름
│   └── guide.md           # 개발 가이드 및 주의사항
│
├── tools/                 # 개발 및 배포용 스크립트
├── .gitignore
├── package.json           # 루트 package.json (Workspace 설정)
├── pnpm-workspace.yaml    # (pnpm 사용 시) 워크스페이스 정의
├── turbo.json             # (Turborepo 사용 시) 빌드 파이프라인 설정
└── README.md
```

## 3. 구조 변경의 이유 및 이점

### 3.1 `apps` vs `packages` 분리
- **명확한 역할 구분:** `packages/`에 있던 `ui-cli`나 `acp-server`는 사실상 실행 주체이므로 `apps/`로 이동하여 의존성 방향을 명확히 합니다 (Apps -> Packages).
- **배포 및 실행 단위:** `apps` 하위 항목들은 각각 독립적으로 빌드/실행/배포될 수 있는 단위가 됩니다.

### 3.3 병렬 처리를 위한 Orchestrator 분리
- **Multi-Agent 지원:** 비서 업무 특성상 '리서치', '코딩', '모니터링' 등 여러 작업이 동시에 진행되어야 합니다.
- **역할:** `orchestrator` 패키지는 Node.js의 Worker Threads나 Child Processes를 사용하여 메인 스레드 차단 없이 서브 에이전트들을 병렬로 구동하고 관리합니다.

### 3.4 모듈 세분화
- **`memory` 패키지 분리:** 기억 관리(읽기/쓰기/요약) 로직은 Core 뿐만 아니라 CLI에서도 참조할 수 있으므로 별도 패키지로 분리합니다.
- **`types` 패키지 신설:** 모노레포 내에서 인터페이스(Protocol) 일관성을 유지하기 위해 공용 타입을 중앙화합니다.

### 3.5 데이터 디렉토리 명시
 - 코드와 런타임 데이터를 명확히 분리하여, 백업 정책과 `OperationExecutor`의 감시 대상을 설정하기 용이하게 합니다.
