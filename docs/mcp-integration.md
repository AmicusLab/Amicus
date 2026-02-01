# MCP 통합 가이드

Amicus는 **MCP (Model Context Protocol)**를 사용하여 외부 도구와 서비스를 통합합니다. 이 문서는 MCP 서버 설정, 사용 방법, 커스텀 서버 추가 방법을 설명합니다.

---

## 1. 개요 (Overview)

### MCP란?

MCP (Model Context Protocol)는 AI 모델이 외부 도구와 서비스에 접근할 수 있게 해주는 표준 프로토콜입니다. Amicus에서는 MCP를 통해 다음과 같은 기능을 수행할 수 있습니다:

- **파일 시스템 접근**: 로컬 파일 읽기/쓰기
- **GitHub API**: 저장소, 이슈, PR 관리
- **커스텀 도구**: 사용자 정의 서비스 통합

### 아키텍처

```
[Daemon] → [MCPService] → [MCPManager] → [MCPClient]
                                    ↓
                            [MCP Servers]
                            - Filesystem
                            - GitHub
                            - Custom
```

- **MCPManager**: 서버 관리, 연결/연결 해제
- **MCPClient**: 개별 서버와 통신, 도구 실행
- **MCPService**: Daemon 서비스 계층 통합

---

## 2. 지원되는 MCP 서버 (Supported MCP Servers)

### 현재 지원 서버

| 서버 ID | 이름 | 용도 | 기본 활성화 |
|---------|------|------|-----------|
| `filesystem` | Local Filesystem | 로컬 파일 시스템 접근 | ✅ Yes |
| `github` | GitHub API | GitHub 저장소 관리 | ❌ No |

### Filesystem 서버

- **용도**: 지정된 디렉토리 내에서 파일 읽기/쓰기/탐색
- **접근 경로**: 기본적으로 `data/` 디렉토리
- **도구 예시**: `read_file`, `write_file`, `list_directory`

### GitHub 서버

- **용도**: GitHub 저장소, 이슈, Pull Request 관리
- **필요 항목**: GitHub Personal Access Token
- **도구 예시**: `create_issue`, `list_pull_requests`, `create_pull_request`

---

## 3. 빠른 시작 (Quick Start)

### 1단계: 환경 변수 설정

`.env` 파일 생성 또는 수정:

```bash
# GitHub 서버 사용시 (선택사항)
GITHUB_TOKEN=ghp_your_personal_access_token_here

# MCP 설정 파일 경로 (선택사항, 기본값: ./data/mcp-servers.json)
MCP_CONFIG_PATH=./data/mcp-servers.json
```

### 2단계: MCP 서버 설정

`data/mcp-servers.json` 확인:

```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "Local Filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/zemyblue/Documents/projects/Amicus/Amicus/data"],
      "enabled": true
    }
  ]
}
```

### 3단계: Daemon 실행

```bash
bun run --cwd apps/daemon dev
```

Daemon 시작 시 자동으로 활성화된 MCP 서버에 연결됩니다.

### 4단계: 연결 확인

```bash
curl http://localhost:3000/mcp/status
```

응답 예시:

```json
{
  "connected": true,
  "servers": [
    {
      "serverId": "filesystem",
      "connected": true
    }
  ]
}
```

---

## 4. 설정 (Configuration)

### mcp-servers.json 구조

```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "Local Filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"],
      "env": {
        "ENV_VAR": "value"
      },
      "enabled": true
    }
  ]
}
```

### 필드 설명

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | ✅ | 서버 고유 식별자 (알파벳, 숫자, 하이픈만 사용) |
| `name` | string | ✅ | 서버 표시 이름 |
| `transport` | string | ✅ | 전송 방식 (`stdio`만 현재 지원) |
| `command` | string | ✅ | 서버 실행 명령어 |
| `args` | string[] | ✅ | 명령어 인자 배열 |
| `env` | object | ❌ | 서버에 전달할 환경 변수 |
| `enabled` | boolean | ✅ | 서버 활성화 여부 |

### 설정 예시

#### Filesystem 서버 (기본)

```json
{
  "id": "filesystem",
  "name": "Local Filesystem",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/data"],
  "enabled": true
}
```

#### GitHub 서버

```json
{
  "id": "github",
  "name": "GitHub API",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
  },
  "enabled": true
}
```

---

## 5. 환경 변수 (Environment Variables)

### 필수 환경 변수

없음 (기본적으로 Filesystem 서버만 사용 가능)

### 선택적 환경 변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxx` |
| `MCP_CONFIG_PATH` | MCP 설정 파일 경로 | `./data/mcp-servers.json` |

