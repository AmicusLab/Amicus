import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool } from './types.js';

const EditFileSchema = z.object({
  path: z.string().describe('Relative path of the file to edit'),
  old_string: z.string().describe('The exact string to find and replace in the file'),
  new_string: z.string().describe('The string to replace old_string with'),
});

type EditFileArgs = z.infer<typeof EditFileSchema>;

export const editFileTool: Tool<EditFileArgs> = {
  name: 'edit_file',
  description: 'Replaces an exact string match in a file with new content. Use read_file first to see current contents, then use this to make targeted edits.',
  schema: EditFileSchema,

  execute: async ({ path: filePath, old_string, new_string }) => {
    try {
      const projectRoot = path.resolve(process.cwd());
      const absolutePath = path.resolve(projectRoot, filePath);

      if (!absolutePath.startsWith(projectRoot + path.sep) && absolutePath !== projectRoot) {
        return `Error: Path traversal detected. File must be within project directory.`;
      }

      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch {
        return `Error: File not found: ${filePath}`;
      }

      const occurrences = content.split(old_string).length - 1;
      if (occurrences === 0) {
        return `Error: old_string not found in ${filePath}. Use read_file to check the current contents.`;
      }
      if (occurrences > 1) {
        return `Error: old_string found ${occurrences} times in ${filePath}. Provide a more specific string with surrounding context.`;
      }

      const updated = content.replace(old_string, new_string);
      await fs.writeFile(absolutePath, updated, 'utf-8');
      return `Successfully edited ${filePath}`;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error editing file: ${errorMessage}`;
    }
  }
};
