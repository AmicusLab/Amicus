# @amicus/memory

**Context Management & Memory System for Amicus AI**

This package provides short-term and long-term memory management using structured markdown files (`NOW.md` and `MEMORY.md`). The AI assistant uses this to maintain context across sessions and make informed decisions based on past experiences.

## Features

### Core Functionality

- **Context Loading**: `ContextManager.loadContext()` reads both memory files and returns formatted text for LLM prompt injection
- **Short-Term Updates**: `ContextManager.updateShortTerm(content)` updates the active session context (`NOW.md`) with timestamp and session ID
- **Memory Consolidation**: `ContextManager.consolidate()` archives important content from `NOW.md` to long-term memory (`MEMORY.md`) and resets short-term memory
- **Error Handling**: Custom error classes for file operations and validation

### File Structure

```
data/
├── NOW.md          # Short-term memory (current session, active tasks)
└── MEMORY.md       # Long-term memory (user preferences, past decisions, lessons learned)
```

## Installation

This package is part of the Amicus monorepo. It should be installed automatically as a workspace dependency:

```bash
bun install
```

## Usage

### Basic Setup

```typescript
import { ContextManager } from '@amicus/memory';

const contextManager = new ContextManager({
  repoRoot: process.cwd(),  // Optional: defaults to process.cwd()
});

// Load context for LLM prompt
const context = await contextManager.loadContext();

// Update short-term memory
await contextManager.updateShortTerm("Working on Phase 2 implementation");

// Consolidate (archive to long-term and clear short-term)
await contextManager.consolidate();
```

### API Reference

#### `ContextManagerOptions`

```typescript
interface ContextManagerOptions {
  repoRoot?: string;  // Root directory for memory files (defaults to process.cwd())
}
```

#### `ContextManager` Class

```typescript
class ContextManager {
  constructor(opts: ContextManagerOptions);

  // Load both NOW.md and MEMORY.md, return formatted context string
  async loadContext(): Promise<string>;

  // Update NOW.md with content, timestamp, and session ID
  async updateShortTerm(content: string): Promise<void>;

  // Archive NOW.md to MEMORY.md, reset NOW.md to empty template
  async consolidate(): Promise<void>;
}
```

### Memory File Formats

#### `NOW.md` (Short-Term Memory)

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

#### `MEMORY.md` (Long-Term Memory)

```markdown
# MEMORY.md - Long-Term Memory

## User Preferences
{userPreferences}

## Past Decisions
{pastDecisions}

## Lessons Learned
{lessonsLearned}
```

## Error Classes

- **`MemoryManagerError`**: Base error class for all memory-related errors
- **`FileReadError`**: Thrown when reading markdown files fails
- **`FileWriteError`**: Thrown when writing markdown files fails
- **`InvalidMarkdownError`**: Reserved for future markdown validation

## Testing

The package includes a comprehensive test suite covering:

- Default template creation when files don't exist
- Loading existing content from both files
- Updating short-term memory with timestamps
- Consolidating (archiving) and clearing
- Error handling for file operations
- Independence from SafetyExecutor (no git operations)

Run tests with:

```bash
bun test --filter @amicus/memory
```

## Integration with Amicus System

### How It Fits

`packages/memory` provides the **Persistence & Capability Layer** defined in the Amicus system architecture:

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

**Flow**:
1. **Routine Engine** calls `loadContext()` to get current state
2. Engine performs work and makes decisions
3. Engine calls `updateShortTerm()` to record progress/decisions
4. On session end, Engine calls `consolidate()` to archive important learnings
5. **Memory** persists to `data/` directory (human-readable markdown files)

### Key Principles

- **Trust-First**: All memory is stored in markdown files that can be version controlled
- **Decision-Centric Memory**: Records not just what happened, but **why** (reasoning behind decisions)
- **Human-Readable**: Markdown format allows developers to inspect and edit memory directly
- **Local-First**: All data is stored locally, no external dependencies or cloud services

## Notes

- This package is independent of `packages/safety` and does not use git operations directly
- Uses Bun's native file I/O for performance
- Implements atomic write pattern to prevent data corruption
- Creates default templates automatically if files don't exist
