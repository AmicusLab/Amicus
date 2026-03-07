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
      const projectRoot = path.resolve(process.cwd());
      const absolutePath = path.resolve(projectRoot, filePath);

      if (!absolutePath.startsWith(projectRoot + path.sep) && absolutePath !== projectRoot) {
        return `Error: Path traversal detected. File must be within project directory.`;
      }

      const content = await fs.readFile(absolutePath, 'utf-8');
      return content;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ENOENT')) {
        return `Error: File not found: ${filePath}`;
      }
      return `Error reading file: ${errorMessage}`;
    }
  }
};