### GitHub Token 생성 방법

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token (classic)" 클릭
3. 필요한 권한 선택:
   - `repo`: 저장소 접근
   - `issues`: 이슈 관리
   - `pull_requests`: PR 관리
4. 생성된 토큰 복사 후 `.env`에 추가

```bash
GITHUB_TOKEN=ghp_your_token_here
```

---

## 6. 사용 예시 (Usage Examples)

### MCPManager API

```typescript
import { MCPManager } from '@amicus/mcp-client';

const manager = new MCPManager();

// 서버 설정 로드
await manager.loadServers('./data/mcp-servers.json');

// 모든 활성화된 서버에 연결
const clients = await manager.connectToAllServers();
console.log(`Connected to ${clients.size} server(s)`);

// 특정 서버에만 연결
const filesystemClient = await manager.connectToServer('filesystem');

// 서버 상태 확인
const status = manager.getServerStatus();
console.log(status);
// [
//   { serverId: 'filesystem', connected: true, config: {...} }
// ]

// 연결된 서버 목록
const connectedServers = manager.getConnectedServers();
// ['filesystem']

// 특정 서버 연결 확인
const isConnected = manager.isServerConnected('filesystem');
// true

// 서버 설정 정보
const config = manager.getServerConfig('filesystem');
// { id: 'filesystem', name: 'Local Filesystem', ... }

// 서버 연결 해제
await manager.disconnectFromServer('filesystem');

// 모든 서버 연결 해제
await manager.disconnectAllServers();
```

### MCPClient API

```typescript
import { MCPClient } from '@amicus/mcp-client';

// 특정 서버에 연결
const client = await MCPClient.connectToServer('filesystem');

// 사용 가능한 도구 탐색
const tools = await client.discoverTools();
console.log(tools);
// [
//   { name: 'read_file', description: '...', inputSchema: {...} },
//   { name: 'write_file', description: '...', inputSchema: {...} },
//   { name: 'list_directory', description: '...', inputSchema: {...} }
// ]

// 도구 실행
const result = await client.invokeTool('read_file', {
  path: 'config.json'
});

if (result.isError) {
  console.error('Error:', result.content);
} else {
  console.log('Success:', result.content);
}

// 연결 해제
await MCPClient.disconnectFromServer('filesystem');
```

### MCPService (Daemon 내부)

```typescript
import { mcpService } from '@amicus/daemon/services/MCPService';

// Daemon 시작 시 초기화
await mcpService.initialize();

// 도구 탐색 (모든 연결된 서버에서)
const client = mcpService.getClient();
if (client) {
  const tools = await client.discoverTools();
  console.log(`Found ${tools.length} tools`);
}

// 도구 실행 (자동으로 해당 서버 찾음)
const result = await client.invokeTool('read_file', {
  path: 'data/note.txt'
});

// Daemon 종료 시 정리
await mcpService.shutdown();
```

---

## 7. 커스텀 MCP 서버 추가 (Adding Custom MCP Servers)

### 새로운 MCP 서버 추가 절차

#### 1. 서버 선택 또는 생성

[Model Context Protocol 공식 서버](https://github.com/modelcontextprotocol/servers)에서 원하는 서버를 찾거나 직접 개발합니다.

#### 2. mcp-servers.json에 서버 추가

```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "Local Filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/data"],
      "enabled": true
    },
    {
      "id": "my-custom-server",
      "name": "My Custom Server",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@myorg/mcp-custom-server"],
      "env": {
        "API_KEY": "${MY_API_KEY}"
      },
      "enabled": true
    }
  ]
}
```

#### 3. 환경 변수 설정 (필요시)

```bash
# .env
MY_API_KEY=your_api_key_here
```

#### 4. Daemon 재시작

```bash
# 실행 중인 Daemon 중지 후 다시 시작
bun run --cwd apps/daemon dev
```

#### 5. 연결 확인

```bash
curl http://localhost:3000/mcp/status
```

### 커스텀 서버 개발 가이드

#### 1. MCP 서버 프로젝트 생성

```bash
mkdir my-mcp-server
cd my-mcp-server
bun init -y
```

#### 2. 의존성 설치

```bash
bun add @modelcontextprotocol/sdk
```

#### 3. 서버 구현

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  {
    name: 'my-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// 도구 등록
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'my_tool',
        description: '사용자 정의 도구',
        inputSchema: {
          type: 'object',
          properties: {
            param1: { type: 'string' }
          },
          required: ['param1']
        }
      }
    ]
  };
});

