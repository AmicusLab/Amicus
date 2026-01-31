# @amicus/memory

Amicus의 “메모리/컨텍스트” 레이어입니다.

이 패키지는 `NOW.md`(단기)와 `MEMORY.md`(장기)라는 사람이 읽을 수 있는 마크다운 파일을 사용해,
세션을 넘어 컨텍스트를 유지하고 “왜(Why)” 중심의 기록을 남기도록 돕습니다.

## 기능

### 핵심 기능

- **컨텍스트 로딩**: `ContextManager.loadContext()`가 두 파일을 읽어 LLM 프롬프트에 넣기 좋은 형식의 문자열을 반환
- **단기 메모리 업데이트**: `ContextManager.updateShortTerm(content)`가 `NOW.md`를 갱신
- **메모리 통합(아카이빙)**: `ContextManager.consolidate()`가 `NOW.md`의 내용을 `MEMORY.md`로 옮기고 `NOW.md`를 초기화
- **에러 처리**: 파일 읽기/쓰기 실패 등 상황을 위한 커스텀 에러 클래스 제공

### 파일 구조

```
data/
├── NOW.md          # Short-term memory (current session, active tasks)
└── MEMORY.md       # Long-term memory (user preferences, past decisions, lessons learned)
```

## 설치

모노레포 내부 워크스페이스 의존성으로 사용됩니다.

```bash
bun install
```

## 사용법

### 기본 사용

```typescript
import { ContextManager } from '@amicus/memory';

const contextManager = new ContextManager({
  repoRoot: process.cwd(),  // Optional: defaults to process.cwd()
});

// LLM 프롬프트용 컨텍스트 로딩
const context = await contextManager.loadContext();

// 단기 메모리 업데이트
await contextManager.updateShortTerm("Working on Phase 2 implementation");

// 통합(장기 메모리에 아카이빙 + 단기 메모리 초기화)
await contextManager.consolidate();
```

### API 레퍼런스

#### `ContextManagerOptions`

```typescript
interface ContextManagerOptions {
  repoRoot?: string; // 메모리 파일 기준 루트 (기본값: process.cwd())
}
```

#### `ContextManager` 클래스

```typescript
class ContextManager {
  constructor(opts: ContextManagerOptions);

  // NOW.md와 MEMORY.md를 읽어서 포맷된 컨텍스트 문자열 반환
  async loadContext(): Promise<string>;

  // NOW.md를 content로 갱신
  async updateShortTerm(content: string): Promise<void>;

  // NOW.md를 MEMORY.md로 아카이빙하고 NOW.md를 초기 템플릿으로 리셋
  async consolidate(): Promise<void>;
}
```

### 메모리 파일 포맷

#### `NOW.md` (단기 메모리)

```markdown
# NOW.md - Active Context
Last Updated: {iso8601timestamp}
Session ID: {uuid}

## Current Objective
{objective}

## In Progress
- [ ] Task 1
- [ ] Task 2

## Recent Decisions
{decisions}

## Notes
{notes}
```

#### `MEMORY.md` (장기 메모리)

```markdown
# MEMORY.md - Long-Term Memory

## User Preferences
{userPreferences}

## Past Decisions
{pastDecisions}

## Lessons Learned
{lessonsLearned}
```

## 에러 클래스

- **`MemoryManagerError`**: 메모리 관련 에러의 베이스 클래스
- **`FileReadError`**: 파일 읽기 실패
- **`FileWriteError`**: 파일 쓰기 실패
- **`InvalidMarkdownError`**: 향후 마크다운 검증용(예약)

## 테스트

테스트는 아래 시나리오를 포함합니다:

- 파일이 없을 때 기본 템플릿 생성
- 두 파일의 기존 내용을 로딩
- 단기 메모리 업데이트
- 아카이빙(consolidate) 및 초기화
- 파일 I/O 에러 처리
- Git/SafetyExecutor 없이 동작(현재 리포지토리에서는 Safety 패키지가 제거됨)

테스트 실행:

```bash
cd packages/memory
bun test
```

## Amicus 시스템에서의 역할

### How It Fits

`packages/memory`는 아키텍처에서 말하는 “컨텍스트/지속성 레이어”를 담당합니다.

```
┌─────────────────────────────────────────────────┐
│ User / CLI / Dashboard           │
└────────────────┬──────────────────────────────────┘
               │
        ┌────────▼──────────────┐
        │  Core / Routine Engine   │
        │  (Decision Making)       │
        └───────────┬────────────┘
                     │
           ┌────────────┐
           │   Memory     │
           │ (Context)   │
           └─────────────┘
```

동작 흐름:
1. 루틴 엔진이 `loadContext()`로 현재 상태를 가져옴
2. 작업 수행/의사결정
3. 진행 상황/결정을 `updateShortTerm()`로 기록
4. 세션 종료 또는 특정 시점에 `consolidate()`로 장기 메모리에 아카이빙
5. 모든 데이터는 `data/` 디렉토리에 마크다운으로 저장(사람이 읽고 수정 가능)

### 핵심 원칙

- **Local-First**: 모든 데이터는 로컬에 저장
- **Human-Readable**: 마크다운으로 사람이 직접 확인/수정 가능
- **Decision-Centric**: 무엇을 했는지보다 “왜 그렇게 했는지”를 남기기 쉬움

## 참고

- 이 패키지는 Git 작업을 수행하지 않습니다.
- Bun의 file I/O를 사용하며, 원자적 쓰기(atomic write) 패턴을 사용합니다.
- 파일이 없으면 기본 템플릿을 자동 생성합니다.
