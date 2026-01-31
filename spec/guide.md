# Amicus 개발 가이드 및 주의사항

## 1. 개발 시 주의사항 (Precautions)

Amicus는 시스템 권한(파일 읽기/쓰기, 명령어 실행)을 갖는 에이전트이므로, 개발 중 다음 사항을 특히 주의해야 합니다.

### 1.1 Git Reset 주의 (Data Loss)
*   **위험:** `packages/safety`의 핵심 기능은 작업 실패 시 `git reset --hard`를 수행하는 것입니다.
*   **주의:** 개발 중에 **커밋하지 않은 변경사항(Unstaged/Staged changes)**이 있는 상태에서 에이전트를 테스트하지 마세요. 에이전트가 오류를 감지하고 롤백하면, **당신이 작성 중이던 코드가 날아갈 수 있습니다.**
*   **습관:** 에이전트 실행 전에는 반드시 `git stash` 또는 `git commit`을 하는 습관을 들이세요.

### 1.2 무한 루프와 비용 (Infinite Loops & Cost)
*   **위험:** `RoutineEngine`이나 `Planner`가 오류로 인해 동일한 작업을 무한 반복할 경우, LLM 토큰 비용이 급증할 수 있습니다.
*   **방어:** 초기 개발 시에는 하루 총 비용 한도(Hard Limit)를 설정하거나, 루프 횟수 제한(Max Retry)을 낮게(예: 3회) 설정하세요.

### 1.3 파일 시스템 접근 제어
*   **위험:** LLM이 실수로 중요 디렉토리(예: `~/.ssh`, `/etc`)를 건드리지 않도록 해야 합니다.
*   **방어:** `packages/safety`나 `mcp-client` 단계에서 접근 가능한 루트 디렉토리를 프로젝트 폴더 내부로 엄격하게 제한(Allowlist)하세요.

## 2. 시작 가이드 (How to Start)

프로젝트를 바닥부터 시작하는 단계별 가이드입니다.

### Step 1: 프로젝트 초기화 및 모노레포 설정

```bash
# 1. 초기화 (현재 디렉토리 기준)
# (이미 프로젝트 폴더 안에 있다고 가정합니다)

# 2. Git 초기화 (SafetyExecutor 작동을 위해 필수)
git init

# 3. Bun 초기화 (패키지 매니저 및 런타임)
bun init

# 4. 워크스페이스 설정 (package.json 수정)
# "workspaces": ["apps/*", "packages/*"] 추가 필요

# 5. 디렉토리 구조 생성
mkdir -p apps/cli apps/dashboard apps/daemon
mkdir -p packages/core packages/orchestrator packages/safety packages/memory packages/mcp-client packages/types
mkdir -p data/logs
```

### Step 2: 기본 의존성 설치

Bun은 TypeScript가 내장되어 있어 별도 설정이 거의 필요 없습니다.

```bash
bun add -d turbo tsup # 빌드 도구
# tsc는 bun에 내장되어 있지 않으므로 타입 체크용으로 필요할 수 있음
bun add -d typescript 
```

### Step 3: 첫 번째 모듈, Safety 구현 (Phase 1)

가장 먼저 `packages/safety`를 구현하여 안전망을 확보합니다.

1.  `cd packages/safety`
2.  `pnpm init`
3.  `pnpm add simple-git`
4.  `SafetyExecutor` 클래스 작성 (Git 스냅샷 및 롤백 로직).

### Step 4: 통합 테스트

1.  루트에 테스트용 스크립트 작성.
2.  의도적으로 에러를 발생시키는 코드를 `SafetyExecutor`에 태워서, `git reset`이 제대로 작동하는지 검증합니다.

### Step 5: Core 및 UI 확장

안전망이 확보되면 `packages/core`의 로직과 `apps/cli`의 UI를 병렬로 개발합니다.