// 도구 실행 핸들러
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'my_tool') {
    const result = await doSomething(args.param1);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  }

  throw new Error('Unknown tool');
});

// 서버 시작
const transport = new StdioServerTransport();
await server.connect(transport);
```

#### 4. 패키지로 배포 (선택)

```bash
bun publish
```

---

## 8. 문제 해결 (Troubleshooting)

### 일반적인 문제

#### 문제 1: Daemon 시작 시 MCP 서버 연결 실패

**증상:**
```
[MCPService] Failed to connect to server filesystem: Error: ...
```

**해결:**

1. 서버 설정 확인:
```bash
cat data/mcp-servers.json
```

2. 명령어가 올바른지 확인:
```bash
npx -y @modelcontextprotocol/server-filesystem --version
```

3. 디렉토리 경로 확인:
```bash
ls -la /path/to/data
```

#### 문제 2: GitHub 서버 인증 오류

**증상:**
```
[MCPService] Failed to connect to server github: Error: Bad credentials
```

**해결:**

1. 토큰 유효성 확인:
```bash
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
```

2. 토큰 권한 확인:
   - GitHub → Settings → Developer settings → Personal access tokens
   - `repo`, `issues`, `pull_requests` 권한이 있는지 확인

3. `.env` 파일 확인:
```bash
# 토큰이 올바르게 설정되었는지 확인
echo $GITHUB_TOKEN
```

#### 문제 3: 도구 실행 실패

**증상:**
```typescript
const result = await client.invokeTool('read_file', { path: 'nonexistent.txt' });
// result.isError === true
```

**해결:**

1. 도구 이름 확인:
```typescript
const tools = await client.discoverTools();
console.log(tools.map(t => t.name));
```

2. 파라미터 확인:
```typescript
// 도구의 inputSchema 확인
const tool = tools.find(t => t.name === 'read_file');
console.log(tool?.inputSchema);
```

3. 에러 메시지 분석:
```typescript
if (result.isError) {
  console.error('Tool error:', result.content);
}
```

#### 문제 4: 서버 연결 유지 실패

**증상:**
```
[MCPService] Lost connection to server filesystem
```

**해결:**

1. 서버 상태 확인:
```typescript
const status = manager.getServerStatus();
console.log(status);
```

2. 재연결 시도:
```typescript
await manager.disconnectFromServer('filesystem');
await manager.connectToServer('filesystem');
```

3. 서버 로그 확인:
```bash
# 서버 실행 시 로그 확인
npx -y @modelcontextprotocol/server-filesystem /path/to/data
```

#### 문제 5: 환경 변수가 로드되지 않음

**증상:**
```
Error: Environment variable 'GITHUB_TOKEN' is not defined
```

**해결:**

1. `.env` 파일 위치 확인:
```bash
ls -la .env
```

2. `.env.example` 복사:
```bash
cp .env.example .env
```

3. 직접 환경 변수 설정:
```bash
export GITHUB_TOKEN=ghp_your_token
bun run --cwd apps/daemon dev
```

4. `mcp-servers.json`에서 변수 참조 확인:
```json
{
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"  // 올바른 형식
  }
}
```

### 디버깅 팁

#### 로깅 활성화

```typescript
// 디버그 모드로 Daemon 실행
DEBUG=mcp:* bun run --cwd apps/daemon dev
```

#### 서버 연결 테스트

```bash
# 직접 MCP 서버 실행하여 테스트
npx -y @modelcontextprotocol/server-filesystem /path/to/data
```

#### 구성 유효성 검사

```typescript
import { MCPManager } from '@amicus/mcp-client';

const manager = new MCPManager();
try {
  await manager.loadServers('./data/mcp-servers.json');
  console.log('Config loaded successfully');
  console.log('Servers:', manager.getAllServerConfigs());
} catch (error) {
  console.error('Config error:', error);
}
```

#### 연결 상태 모니터링

```typescript
// 주기적으로 상태 확인
setInterval(() => {
  const status = manager.getServerStatus();
  status.forEach(s => {
    console.log(`${s.serverId}: ${s.connected ? 'connected' : 'disconnected'}`);
  });
}, 5000);
```

---

## 추가 리소스

- [MCP 공식 문서](https://modelcontextprotocol.io/)
- [MCP 서버 레지스트리](https://github.com/modelcontextprotocol/servers)
- [Amicus MCP 클라이언트 문서](../packages/mcp-client/README.md)
- [AGENTS.md](../AGENTS.md) - 프로젝트 전체 컨텍스트
