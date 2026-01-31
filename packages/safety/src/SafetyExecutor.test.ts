import { describe, expect, it } from "bun:test";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { SafetyExecutor } from "./SafetyExecutor.js";

describe("SafetyExecutor", () => {
  it("rolls back to previous commit when operation throws", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "amicus-safety-test-"));
    const git = simpleGit({ baseDir: repoRoot });

    await git.init();
    // CI environments often don't have git author identity configured,
    // and this test creates commits in a temp repository.
    await git.addConfig("user.name", "Amicus CI");
    await git.addConfig("user.email", "ci@amicus.local");

    const filePath = join(repoRoot, "hello.txt");
    await writeFile(filePath, "v1\n", "utf8");
    await git.add(["hello.txt"]);
    await git.commit("init");

    const beforeHead = (await git.revparse(["HEAD"])).trim();

    const safety = new SafetyExecutor({ repoRoot, dirtyStateStrategy: "error" });

    await expect(
      safety.execute("test rollback", async () => {
        await writeFile(filePath, "v2\n", "utf8");
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const afterHead = (await git.revparse(["HEAD"])).trim();
    expect(afterHead).toBe(beforeHead);

    const content = await readFile(filePath, "utf8");
    expect(content).toBe("v1\n");
  });
});
