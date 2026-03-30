import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { searchFilesTool } from '../search_files.js';

let TEST_DIR: string;
let originalCwd: string;

async function setup() {
  originalCwd = process.cwd();
  TEST_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'search-files-test-'));
  process.chdir(TEST_DIR);
}

async function cleanup() {
  process.chdir(originalCwd);
  await fs.rm(TEST_DIR, { recursive: true, force: true });
}

describe('search_files', () => {
  beforeEach(async () => {
    await setup();
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('basic search', () => {
    test('should find matches in files', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'Hello World\nGoodbye World');
      await fs.writeFile(path.join(TEST_DIR, 'file2.txt'), 'No match here');

      const result = await searchFilesTool.execute({
        query: 'World',
        path: '.',
      });

      expect(result).toContain('file1.txt');
      expect(result).toContain('World');
      expect(result).not.toContain('file2.txt');
    });

    test('should return line numbers with matches', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'test.txt'), 'line1\nline2\nmatching line\nline4');

      const result = await searchFilesTool.execute({
        query: 'matching',
        path: '.',
      });

      expect(result).toContain('test.txt');
      expect(result).toContain('3'); // line number
    });

    test('should show multiple matches per file', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'multi.txt'), 'foo bar\nbaz foo\nfoo qux');

      const result = await searchFilesTool.execute({
        query: 'foo',
        path: '.',
      });

      expect(result).toContain('multi.txt');
    });
  });

  describe('path filtering', () => {
    test('should search in specified directory', async () => {
      await fs.mkdir(path.join(TEST_DIR, 'subdir'));
      await fs.writeFile(path.join(TEST_DIR, 'root.txt'), 'match this');
      await fs.writeFile(path.join(TEST_DIR, 'subdir', 'child.txt'), 'match that');

      const result = await searchFilesTool.execute({
        query: 'match',
        path: 'subdir',
      });

      expect(result).toContain('child.txt');
      expect(result).not.toContain('root.txt');
    });

    test('should search recursively by default', async () => {
      await fs.mkdir(path.join(TEST_DIR, 'a', 'b'), { recursive: true });
      await fs.writeFile(path.join(TEST_DIR, 'a', 'b', 'deep.txt'), 'deep match');

      const result = await searchFilesTool.execute({
        query: 'deep',
        path: '.',
      });

      expect(result).toContain('deep.txt');
    });
  });

  describe('file pattern filtering', () => {
    test('should filter by file extension', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'script.ts'), 'const x: string');
      await fs.writeFile(path.join(TEST_DIR, 'README.md'), 'string description');

      const result = await searchFilesTool.execute({
        query: 'string',
        path: '.',
        include: '*.ts',
      });

      expect(result).toContain('script.ts');
      expect(result).not.toContain('README.md');
    });

    test('should support multiple patterns', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'a.ts'), 'match');
      await fs.writeFile(path.join(TEST_DIR, 'b.js'), 'match');
      await fs.writeFile(path.join(TEST_DIR, 'c.txt'), 'match');

      const result = await searchFilesTool.execute({
        query: 'match',
        path: '.',
        include: '*.ts,*.js',
      });

      expect(result).toContain('a.ts');
      expect(result).toContain('b.js');
      expect(result).not.toContain('c.txt');
    });
  });

  describe('case sensitivity', () => {
    test('should be case-insensitive by default', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'test.txt'), 'HELLO world');

      const result = await searchFilesTool.execute({
        query: 'hello',
        path: '.',
      });

      expect(result).toContain('test.txt');
    });

    test('should support case-sensitive search', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'test.txt'), 'Hello HELLO');

      const result = await searchFilesTool.execute({
        query: 'Hello',
        path: '.',
        case_sensitive: true,
      });

      expect(result).toContain('test.txt');
    });
  });

  describe('context lines', () => {
    test('should show context lines when requested', async () => {
      await fs.writeFile(
        path.join(TEST_DIR, 'test.txt'),
        'line before\nmatch here\nline after'
      );

      const result = await searchFilesTool.execute({
        query: 'match',
        path: '.',
        context_lines: 1,
      });

      expect(result).toContain('line before');
      expect(result).toContain('match here');
      expect(result).toContain('line after');
    });
  });

  describe('output format', () => {
    test('should return message when no matches found', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'test.txt'), 'no matches here');

      const result = await searchFilesTool.execute({
        query: 'nonexistent',
        path: '.',
      });

      expect(result).toContain('No matches found');
    });

    test('should limit results', async () => {
      for (let i = 0; i < 20; i++) {
        await fs.writeFile(path.join(TEST_DIR, `file${i}.txt`), 'match');
      }

      const result = await searchFilesTool.execute({
        query: 'match',
        path: '.',
        max_results: 5,
      });

      expect(result).toMatch(/(5|limit|truncated)/i);
    });
  });

  describe('security', () => {
    test('should reject path traversal', async () => {
      const result = await searchFilesTool.execute({
        query: 'anything',
        path: '../../../etc',
      });

      expect(result).toContain('Path traversal detected');
    });

    test('should exclude hidden files and directories', async () => {
      await fs.mkdir(path.join(TEST_DIR, '.hidden-dir'));
      await fs.writeFile(path.join(TEST_DIR, '.hidden-file'), 'match');
      await fs.writeFile(path.join(TEST_DIR, 'visible.txt'), 'match');

      const result = await searchFilesTool.execute({
        query: 'match',
        path: '.',
      });

      expect(result).toContain('visible.txt');
      expect(result).not.toContain('.hidden');
    });

    test('should exclude node_modules by default', async () => {
      await fs.mkdir(path.join(TEST_DIR, 'node_modules'));
      await fs.writeFile(
        path.join(TEST_DIR, 'node_modules', 'pkg.txt'),
        'match'
      );
      await fs.writeFile(path.join(TEST_DIR, 'src.txt'), 'match');

      const result = await searchFilesTool.execute({
        query: 'match',
        path: '.',
      });

      expect(result).toContain('src.txt');
      expect(result).not.toContain('node_modules');
    });
  });

  describe('error handling', () => {
    test('should handle non-existent directory', async () => {
      const result = await searchFilesTool.execute({
        query: 'test',
        path: 'nonexistent',
      });

      expect(result).toContain('not found');
    });

    test('should handle binary files gracefully', async () => {
      const binaryContent = Buffer.from([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05,
      ]);
      await fs.writeFile(path.join(TEST_DIR, 'binary.bin'), binaryContent);
      await fs.writeFile(path.join(TEST_DIR, 'text.txt'), 'match this');

      const result = await searchFilesTool.execute({
        query: 'match',
        path: '.',
      });

      expect(result).toContain('text.txt');
    });
  });
});
