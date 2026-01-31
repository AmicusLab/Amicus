# @amicus/types

Amicus 모노레포에서 공통으로 사용하는 TypeScript 타입/인터페이스 모음입니다.

이 패키지는 런타임 로직이 아니라, 각 패키지(`core`, `memory`, `mcp-client`) 사이의 계약(Contract)을 타입으로 고정하기 위해 존재합니다.

## 설치

모노레포 내부 워크스페이스 의존성으로 사용됩니다.

```bash
bun install
```

## 사용법

패키지별로 하위 경로(export subpath)로 나눠서 임포트할 수 있습니다.

```ts
import type { Task, TaskResult } from "@amicus/types/core";
import type { Tool } from "@amicus/types/mcp";
```

## Export 경로

- `@amicus/types/core`: 작업/결과/우선순위 등 코어 도메인 타입
- `@amicus/types/memory`: 메모리/컨텍스트 관련 타입
- `@amicus/types/mcp`: MCP 도구/결과/이벤트 관련 타입
- `@amicus/types/errors`: 공통 에러 타입

참고:
- `@amicus/types/safety`는 과거 Safety 패키지와 맞추기 위해 존재할 수 있으나, 현재 리포지토리에서는 `packages/safety`를 제거했으므로 런타임에서 사용하지 않습니다.

## 언제 이 패키지를 쓰나

- `packages/core`에서 `RoutineEngine` 입력/출력 타입(`Task`, `TaskResult`)을 고정할 때
- `ToolRegistry`가 다루는 도구 타입(`Tool`)을 외부 MCP 구현과 독립적으로 유지할 때
- 통합 테스트에서 각 컴포넌트의 계약을 명확히 할 때

## 빌드

```bash
cd packages/types
bun run build
```
