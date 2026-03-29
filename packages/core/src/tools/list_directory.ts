import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool } from './types.js';

const ListDirectorySchema = z.object({
  path: z.string().default('.').describe('Relative directory path to list (defaults to project root)'),
});

type ListDirectoryArgs = z.infer<typeof ListDirectorySchema>;

export const listDirectoryTool: Tool<ListDirectoryArgs> = {
  name: 'list_directory',
  description: 'Lists non-hidden files and directories at the specified path, excluding entries starting with "." and the "node_modules" directory. Returns entries with type indicators (file/dir).',
  schema: ListDirectorySchema,

  execute: async ({ path: dirPath }) => {
    try {
      // Resolve real paths to prevent symlink bypass attacks
      const projectRoot = await fs.realpath(process.cwd());
      const absolutePath = path.resolve(projectRoot, dirPath);

      // Check path traversal before resolving real path
      const relativePath = path.relative(projectRoot, absolutePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return `Error: Path traversal detected. Directory must be within project directory.`;
      }

      // Resolve real path (directory must exist)
      const realPath = await fs.realpath(absolutePath);

      // Double-check real path is still within project root
      const realRelativePath = path.relative(projectRoot, realPath);
      if (realRelativePath.startsWith('..') || path.isAbsolute(realRelativePath)) {
        return `Error: Path traversal detected. Directory must be within project directory.`;
      }

      const entries = await fs.readdir(realPath, { withFileTypes: true });
      const lines = entries
        .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        })
        .map(e => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`);

      if (lines.length === 0) {
        return `Directory ${dirPath} is empty (excluding hidden files and node_modules).`;
      }

      return lines.join('\n');
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          return `Error: Directory not found: ${dirPath}`;
        }
        if (code === 'ENOTDIR') {
          return `Error: Path is a file, not a directory: ${dirPath}`;
        }
        if (code === 'EACCES' || code === 'EPERM') {
          return `Error: Permission denied: ${dirPath}`;
        }
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error listing directory: ${errorMessage}`;
    }
  }
};
