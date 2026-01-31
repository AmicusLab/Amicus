# @amicus/core

Amicus의 “지능 + 실행” 핵심 레이어입니다.

이 패키지는 크게 3가지로 구성됩니다.

- `RoutineEngine`: cron 스케줄링 + XState 상태머신 기반 작업 실행기
- `Economist`: 작업 난이도(복잡도)를 기반으로 LLM 모델을 라우팅하고 비용을 추정/기록
- `Planner`: 작업을 서브태스크로 쪼개고(규칙/LLM 기반), 실행 전략(sequential/parallel/priority)을 결정

중요한 설계 포인트:
- `@amicus/core`는 특정 구현체에 강하게 묶이지 않도록 **인터페이스 기반**으로 동작합니다.
  - 실행: `OperationExecutor`
  - 컨텍스트: `ContextManagerLike`
  - MCP: `MCPClientLike`

즉, `packages/memory`의 `ContextManager`나 `packages/mcp-client`의 `MCPClient`를 그대로 주입해도 되고,
테스트/개발에서는 mock 구현을 주입해도 됩니다.

## 설치

모노레포 내부 워크스페이스 의존성으로 사용됩니다.

```bash
bun install
```

## 빠른 시작

### 1) RoutineEngine 실행(즉시 실행)

```ts
import { RoutineEngine } from "@amicus/core";

// 개발용: 그냥 op()를 실행하는 간단 executor
const operationExecutor = {
  execute: async <T>(_: string, op: () => Promise<T>): Promise<T> => op(),
};

const contextManager = {
  loadContext: async () => "## Current Context (NOW.md)\n...\n\n## Long-Term Memory (MEMORY.md)\n...",
  updateShortTerm: async (_: string) => {},
  consolidate: async () => {},
};

const engine = new RoutineEngine({
  operationExecutor,
  contextManager,
});

const task = {
  id: "task-1",
  description: "Run a demo task",
  status: "pending",
  priority: "high",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

await engine.executeTask(task);
engine.stop();
```

### 2) cron 스케줄링

```ts
engine.start();
engine.schedule("*/5 * * * * *", task); // 5초마다
```

## 주요 API

### RoutineEngine

`packages/core/src/routine/RoutineEngine.ts`에 정의됩니다.

핵심 인터페이스:

```ts
export interface OperationExecutor {
  execute<T>(taskDescription: string, operationFunction: () => Promise<T>): Promise<T>;
}

export interface ContextManagerLike {
  loadContext(): Promise<string>;
  updateShortTerm(content: string): Promise<void>;
  consolidate(): Promise<void>;
}

export interface MCPClientLike {
  discoverTools(): Promise<import("@amicus/types/mcp").Tool[]>;
  invokeTool(name: string, params: Record<string, unknown>): Promise<{ content: string; isError?: boolean }>;
}
```

옵션:

```ts
export interface RoutineEngineOptions {
  operationExecutor?: OperationExecutor;
  contextManager: ContextManagerLike;
  mcpClient?: MCPClientLike;
}
```

### Economist (LLM Router)

- `analyzeComplexity(task)`로 복잡도 점수(lexical/semantic/scope/total)를 계산
- `route(task)`로 모델/프로바이더를 선택하고 비용을 추정
- `generateText(task, prompt)`로 실제 텍스트 생성(환경변수로 API 키 필요)

### Planner

- `createPlan(task)`로 서브태스크/의존성/전략을 생성
- `decompose(task)`는 복잡도에 따라 규칙 기반 또는 LLM 기반 분해를 시도
- `executePlan(plan)`은 전략(sequential/parallel/priority)에 맞춰 실행 순서를 결정

## 테스트

```bash
cd packages/core
bun test
```

루트에서 전체 테스트:

```bash
bun test
```

## 참고

- 과거 설계에서 Git 기반 롤백 레이어(SafetyExecutor)를 사용했으나, 현재 리포지토리에서는 해당 패키지를 제거했습니다.
- 안전성/롤백이 필요한 경우, `OperationExecutor`에 “실행 전/후 검증 + 롤백” 정책을 주입하는 방식으로 구현할 수 있습니다.
