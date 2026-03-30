import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool } from './types.js';

const SearchFilesSchema = z.object({
  query: z.string().min(1).describe('Search pattern (regex supported)'),
  path: z.string().default('.').describe('Directory path to search in (defaults to project root)'),
  include: z.string().optional().describe('File patterns to include (comma-separated, e.g., "*.ts,*.js")'),
  case_sensitive: z.boolean().default(false).describe('Case-sensitive search'),
  context_lines: z.number().min(0).max(5).default(0).describe('Number of context lines before/after match'),
  max_results: z.number().min(1).max(1000).default(100).describe('Maximum number of results to return'),
});

type SearchFilesArgs = z.infer<typeof SearchFilesSchema>;

interface SearchResult {
  file: string;
  line: number;
  column: number;
  text: string;
  context?: string[];
}

export const searchFilesTool: Tool<SearchFilesArgs> = {
  name: 'search_files',
  description: 'Search for text patterns in files using regex. Recursively searches all files in the specified directory, excluding hidden files and node_modules by default. Returns matching lines with line numbers and optional context.',
  schema: SearchFilesSchema,

  execute: async ({ query, path: searchPath, include, case_sensitive, context_lines, max_results }) => {
    try {
      // Resolve real paths to prevent symlink bypass attacks
      const projectRoot = await fs.realpath(process.cwd());
      const absolutePath = path.resolve(projectRoot, searchPath);

      // Check path traversal before resolving real path
      const relativePath = path.relative(projectRoot, absolutePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return `Error: Path traversal detected. Directory must be within project directory.`;
      }

      // Check if path exists
      let realPath: string;
      try {
        realPath = await fs.realpath(absolutePath);
      } catch {
        return `Error: Directory not found: ${searchPath}`;
      }

      // Double-check real path is still within project root
      const realRelativePath = path.relative(projectRoot, realPath);
      if (realRelativePath.startsWith('..') || path.isAbsolute(realRelativePath)) {
        return `Error: Path traversal detected. Directory must be within project directory.`;
      }

      // Check if it's a directory
      const stats = await fs.stat(realPath);
      if (!stats.isDirectory()) {
        return `Error: Path is not a directory: ${searchPath}`;
      }

      // Parse include patterns
      const patterns = include
        ? include.split(',').map(p => p.trim()).filter(Boolean)
        : ['*'];

      // Build regex from query
      const flags = case_sensitive ? 'g' : 'gi';
      let regex: RegExp;
      try {
        regex = new RegExp(query, flags);
      } catch {
        return `Error: Invalid regex pattern: ${query}`;
      }

      // Collect all files to search
      const filesToSearch: string[] = [];
      await collectFiles(realPath, realPath, patterns, filesToSearch);

      // Search files
      const results: SearchResult[] = [];
      let truncated = false;

      for (const filePath of filesToSearch) {
        if (results.length >= max_results) {
          truncated = true;
          break;
        }

        try {
          const fileResults = await searchInFile(filePath, projectRoot, regex, context_lines);
          for (const result of fileResults) {
            if (results.length >= max_results) {
              truncated = true;
              break;
            }
            results.push(result);
          }
        } catch {
          // Skip files that can't be read (binary, permissions, etc.)
          continue;
        }
      }

      // Format output
      if (results.length === 0) {
        return `No matches found for "${query}" in ${searchPath}`;
      }

      const output = formatResults(results, truncated, max_results);
      return output;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error searching files: ${errorMessage}`;
    }
  }
};

async function collectFiles(
  currentDir: string,
  baseDir: string,
  patterns: string[],
  files: string[]
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const name = entry.name;

    // Skip hidden files and directories
    if (name.startsWith('.')) {
      continue;
    }

    // Skip node_modules
    if (name === 'node_modules') {
      continue;
    }

    const fullPath = path.join(currentDir, name);

    if (entry.isDirectory()) {
      await collectFiles(fullPath, baseDir, patterns, files);
    } else if (entry.isFile()) {
      // Check if file matches any pattern
      if (matchesPatterns(name, patterns)) {
        files.push(fullPath);
      }
    }
  }
}

function matchesPatterns(filename: string, patterns: string[]): boolean {
  if (patterns.includes('*')) {
    return true;
  }

  return patterns.some(pattern => {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
  });
}

async function searchInFile(
  filePath: string,
  projectRoot: string,
  regex: RegExp,
  contextLines: number
): Promise<SearchResult[]> {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  // Skip binary files (check for null bytes in first 8000 bytes)
  const sample = content.slice(0, 8000);
  if (sample.includes('\0')) {
    return [];
  }

  const lines = content.split('\n');
  const results: SearchResult[] = [];
  const matchedLines = new Set<number>();

  // Reset regex lastIndex
  regex.lastIndex = 0;

  // Find all matches
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    if (line === undefined) continue;
    regex.lastIndex = 0;

    if (regex.test(line)) {
      matchedLines.add(lineNum);
    }
  }

  // Build results with context
  for (const lineNum of matchedLines) {
    const line = lines[lineNum];
    if (line === undefined) continue;
    const relativePath = path.relative(projectRoot, filePath);

    // Find match column
    regex.lastIndex = 0;
    const match = regex.exec(line);
    const column = match ? match.index + 1 : 1;

    const result: SearchResult = {
      file: relativePath,
      line: lineNum + 1,
      column,
      text: line,
    };

    // Add context lines if requested
    if (contextLines > 0) {
      result.context = [];
      const start = Math.max(0, lineNum - contextLines);
      const end = Math.min(lines.length - 1, lineNum + contextLines);

      for (let i = start; i <= end; i++) {
        const contextLine = lines[i];
        if (contextLine === undefined) continue;
        const prefix = i === lineNum ? '>' : ' ';
        result.context.push(`${prefix} ${i + 1}: ${contextLine}`);
      }
    }

    results.push(result);
  }

  return results;
}

function formatResults(results: SearchResult[], truncated: boolean, maxResults: number): string {
  const lines: string[] = [];
  let currentFile = '';
  let matchCount = 0;

  for (const result of results) {
    if (result.file !== currentFile) {
      if (currentFile) {
        lines.push('');
      }
      currentFile = result.file;
      lines.push(`📄 ${result.file}`);
    }

    if (result.context && result.context.length > 0) {
      lines.push('');
      lines.push(...result.context);
      lines.push('');
    } else {
      lines.push(`  ${result.line}:${result.column}: ${result.text}`);
    }
    matchCount++;
  }

  lines.push('');
  lines.push(`Found ${matchCount} match${matchCount === 1 ? '' : 'es'}`);

  if (truncated) {
    lines.push(`(limited to ${maxResults} results)`);
  }

  return lines.join('\n');
}
