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
      const projectRoot = path.resolve(process.cwd());
      const absolutePath = path.resolve(projectRoot, filePath);

      if (!absolutePath.startsWith(projectRoot + path.sep) && absolutePath !== projectRoot) {
        return `Error: Path traversal detected. File must be within project directory.`;
      }

      await fs.access(absolutePath);
      await fs.unlink(absolutePath);
      return `Successfully deleted ${filePath}`;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ENOENT')) {
        return `Error: File not found: ${filePath}`;
      }
      return `Error deleting file: ${errorMessage}`;
    }
  }
};
