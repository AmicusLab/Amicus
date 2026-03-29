import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool } from './types.js';

const ReadFileSchema = z.object({
  path: z.string().describe('Relative path of the file to read (e.g., "README.md", "src/index.ts")'),
});

type ReadFileArgs = z.infer<typeof ReadFileSchema>;

export const readFileTool: Tool<ReadFileArgs> = {
  name: 'read_file',
  description: 'Reads the contents of a file at the specified path. Use this to inspect existing files before making changes.',
  schema: ReadFileSchema,

  execute: async ({ path: filePath }) => {
    try {
      // Resolve real paths to prevent symlink bypass attacks
      const projectRoot = await fs.realpath(process.cwd());
      const absolutePath = path.resolve(projectRoot, filePath);

      // Check path traversal before resolving real path
      const relativePath = path.relative(projectRoot, absolutePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return `Error: Path traversal detected. File must be within project directory.`;
      }

      // Resolve real path (file must exist)
      const realPath = await fs.realpath(absolutePath);

      // Double-check real path is still within project root
      const realRelativePath = path.relative(projectRoot, realPath);
      if (realRelativePath.startsWith('..') || path.isAbsolute(realRelativePath)) {
        return `Error: Path traversal detected. File must be within project directory.`;
      }

      const content = await fs.readFile(realPath, 'utf-8');
      return content;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          return `Error: File not found: ${filePath}`;
        }
        if (code === 'EISDIR') {
          return `Error: Path is a directory, not a file: ${filePath}`;
        }
        if (code === 'EACCES' || code === 'EPERM') {
          return `Error: Permission denied: ${filePath}`;
        }
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error reading file: ${errorMessage}`;
    }
  }
};
