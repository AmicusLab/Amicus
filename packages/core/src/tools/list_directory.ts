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
  description: 'Lists files and directories at the specified path. Returns entries with type indicators (file/dir).',
  schema: ListDirectorySchema,

  execute: async ({ path: dirPath }) => {
    try {
      const projectRoot = path.resolve(process.cwd());
      const absolutePath = path.resolve(projectRoot, dirPath);

      if (!absolutePath.startsWith(projectRoot + path.sep) && absolutePath !== projectRoot) {
        return `Error: Path traversal detected. Directory must be within project directory.`;
      }

      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ENOENT')) {
        return `Error: Directory not found: ${dirPath}`;
      }
      return `Error listing directory: ${errorMessage}`;
    }
  }
};
