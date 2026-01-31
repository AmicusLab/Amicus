# Amicus 프로젝트 컨텍스트 및 에이전트 가이드

이 문서는 AI 에이전트(OpenCode, Claude, Codex 등)가 Amicus 프로젝트의 구조, 제약사항, 규칙을 빠르게 파악하고 작업을 수행할 수 있도록 정의합니다.

---

## 1. 프로젝트 구조 (Project Structure)

Amicus는 **Bun Workspaces** 기반의 모노레포 프로젝트입니다.

### 루트 디렉토리
- `apps/`: 실행 가능한 애플리케이션 (Entry points)
- `packages/`: 공유 라이브러리 및 로직 (Workspace packages)
- `spec/`: 프로젝트 상세 사양서 및 아키텍처 문서
- `docs/`: 개발 문서 및 가이드
- `data/`: 런타임 데이터 및 로그 저장소

### 주요 컴포넌트 (`apps/`)
| 이름 | 역할 | 기술 스택 | 비고 |
|------|------|-----------|------|
| **daemon** | 중앙 서버 (Brain) | Hono + WebSocket | 시스템의 핵심 로직, 스케줄링 담당 |
| **dashboard** | 웹 인터페이스 | Lit + Signals + Vite | 사용자 모니터링 및 제어 UI |
| **cli** | 터미널 인터페이스 | React Ink | CLI 기반 제어 도구 |

### 공유 패키지 (`packages/`)
| 이름 | 역할 | 비고 |
|------|------|------|
| **core** | 핵심 비즈니스 로직 | RoutineEngine, Planner 등 포함 |
| **memory** | 컨텍스트 및 기억 관리 | `NOW.md`, `MEMORY.md` 처리 |
| **mcp-client** | MCP 도구 통합 | 외부 도구 및 API 연결 |
| **types** | 공유 타입 정의 | 프로젝트 전반에서 사용되는 TS 타입 |

---

## 2. 기술 스택 및 제약사항 (Tech Stack & Constraints)

모든 코드 작성 및 수정 시 아래 기술 스택과 제약사항을 준수해야 합니다.

### 핵심 기술
- **Runtime**: **Bun** (Node.js 사용 지양)
- **Language**: **TypeScript** (Strict Mode)
- **Package Manager**: **Bun** (`bun install`, `bun add`)

### 프레임워크 규칙
- **Server**: Hono 사용 (Express 등 사용 금지)
- **Web UI**: Lit + Signals 사용 (React(DOM) 사용 지양, 대시보드 성능 최적화)
- **CLI**: React Ink 사용

### 아키텍처 원칙
1. **Local-First**: 모든 데이터는 로컬에 저장 (`data/` 디렉토리 등)
2. **Monorepo**: 공통 로직은 `packages/`로 분리하여 재사용성 확보

---

## 3. 개발 워크플로우 (Development Workflow)

에이전트는 작업 수행 시 다음 명령어를 활용해야 합니다.

- **의존성 설치**: `bun install`
- **개발 서버 실행**: `bun run start:dev` (Daemon, Dashboard, CLI 동시 실행)
- **전체 검증**: `bun run verify` (Typecheck + Build + Test)
    - **중요**: 커밋 전 반드시 이 명령어가 통과해야 함.
- **테스트**:
    - Unit: `bun test`
    - Interface: `bun run test:interface`

---

## 4. 에이전트 정의 (Agent Definitions)

### planner

**역할**: 작업 계획 수립 전문가

**용도**: 복잡한 기능 구현 요청 시 세부 태스크로 분해하여 실행 계획 수립

**트리거**:
- "계획 세워줘"
- "plan [기능명]"
- 복잡한 구현 요청 시 자동 활성화 권장

**사용법**:
```
delegate_task(
  subagent_type="planner",
  load_skills=["planner"],
  prompt="[기능 구현 요청 내용]",
  run_in_background=false
)
```

**출력**:
- 세부 태스크 목록 (TODO 형식)
- 의존성 그래프
- 검증 기준
- 예상 산출물

---

## 5. 에이전트 선택 가이드

| 상황 | 추천 에이전트 | 이유 |
|------|--------------|------|
| 새 기능 구현 계획 | `planner` | 태스크 분해 및 의존성 분석 |
| 코드베이스 탐색 | `explore` | 빠른 패턴 검색 |
| 외부 라이브러리 조사 | `librarian` | 문서 및 예제 검색 |
| 아키텍처 결정 | `oracle` | 고품질 추론 |
| 프론트엔드 UI | `visual-engineering` | UI/UX 전문 |
| 간단한 수정 | `quick` | 빠른 처리 |

---

## 6. 커스텀 스킬

### planner

위치: `.opencode/skills/planner.md`

계획 수립 시 로드되는 전문 지식:
- 프로젝트별 규칙 (기술 스택, 검증 명령, 커밋 컨벤션)
- 계획서 템플릿
- 행동 지침 (MUST DO / MUST NOT DO)

---

## 7. 커밋 규칙 (Commit Guidelines)

### 커밋 타이밍

**커밋은 반드시 아래 조건을 모두 만족한 후에만 수행:**

1. ✅ **테스트 통과**
   - `bun run test:all` 실행
   - 모든 테스트 (unit + interface) 통과

2. ✅ **타입 체크 통과**
   - `bun run typecheck` 실행
   - TypeScript 오류 없음

3. ✅ **빌드 통과**
   - `bun run build` 실행
   - 모든 패키지/앱 빌드 성공

4. ✅ **UI 검증 (해당 시)**
   - `bun run start:dev`로 전체 시스템 실행
   - Dashboard: http://localhost:5173 정상 표시
   - CLI: 터미널 출력 정상
   - Daemon: API 응답 정상

5. ✅ **문서화 완료**
   - 구현 문서: `docs/implementation/*.md`
   - 필요시 README 업데이트
   - API 변경시 타입 문서화

### 커밋 메시지 컨벤션

```
<type>(<scope>): <subject>

<body>

<footer>
```

**타입:**
| 타입 | 설명 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `test` | 테스트 추가/수정 |
| `refactor` | 리팩토링 |
| `chore` | 기타 작업 |

**예시:**
```
feat(daemon): add WebSocket health check

- Daemon 시작 시 health endpoint 확인
- CLI가 Daemon 준비된 후 연결 시도
- 최대 10초 대기, 재시도 5회

Closes #123
```

### 커밋 금지 사항

❌ **금지:**
- 테스트 실패 상태에서 커밋
- 빌드 오류 상태에서 커밋
- 미완성 기능 커밋 (WIP 커밋)
- 커밋 메시지 없이 커밋
- 여러 기능을 하나의 커밋에 포함

✅ **권장:**
- 원자적 커밋 (하나의 기능/수정만)
- 한글 설명과 영어 메시지 병행
- 관련 이슈 번호 참조
