import { resolve, dirname } from "node:path";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  FileReadError,
  FileWriteError,
  MemoryManagerError,
  InvalidMarkdownError,
} from "./errors.js";

export interface ContextManagerOptions {
  repoRoot?: string;
}

const DEFAULT_TEMPLATE_NOW = `# NOW.md - Active Context
Last Updated: {timestamp}
Session ID: {sessionId}

## Current Objective
{objective}

## In Progress
- [ ] Task 1
- [ ] Task 2

## Recent Decisions
{decisions}

## Notes
{notes}
`;

const DEFAULT_TEMPLATE_MEMORY = `# MEMORY.md - Long-Term Memory

## User Preferences
{userPreferences}

## Past Decisions
{pastDecisions}

## Lessons Learned
{lessonsLearned}
`;

declare global {
  const Bun: {
    file(path: string): {
      exists(): Promise<boolean>;
      text(): Promise<string>;
    };
  };
}

export class ContextManager {
  private readonly repoRoot: string;
  private readonly nowFilePath: string;
  private readonly memoryFilePath: string;

  constructor(opts: ContextManagerOptions = {}) {
    this.repoRoot = opts.repoRoot ?? process.cwd();
    this.nowFilePath = resolve(this.repoRoot, "data/NOW.md");
    this.memoryFilePath = resolve(this.repoRoot, "data/MEMORY.md");
  }

  async loadContext(): Promise<string> {
    try {
      const nowContent = await this.safeRead(this.nowFilePath, DEFAULT_TEMPLATE_NOW);
      const memoryContent = await this.safeRead(this.memoryFilePath, DEFAULT_TEMPLATE_MEMORY);
      return `## Current Context (NOW.md)\n${nowContent}\n\n## Long-Term Memory (MEMORY.md)\n${memoryContent}`;
    } catch (err) {
      throw new FileReadError(
        `Failed to load context: ${this.toErrorMessage(err)}`
      );
    }
  }

  async updateShortTerm(content: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const sessionId = randomUUID();
      const fullContent = DEFAULT_TEMPLATE_NOW
        .replace("{timestamp}", timestamp)
        .replace("{sessionId}", sessionId)
        .replace("{objective}", content)
        .replace("{decisions}", "")
        .replace("{notes}", "");

      await this.atomicWrite(this.nowFilePath, fullContent);
    } catch (err) {
      throw new FileWriteError(
        `Failed to update short-term memory: ${this.toErrorMessage(err)}`
      );
    }
  }

  async consolidate(): Promise<void> {
    try {
      const nowContent = await this.safeRead(this.nowFilePath, "");
      if (!nowContent.trim()) return;

      const timestamp = new Date().toISOString();
      const sessionSeparator = `\n\n---\n## Session Archived: ${timestamp}\n\n`;
      await this.atomicAppend(this.memoryFilePath, sessionSeparator + nowContent);
      await this.atomicWrite(this.nowFilePath, DEFAULT_TEMPLATE_NOW.replace("{timestamp}", new Date().toISOString()).replace("{sessionId}", randomUUID()).replace("{objective}", "").replace("{decisions}", "").replace("{notes}", ""));
    } catch (err) {
      throw new FileWriteError(
        `Failed to consolidate memory: ${this.toErrorMessage(err)}`
      );
    }
  }

  private async safeRead(
    filePath: string,
    defaultContent: string
  ): Promise<string> {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      await mkdir(dirname(filePath), { recursive: true });
      await this.atomicWrite(filePath, defaultContent);
      return defaultContent;
    }
    return await file.text();
  }

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.tmp`;
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(tmpPath, content, "utf8");
    await rename(tmpPath, filePath);
  }

  private async atomicAppend(filePath: string, content: string): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    // @ts-expect-error: Bun's writeFile typing doesn't match Node.js, but this is correct at runtime
    await writeFile(filePath, content, { flag: "a" as const }, "utf8");
  }

  private toErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
}
