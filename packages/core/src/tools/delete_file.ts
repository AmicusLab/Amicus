import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool } from './types.js';

const DeleteFileSchema = z.object({
  path: z.string().describe('Relative path of the file to delete'),
});

type DeleteFileArgs = z.infer<typeof DeleteFileSchema>;

export const deleteFileTool: Tool<DeleteFileArgs> = {
  name: 'delete_file',
  description: 'Deletes a file at the specified path. The operation is protected by git snapshots so it can be undone.',
  schema: DeleteFileSchema,

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

      // fs.unlink will throw ENOENT if file doesn't exist - no need for fs.access
      await fs.unlink(realPath);
      return `Successfully deleted ${filePath}`;
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
      return `Error deleting file: ${errorMessage}`;
    }
  }
};
