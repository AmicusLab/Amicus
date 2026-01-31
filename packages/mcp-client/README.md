# @amicus/mcp-client

Amicus에서 MCP(Model Context Protocol) 서버와 연결하고, 서버가 제공하는 도구(tool)를 발견/호출하기 위한 클라이언트 패키지입니다.

현재 구현은 `@modelcontextprotocol/sdk`를 기반으로 하며, 테스트에서는 실제 MCP 서버 대신 mock으로 동작을 검증합니다.

## 설치

모노레포 내부 워크스페이스 의존성으로 사용됩니다.

```bash
bun install
```

## 사용법

### 클라이언트 생성

```ts
import { MCPClient } from "@amicus/mcp-client";

const client = new MCPClient({
  name: "amicus",
  version: "0.1.0",
  transport: "stdio", // 또는 "http"
  command: "node",
  args: ["path/to/mcp-server.js"],
});
```

### 연결 / 도구 탐색 / 도구 실행

```ts
await client.connect();

const tools = await client.discoverTools();
// tools: Array<{ name, description, inputSchema }>

const result = await client.invokeTool("search-web", { query: "hello" });
if (result.isError) {
  // 에러 처리
}

await client.disconnect();
```

## API 개요

`packages/mcp-client/src/MCPClient.ts` 기준으로 핵심 메서드는 아래와 같습니다.

- `connect()` / `disconnect()`
- `discoverTools()`
- `invokeTool(name, params)`

타입은 `@amicus/mcp-client`에서 함께 export 됩니다:

```ts
import type { MCPClientOptions, Tool, ToolResult } from "@amicus/mcp-client";
```

또한, 시스템 전체 계약 관점에서는 `@amicus/types/mcp`의 `Tool`/`ToolResult`를 기준으로 맞추는 것을 권장합니다.

## 테스트

```bash
cd packages/mcp-client
bun test
```
