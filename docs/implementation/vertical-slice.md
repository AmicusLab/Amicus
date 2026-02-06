# Vertical Slice Implementation (Stage 1-3)

## 1. Overview

This document describes the implemented vertical slice that connects a user command to LLM reasoning, optional tool execution (filesystem write), and a minimal git safety mechanism.

Objectives:

- End-to-end pipeline: CLI input -> Daemon API -> LLM response -> (optional) tool call -> file write
- Progressive delivery in 3 stages:
  - Stage 1 (Skeleton): CLI REPL + Daemon `/chat` + ChatEngine text responses
  - Stage 2 (Hands): Function calling + ToolExecutor + MCP `write_file`
  - Stage 3 (Safety Lite): SafeMCPClient auto-commits before tool execution

Deliverables (key components):

- CLI chat REPL: `apps/cli/src/commands/chat.tsx`
- Daemon chat API: `apps/daemon/src/routes/chat.ts`
- LLM integration + tool-call detection: `packages/core/src/chat/ChatEngine.ts`
- Tool execution service: `apps/daemon/src/services/ToolExecutor.ts`
- Git safety wrapper: `packages/mcp-client/src/SafeMCPClient.ts`

Non-goals for this slice:

- Dashboard integration (CLI only)
- Multi-tool orchestration and loops (single tool call per user request)
- Rollback / approval workflows (commit only)

## 2. Architecture

ASCII component diagram (runtime data flow):

```
User
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
  | toolCalls[] detected?
  v
ToolExecutor
  |
  v
SafeMCPClient (Git wrapper)
  |
  | auto-commit before tool execution
  v
MCPClient -> @modelcontextprotocol/server-filesystem (stdio)
  |
  v
Filesystem write (write_file)
```

Request/response shape (high level):

- CLI maintains an in-memory `Message[]` and sends it as-is.
- Daemon returns a single string response to print in the REPL.
- If a tool call happens, the daemon executes it once, appends a tool result message, and then re-queries the model for the final user-facing text.

## 3. Implementation Details

### 3.1 Daemon `/chat` route

File: `apps/daemon/src/routes/chat.ts`

- Input validation:
  - Parses JSON and validates `messages: Message[]` (role + content).
  - `config` is optional.
- Initialization:
  - Ensures `providerService` is initialized.
  - Caches a single `ChatEngine` instance at module scope.
  - Lazily initializes MCP client on first request.
- Tool loop (single call constraint):
  - Calls `chatEngine.chat(messages, config)`.
  - If `result.response.type === 'tool_call'`:
    - Executes tool via `toolExecutor.execute(tool, args)`.
    - Pushes an assistant message containing `JSON.stringify(toolResult)`.
    - Calls `chatEngine.chat(...)` again.
    - If the second result is also `tool_call`, returns an explicit error (no sequential tool calls).

Notes:

- The MCP filesystem server is spawned via:
  - `npx -y @modelcontextprotocol/server-filesystem <daemon_process_cwd>`
  - Current implementation passes `process.cwd()` from the daemon runtime.

### 3.2 ChatEngine (LLM + function calling)

File: `packages/core/src/chat/ChatEngine.ts`

- Uses Vercel AI SDK `generateText()`.
- Model selection:
  - If `config.model` is set, parses `provider:model` via `providerRegistry.parseModelId()`.
  - Otherwise routes by complexity: `providerRegistry.selectModel(50)`.
- Tools (Stage 2):
  - Accepts `config.tools: ToolDefinition[]`.
  - Converts MCP-like tool definitions into AI SDK tool config:
    - `generateConfig.tools = { [toolName]: { description, parameters: jsonSchema(schema) } }`
  - Tool call detection:
    - Reads `result.toolCalls`.
    - Returns only the first tool call (`result.toolCalls[0]`) to enforce the single-call constraint.
- Exact optional handling:
  - Optional generation params (`maxTokens`, `temperature`, `topP`) are assigned only when defined to avoid `undefined` under strict TS configs.

Response type:

