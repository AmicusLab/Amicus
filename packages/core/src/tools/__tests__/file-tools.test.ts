import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createFileTool } from '../create_file.js';
import { readFileTool } from '../read_file.js';
import { editFileTool } from '../edit_file.js';
import { deleteFileTool } from '../delete_file.js';
import { listDirectoryTool } from '../list_directory.js';

const TEST_DIR = path.join(process.cwd(), '__test_sandbox__');

async function setup() {
  await fs.mkdir(TEST_DIR, { recursive: true });
}

async function cleanup() {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
}

describe('File Tools', () => {
  beforeEach(async () => {
    await setup();
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('create_file', () => {
    test('should create a new file', async () => {
      const result = await createFileTool.execute({
        path: '__test_sandbox__/hello.txt',
        content: 'Hello, World!',
      });

      expect(result).toContain('Successfully created');
      const content = await fs.readFile(path.join(TEST_DIR, 'hello.txt'), 'utf-8');
      expect(content).toBe('Hello, World!');
    });

    test('should create nested directories', async () => {
      const result = await createFileTool.execute({
        path: '__test_sandbox__/a/b/c/deep.txt',
        content: 'deep file',
      });

      expect(result).toContain('Successfully created');
      const content = await fs.readFile(path.join(TEST_DIR, 'a/b/c/deep.txt'), 'utf-8');
      expect(content).toBe('deep file');
    });

    test('should reject path traversal', async () => {
      const result = await createFileTool.execute({
        path: '../../../etc/passwd',
        content: 'malicious',
      });

      expect(result).toContain('Path traversal detected');
    });
  });

  describe('read_file', () => {
    test('should read an existing file', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'read-me.txt'), 'file content here');

      const result = await readFileTool.execute({
        path: '__test_sandbox__/read-me.txt',
      });

      expect(result).toBe('file content here');
    });

    test('should return error for non-existent file', async () => {
      const result = await readFileTool.execute({
        path: '__test_sandbox__/no-such-file.txt',
      });

      expect(result).toContain('File not found');
    });

    test('should reject path traversal', async () => {
      const result = await readFileTool.execute({
        path: '../../../etc/passwd',
      });

      expect(result).toContain('Path traversal detected');
    });
  });

  describe('edit_file', () => {
    test('should replace exact string match', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'edit-me.txt'), 'Hello, World!');

      const result = await editFileTool.execute({
        path: '__test_sandbox__/edit-me.txt',
        old_string: 'World',
        new_string: 'Amicus',
      });

      expect(result).toContain('Successfully edited');
      const content = await fs.readFile(path.join(TEST_DIR, 'edit-me.txt'), 'utf-8');
      expect(content).toBe('Hello, Amicus!');
    });

    test('should return error when old_string not found', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'edit-me.txt'), 'Hello, World!');

      const result = await editFileTool.execute({
        path: '__test_sandbox__/edit-me.txt',
        old_string: 'not-in-file',
        new_string: 'replacement',
      });

      expect(result).toContain('old_string not found');
    });

    test('should return error when old_string has multiple matches', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'edit-me.txt'), 'aaa bbb aaa');

      const result = await editFileTool.execute({
        path: '__test_sandbox__/edit-me.txt',
        old_string: 'aaa',
        new_string: 'ccc',
      });

      expect(result).toContain('found 2 times');
    });

    test('should return error for non-existent file', async () => {
      const result = await editFileTool.execute({
        path: '__test_sandbox__/no-file.txt',
        old_string: 'a',
        new_string: 'b',
      });

      expect(result).toContain('File not found');
    });

    test('should reject path traversal', async () => {
      const result = await editFileTool.execute({
        path: '../../../etc/passwd',
        old_string: 'root',
        new_string: 'hacked',
      });

      expect(result).toContain('Path traversal detected');
    });
  });

  describe('delete_file', () => {
    test('should delete an existing file', async () => {
      const filePath = path.join(TEST_DIR, 'delete-me.txt');
      await fs.writeFile(filePath, 'to be deleted');

      const result = await deleteFileTool.execute({
        path: '__test_sandbox__/delete-me.txt',
      });

      expect(result).toContain('Successfully deleted');
      await expect(fs.access(filePath)).rejects.toThrow();
    });

    test('should return error for non-existent file', async () => {
      const result = await deleteFileTool.execute({
        path: '__test_sandbox__/no-file.txt',
      });

      expect(result).toContain('File not found');
    });

    test('should reject path traversal', async () => {
      const result = await deleteFileTool.execute({
        path: '../../../etc/passwd',
      });

      expect(result).toContain('Path traversal detected');
    });
  });

  describe('list_directory', () => {
    test('should list files and directories', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'file1.txt'), 'a');
      await fs.writeFile(path.join(TEST_DIR, 'file2.txt'), 'b');
      await fs.mkdir(path.join(TEST_DIR, 'subdir'));

      const result = await listDirectoryTool.execute({
        path: '__test_sandbox__',
      });

      expect(result).toContain('[dir] subdir');
      expect(result).toContain('[file] file1.txt');
      expect(result).toContain('[file] file2.txt');
    });

    test('should sort directories before files', async () => {
      await fs.writeFile(path.join(TEST_DIR, 'aaa.txt'), 'a');
      await fs.mkdir(path.join(TEST_DIR, 'zzz-dir'));

      const result = await listDirectoryTool.execute({
        path: '__test_sandbox__',
      });

      const lines = result.split('\n');
      expect(lines[0]).toContain('[dir]');
      expect(lines[1]).toContain('[file]');
    });

    test('should exclude hidden files and node_modules', async () => {
      await fs.writeFile(path.join(TEST_DIR, '.hidden'), 'h');
      await fs.mkdir(path.join(TEST_DIR, 'node_modules'));
      await fs.writeFile(path.join(TEST_DIR, 'visible.txt'), 'v');

      const result = await listDirectoryTool.execute({
        path: '__test_sandbox__',
      });

      expect(result).not.toContain('.hidden');
      expect(result).not.toContain('node_modules');
      expect(result).toContain('visible.txt');
    });

    test('should return message for empty directory', async () => {
      const emptyDir = path.join(TEST_DIR, 'empty');
      await fs.mkdir(emptyDir);

      const result = await listDirectoryTool.execute({
        path: '__test_sandbox__/empty',
      });

      expect(result).toContain('empty');
    });

    test('should return error for non-existent directory', async () => {
      const result = await listDirectoryTool.execute({
        path: '__test_sandbox__/no-dir',
      });

      expect(result).toContain('Directory not found');
    });

    test('should reject path traversal', async () => {
      const result = await listDirectoryTool.execute({
        path: '../../../etc',
      });

      expect(result).toContain('Path traversal detected');
    });
  });
});
