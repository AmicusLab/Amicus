import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool } from './types.js';

const EditFileSchema = z.object({
  path: z.string().describe('Relative path of the file to edit'),
  old_string: z.string().min(1).describe('The exact string to find and replace in the file'),
  new_string: z.string().describe('The string to replace old_string with'),
});

type EditFileArgs = z.infer<typeof EditFileSchema>;

export const editFileTool: Tool<EditFileArgs> = {
  name: 'edit_file',
  description: 'Replaces an exact string match in a file with new content. Use read_file first to see current contents, then use this to make targeted edits.',
  schema: EditFileSchema,

  execute: async ({ path: filePath, old_string, new_string }) => {
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

      const occurrences = content.split(old_string).length - 1;
      if (occurrences === 0) {
        return `Error: old_string not found in ${filePath}. Use read_file to check the current contents.`;
      }
      if (occurrences > 1) {
        return `Error: old_string found ${occurrences} times in ${filePath}. Provide a more specific string with surrounding context.`;
      }

      const updated = content.replace(old_string, new_string);
      await fs.writeFile(realPath, updated, 'utf-8');
      return `Successfully edited ${filePath}`;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          return `Error: File not found: ${filePath}`;
        }
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error editing file: ${errorMessage}`;
    }
  }
};