- `text`: `{ type: 'text', content: string }`
- `tool_call`: `{ type: 'tool_call', toolCall: { tool: string, args: Record<string, unknown> } }`

### 3.3 ToolExecutor (dependency injection + single tool)

File: `apps/daemon/src/services/ToolExecutor.ts`

- Dependency injection pattern:
  - Constructed with an MCP-like client that exposes `callTool(name, params)`.
  - This allows switching from `MCPClient` to `SafeMCPClient` transparently.
- Supported tools:
  - `write_file` only.
- Error strategy:
  - Returns a structured result that is safe to stringify and feed back into the model.

### 3.4 SafeMCPClient (git safety lite)

File: `packages/mcp-client/src/SafeMCPClient.ts`

- Proxy/wrapper over `MCPClient`:
  - `callTool(name, params)` runs a git commit step and then calls `client.invokeTool(name, params)`.
- Git checks:
  - `git --version` (git availability)
  - `git rev-parse --is-inside-work-tree` (repo presence)
- Commit behavior:
  - Stages all changes: `git add -A`
  - Rejects empty commits:
    - `git diff --cached --quiet` -> throws `No changes to commit`
  - Commits with:
    - `Amicus auto-commit before <toolName>`

Operational note:

- Because it runs `git add -A`, any existing uncommitted changes in the repo will be included in the auto-commit.
- For predictable behavior, run the chat flow in a clean working tree.

### 3.5 Conversation history

- CLI side:
  - `apps/cli/src/commands/chat.tsx` stores an in-memory `Message[]` and resends it on each request.
  - UI shows the last 5 messages, but the request body includes the full in-memory history.
- Core side:
  - `packages/core/src/chat/ConversationManager.ts` exists (Map-based, max 20 messages) but is not currently wired into the daemon route.
  - Future stage can move session-based history into the daemon using this manager.

## 4. Usage

Prerequisites:

- `bun install` completed at repo root.
- Daemon can reach an LLM provider via environment variables (see Configuration).

Step-by-step:

```bash
# Terminal 1: start daemon
bun run --cwd apps/daemon dev

# Terminal 2: start CLI chat
bun run --cwd apps/cli start chat
```

Example interaction:

```
You: Create file test.txt with content: Hello World
Amicus: (confirms result / provides follow-up)
```

Verify:

```bash
cat test.txt

# last commit should be the auto-commit performed before write_file
git log -1 --format=%s
```

Expected git subject contains:

- `Amicus auto-commit before write_file`

## 5. Configuration

### 5.1 LLM provider API keys

The runtime uses the existing ProviderRegistry / provider plugins. Set the API key required by your configured default provider.

Common examples:

- `ANTHROPIC_API_KEY` (Claude)
- `OPENAI_API_KEY` (OpenAI)

Notes:

- This vertical slice does not introduce new secrets.
- Do not put secrets in any `VITE_*` env vars (Dashboard guardrail).

### 5.2 Daemon port

- Default daemon port is `3000`.

### 5.3 CLI -> Daemon endpoint

- CLI uses the daemon base URL (typically `http://localhost:3000`).
- If your setup differs, configure the CLI API URL via environment variable if supported by your CLI API client.

### 5.4 MCP filesystem server

- Daemon spawns the MCP filesystem server with root directory equal to daemon `process.cwd()`.
- Tool `write_file` paths are interpreted relative to that server root (behavior depends on the MCP filesystem server).

## 6. Testing

Project-level verification (recommended):

```bash
bun run verify
```

Focused tests (optional):

```bash
bun test packages/core/src/chat/
bun test apps/daemon/src/services/
```

Basic runtime smoke check (manual CLI run):

```bash
bun run --cwd apps/daemon dev
bun run --cwd apps/cli start chat
```

## 7. Constraints & Limitations (Stage 2 scope)

- Single tool only: `write_file`
- Single tool call per request (no loops; daemon rejects sequential tool calls)
- Conversation history is in-memory only (CLI-managed); no persistence
- No Dashboard integration
- No rollback mechanism (git commit only; no branch/stash/undo)
