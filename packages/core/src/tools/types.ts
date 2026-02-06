import { z, type ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface Tool<T = unknown> {
  name: string;
  description: string;
  schema: ZodType<T>;
  execute: (args: T) => Promise<string>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): Array<{
    name: string;
    description: string;
    input_schema: unknown;
  }> {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input_schema: zodToJsonSchema(tool.schema as any, { 
        name: `${tool.name}_input`,
        $refStrategy: 'none' 
      })
    }));
  }
}
