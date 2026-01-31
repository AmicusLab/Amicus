import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { ContextManager } from "./ContextManager.js";

describe("ContextManager", () => {
  let testDir: string;
  let cm: ContextManager;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), "memory-test-"));
    cm = new ContextManager({ repoRoot: testDir });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("loadContext()", () => {
    it("creates default templates if files don't exist", async () => {
      const context = await cm.loadContext();

      expect(context).toContain("## Current Context (NOW.md)");
      expect(context).toContain("## Long-Term Memory (MEMORY.md)");
      expect(context).toContain("Last Updated:");
      expect(context).toContain("Session ID:");
    });

    it("loads existing NOW.md and MEMORY.md content", async () => {
      const nowPath = join(testDir, "data/NOW.md");
      const memoryPath = join(testDir, "data/MEMORY.md");

      await writeFile(nowPath, "Test NOW content\n");
      await writeFile(memoryPath, "Test MEMORY content\n");

      const context = await cm.loadContext();

      expect(context).toContain("Test NOW content");
      expect(context).toContain("Test MEMORY content");
    });

    it("handles missing NOW.md only", async () => {
      const memoryPath = join(testDir, "data/MEMORY.md");
      await writeFile(memoryPath, "MEMORY exists\n");

      const context = await cm.loadContext();

      expect(context).toContain("## Long-Term Memory (MEMORY.md)");
      expect(context).toContain("MEMORY exists");
    });

    it("handles missing MEMORY.md only", async () => {
      const nowPath = join(testDir, "data/NOW.md");
      await writeFile(nowPath, "NOW exists\n");

      const context = await cm.loadContext();

      expect(context).toContain("## Current Context (NOW.md)");
      expect(context).toContain("NOW exists");
    });
  });

  describe("updateShortTerm()", () => {
    it("writes content to NOW.md with timestamp and session ID", async () => {
      await cm.updateShortTerm("Test objective");

      const content = await Bun.file(join(testDir, "data/NOW.md")).text();

      expect(content).toContain("Test objective");
      expect(content).toMatch(
        /Last Updated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/
      );
      expect(content).toMatch(
        /Session ID: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
      );
    });

    it("clears NOW.md after consolidation", async () => {
      const nowPath = join(testDir, "data/NOW.md");
      const memoryPath = join(testDir, "data/MEMORY.md");

      await writeFile(nowPath, "NOW content\n");
      await writeFile(memoryPath, "Initial MEMORY\n");

      await cm.consolidate();
      const nowContent = await Bun.file(nowPath).text();

      expect(nowContent).not.toContain("NOW content");
      expect(nowContent).toContain("Last Updated:");
      expect(nowContent).toContain("# NOW.md - Active Context");
    });
  });

  describe("Error Handling", () => {
    it("throws FileReadError when file cannot be read", async () => {
      const cm2 = new ContextManager({ repoRoot: "/nonexistent/path" });
      await expect(cm2.loadContext()).rejects.toThrow("Failed to load context");
    });

    it("throws FileWriteError when file cannot be written", async () => {
      const cm2 = new ContextManager({ repoRoot: "/readonly/dir" });
      await expect(cm2.updateShortTerm("Test")).rejects.toThrow("Failed to update short-term memory");
    });
  });

  describe("Integration with SafetyExecutor", () => {
    it("does not depend on SafetyExecutor (independent package)", async () => {
      const nowPath = join(testDir, "data/NOW.md");

      await cm.updateShortTerm("Test");
      const content = await Bun.file(nowPath).text();

      expect(content).toContain("## Current Objective");
      expect(content).toContain("Test");
    });
  });
});
