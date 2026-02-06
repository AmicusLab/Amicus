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
      const absolutePath = path.resolve(process.cwd(), filePath);
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf-8');
      return `Successfully created file at: ${filePath}`;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error creating file: ${errorMessage}`;
    }
  }
};
