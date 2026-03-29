import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool } from './types.js';

const CreateFileSchema = z.object({
  path: z.string().describe('Relative path where the file should be created (e.g., "README.md", "src/index.ts")'),
  content: z.string().describe('Content to write to the file')
});

type CreateFileArgs = z.infer<typeof CreateFileSchema>;

export const createFileTool: Tool<CreateFileArgs> = {
  name: 'create_file',
  description: 'Creates a new file or overwrites an existing one at the specified path with the given content. Use this to write code, documentation, or logs.',
  schema: CreateFileSchema,
  
  execute: async ({ path: filePath, content }) => {
    try {
      // Resolve real paths to prevent symlink bypass attacks
      const projectRoot = await fs.realpath(process.cwd());
      const absolutePath = path.resolve(projectRoot, filePath);

      // Check path traversal before resolving real path
      const relativePath = path.relative(projectRoot, absolutePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return `Error: Path traversal detected. File must be within project directory.`;
      }

      const dir = path.dirname(absolutePath);

      // Ensure the directory exists
      await fs.mkdir(dir, { recursive: true });

      // Resolve real path of directory
      const realDir = await fs.realpath(dir);
      const realPath = path.join(realDir, path.basename(absolutePath));

      // Double-check real path is still within project root
      const realRelativePath = path.relative(projectRoot, realPath);
      if (realRelativePath.startsWith('..') || path.isAbsolute(realRelativePath)) {
        return `Error: Path traversal detected. File must be within project directory.`;
      }

      await fs.writeFile(realPath, content, 'utf-8');
      return `Successfully created file at: ${filePath}`;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'EACCES' || code === 'EPERM') {
          return `Error: Permission denied: ${filePath}`;
        }
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error creating file: ${errorMessage}`;
    }
  }
};
