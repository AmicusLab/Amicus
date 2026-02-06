# 수직적 슬라이스 구현 (Stage 1-3)

## 1. 개요

이 문서는 사용자 명령을 LLM 추론, 선택적 도구 실행(파일 시스템 쓰기), 그리고 최소한의 git 안전 메커니즘으로 연결하는 수직적 슬라이스 구현을 설명합니다.

목표:

- 엔드투엔드 파이프라인: CLI 입력 -> Daemon API -> LLM 응답 -> (선택적) 도구 호출 -> 파일 쓰기
- 3단계 점진적 구현:
  - Stage 1 (Skeleton): CLI REPL + Daemon `/chat` + ChatEngine 텍스트 응답
  - Stage 2 (Hands): Function calling + ToolExecutor + MCP `write_file`
  - Stage 3 (Safety Lite): SafeMCPClient가 도구 실행 전 자동 커밋

주요 산출물 (핵심 컴포넌트):

- CLI chat REPL: `apps/cli/src/commands/chat.tsx`
- Daemon chat API: `apps/daemon/src/routes/chat.ts`
- LLM 통합 + tool-call 감지: `packages/core/src/chat/ChatEngine.ts`
- 도구 실행 서비스: `apps/daemon/src/services/ToolExecutor.ts`
- Git 안전 래퍼: `packages/mcp-client/src/SafeMCPClient.ts`

이번 슬라이스의 비목표:

- Dashboard 통합 (CLI만 지원)
- 다중 도구 오케스트레이션 및 루프 (사용자 요청당 단일 도구 호출만)
- Rollback / 승인 워크플로우 (커밋만 수행)

## 2. 아키텍처

ASCII 컴포넌트 다이어그램 (런타임 데이터 흐름):

```
User (사용자)
  |
  v
CLI REPL (React Ink)
  |
  | POST /chat { messages, config }
  v
Daemon /chat Route (Hono)
  |
  v
ChatEngine (Vercel AI SDK: generateText)
  |
  | toolCalls[] 감지됨?
  v
ToolExecutor
  |
  v
SafeMCPClient (Git 래퍼)
  |
  | 도구 실행 전 자동 커밋
  v
MCPClient -> @modelcontextprotocol/server-filesystem (stdio)
  |
  v
파일 시스템 쓰기 (write_file)
```

요청/응답 구조 (상위 수준):

- CLI는 인메모리 `Message[]`를 유지하고 그대로 전송합니다.
- Daemon은 REPL에 출력할 단일 문자열 응답을 반환합니다.
- 도구 호출이 발생하면, daemon은 한 번 실행하고, 도구 결과 메시지를 추가한 다음, 최종 사용자용 텍스트를 위해 모델을 다시 쿼리합니다.

## 3. 구현 세부사항

### 3.1 Daemon `/chat` 라우트

파일: `apps/daemon/src/routes/chat.ts`

- 입력 검증:
  - JSON을 파싱하고 `messages: Message[]` (role + content)를 검증합니다.
  - `config`는 선택 사항입니다.
- 초기화:
  - `providerService`가 초기화되었는지 확인합니다.
  - 모듈 스코프에서 단일 `ChatEngine` 인스턴스를 캐싱합니다.
  - 첫 요청 시 MCP 클라이언트를 지연 초기화합니다.
- 도구 루프 (단일 호출 제약):
  - `chatEngine.chat(messages, config)`를 호출합니다.
  - `result.response.type === 'tool_call'`이면:
    - `toolExecutor.execute(tool, args)`로 도구를 실행합니다.
    - `JSON.stringify(toolResult)`를 포함하는 assistant 메시지를 추가합니다.
    - `chatEngine.chat(...)`를 다시 호출합니다.
    - 두 번째 결과도 `tool_call`이면, 명시적 에러를 반환합니다 (순차적 도구 호출 불가).

참고사항:

- MCP 파일시스템 서버는 다음과 같이 실행됩니다:
  - `npx -y @modelcontextprotocol/server-filesystem <daemon_process_cwd>`
  - 현재 구현은 daemon 런타임의 `process.cwd()`를 전달합니다.

### 3.2 ChatEngine (LLM + function calling)

파일: `packages/core/src/chat/ChatEngine.ts`

- Vercel AI SDK의 `generateText()`를 사용합니다.
- 모델 선택:
  - `config.model`이 설정되어 있으면, `providerRegistry.parseModelId()`로 `provider:model`을 파싱합니다.
  - 그렇지 않으면 complexity로 라우팅: `providerRegistry.selectModel(50)`.
- 도구 (Stage 2):
  - `config.tools: ToolDefinition[]`를 받습니다.
  - MCP 형식의 도구 정의를 AI SDK 도구 설정으로 변환합니다:
    - `generateConfig.tools = { [toolName]: { description, parameters: jsonSchema(schema) } }`
  - 도구 호출 감지:
    - `result.toolCalls`를 읽습니다.
    - 단일 호출 제약을 강제하기 위해 첫 번째 도구 호출(`result.toolCalls[0]`)만 반환합니다.
- 선택적 파라미터 처리:
  - 선택적 생성 파라미터(`maxTokens`, `temperature`, `topP`)는 정의되었을 때만 할당하여 엄격한 TS 설정에서 `undefined`를 방지합니다.

응답 타입:

- `text`: `{ type: 'text', content: string }`
- `tool_call`: `{ type: 'tool_call', toolCall: { tool: string, args: Record<string, unknown> } }`

### 3.3 ToolExecutor (의존성 주입 + 단일 도구)

파일: `apps/daemon/src/services/ToolExecutor.ts`

- 의존성 주입 패턴:
  - `callTool(name, params)`를 노출하는 MCP 형식 클라이언트로 생성됩니다.
  - 이를 통해 `MCPClient`에서 `SafeMCPClient`로 투명하게 전환할 수 있습니다.
- 지원 도구:
  - `write_file`만 지원합니다.
- 에러 전략:
  - 문자열화하여 모델에 다시 입력하기에 안전한 구조화된 결과를 반환합니다.

### 3.4 SafeMCPClient (git safety lite)

파일: `packages/mcp-client/src/SafeMCPClient.ts`

- `MCPClient`의 프록시/래퍼:
  - `callTool(name, params)`는 git commit 단계를 실행한 다음 `client.invokeTool(name, params)`를 호출합니다.
- Git 확인:
  - `git --version` (git 사용 가능 여부)
  - `git rev-parse --is-inside-work-tree` (저장소 존재 여부)
- 커밋 동작:
  - 모든 변경사항 스테이징: `git add -A`
  - 빈 커밋 거부:
    - `git diff --cached --quiet` -> `No changes to commit` 예외 발생
  - 커밋 메시지:
    - `Amicus auto-commit before <toolName>`

운영 참고사항:

- `git add -A`를 실행하므로, 저장소의 기존 커밋되지 않은 변경사항이 자동 커밋에 포함됩니다.
- 예측 가능한 동작을 위해, 깨끗한 작업 트리에서 chat 플로우를 실행하세요.

### 3.5 대화 히스토리

- CLI 측면:
  - `apps/cli/src/commands/chat.tsx`는 인메모리 `Message[]`를 저장하고 각 요청마다 다시 전송합니다.
  - UI는 최근 5개 메시지를 표시하지만, 요청 본문에는 전체 인메모리 히스토리가 포함됩니다.
- Core 측면:
  - `packages/core/src/chat/ConversationManager.ts`가 존재하지만 (Map 기반, 최대 20개 메시지), 현재 daemon 라우트에 연결되어 있지 않습니다.
  - 향후 단계에서 이 매니저를 사용하여 세션 기반 히스토리를 daemon으로 이동할 수 있습니다.

## 4. 사용법

사전 요구사항:

- 저장소 루트에서 `bun install` 완료.
- Daemon이 환경 변수를 통해 LLM 프로바이더에 접근할 수 있어야 합니다 (Configuration 참조).

단계별 실행:

```bash
# 터미널 1: daemon 시작
bun run --cwd apps/daemon dev

# 터미널 2: CLI chat 시작
bun run --cwd apps/cli start chat
```

예시 대화:

```
You: Create file test.txt with content: Hello World
Amicus: (결과 확인 / 후속 조치 제공)
```

검증:

```bash
cat test.txt

# 마지막 커밋은 write_file 전에 수행된 자동 커밋이어야 합니다
git log -1 --format=%s
```

예상 git 제목:

- `Amicus auto-commit before write_file`

## 5. 설정

### 5.1 LLM 프로바이더 API 키

런타임은 기존 ProviderRegistry / provider 플러그인을 사용합니다. 설정된 기본 프로바이더에서 필요한 API 키를 설정하세요.

일반적인 예시:

- `ANTHROPIC_API_KEY` (Claude)
- `OPENAI_API_KEY` (OpenAI)

참고사항:

- 이 수직적 슬라이스는 새로운 시크릿을 도입하지 않습니다.
- `VITE_*` 환경 변수에 시크릿을 넣지 마세요 (Dashboard 가드레일).

### 5.2 Daemon 포트

- 기본 daemon 포트는 `3000`입니다.

### 5.3 CLI -> Daemon 엔드포인트

- CLI는 daemon 기본 URL을 사용합니다 (일반적으로 `http://localhost:3000`).
- 설정이 다르면, CLI API 클라이언트가 지원하는 경우 환경 변수를 통해 CLI API URL을 설정하세요.

### 5.4 MCP 파일시스템 서버

- Daemon은 MCP 파일시스템 서버를 daemon `process.cwd()`와 동일한 루트 디렉토리로 실행합니다.
- `write_file` 도구의 경로는 해당 서버 루트를 기준으로 해석됩니다 (MCP 파일시스템 서버의 동작에 따라 다름).

## 6. 테스트

프로젝트 수준 검증 (권장):

```bash
bun run verify
```

집중 테스트 (선택):

```bash
bun test packages/core/src/chat/
bun test apps/daemon/src/services/
```

기본 런타임 스모크 체크 (수동 CLI 실행):

```bash
bun run --cwd apps/daemon dev
bun run --cwd apps/cli start chat
```

## 7. 제약사항 및 한계 (Stage 2 범위)

- 단일 도구만 지원: `write_file`
- 요청당 단일 도구 호출 (루프 없음; daemon이 순차적 도구 호출을 거부)
- 대화 히스토리는 인메모리만 (CLI 관리); 영속성 없음
- Dashboard 통합 없음
- Rollback 메커니즘 없음 (git commit만; branch/stash/undo 없음)
