import { generateText, jsonSchema } from 'ai';
import type { Message, ChatConfig, ChatResult } from '@amicus/types';
import type { ProviderRegistry } from '../llm/ProviderRegistry.js';
import type { ToolRegistry } from '../tools/types.js';
import { SafetyExecutor } from '@amicus/safety';

const DEFAULT_SYSTEM_PROMPT = 'You are Amicus, a local-first AI assistant.';

export interface ChatEngineOptions {
  providerRegistry: ProviderRegistry;
  toolRegistry?: ToolRegistry;
}

export class ChatEngine {
  private providerRegistry: ProviderRegistry;
  private toolRegistry?: ToolRegistry;
  private safety!: SafetyExecutor;

  constructor(options: ChatEngineOptions) {
    this.providerRegistry = options.providerRegistry;
    if (options.toolRegistry) {
      this.toolRegistry = options.toolRegistry;
    }
    this.safety = new SafetyExecutor(process.cwd());
    this.safety.initRepo().catch(err => {
      console.error('[ChatEngine] Failed to init Git repo:', err);
    });
  }

  async chat(messages: Message[], config?: ChatConfig, depth = 0): Promise<ChatResult> {
    // #2: Prevent infinite recursion
    if (depth >= 10) {
      throw new Error('Maximum tool call depth (10) exceeded');
    }

    // #6: Prevent mutation of original messages array
    const workingMessages = [...messages];

    const systemPrompt = config?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    let modelId: string;
    let providerId: string;

    if (config?.model) {
      const parsed = this.providerRegistry.parseModelId(config.model);
      providerId = parsed.provider;
      modelId = parsed.model;
    } else {
      const routingResult = this.providerRegistry.selectModel(50);
      providerId = routingResult.provider;
      modelId = routingResult.modelInfo.id;
    }

    const plugin = this.providerRegistry.getPlugin(providerId);
    if (!plugin) {
      throw new Error(`Provider ${providerId} not available`);
    }

    const provider = plugin.createProvider({});
    if (typeof provider !== 'function') {
      throw new Error(`Invalid provider factory for ${providerId}`);
    }

    const model = provider(modelId);

    const generateConfig: Parameters<typeof generateText>[0] = {
      model,
      system: systemPrompt,
      messages: workingMessages.map(msg => {
        if (msg.role === 'assistant' && msg.tool_calls?.length) {
          return {
            role: 'assistant' as const,
            content: [
              ...(msg.content ? [{ type: 'text' as const, text: msg.content }] : []),
              ...msg.tool_calls.map(tc => ({
                type: 'tool-call' as const,
                toolCallId: tc.id,
                toolName: tc.name,
                args: tc.arguments,
              })),
            ],
          };
        }
        if (msg.role === 'tool' && msg.tool_call_id) {
          return {
            role: 'tool' as const,
            content: [{
              type: 'tool-result' as const,
              toolCallId: msg.tool_call_id,
              toolName: '',
              result: msg.content,
            }],
          };
        }
        return { role: msg.role as 'user' | 'system', content: msg.content };
      }),
    };

    if (config?.maxTokens !== undefined) {
      generateConfig.maxTokens = config.maxTokens;
    }
    if (config?.temperature !== undefined) {
      generateConfig.temperature = config.temperature;
    }
    if (config?.topP !== undefined) {
      generateConfig.topP = config.topP;
    }

    if (this.toolRegistry) {
      const toolDefs = this.toolRegistry.getDefinitions();
      if (toolDefs.length > 0) {
        const toolsConfig: Record<string, {
          description: string;
          parameters: ReturnType<typeof jsonSchema>;
        }> = {};

        for (const toolDef of toolDefs) {
          toolsConfig[toolDef.name] = {
            description: toolDef.description,
            parameters: jsonSchema(toolDef.input_schema),
          };
        }

        generateConfig.tools = toolsConfig;
      }
    }

    const result = await generateText(generateConfig);

    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCalls = result.toolCalls.map((tc: {
        toolCallId: string;
        toolName: string;
        args: Record<string, unknown>;
      }) => ({
        id: tc.toolCallId,
        name: tc.toolName,
        arguments: tc.args ?? {}
      }));

      workingMessages.push({
        role: 'assistant',
        content: result.text || '',
        tool_calls: toolCalls
      });

      for (const call of toolCalls) {
        const tool = this.toolRegistry?.get(call.name);
        if (!tool) {
          workingMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: `Error: Unknown tool '${call.name}'`
          });
          continue;
        }

        try {
          // #5: Validate tool arguments with Zod schema before execution
          const validatedArgs = tool.schema.parse(call.arguments);
          const toolResult = await this.safety.executeSafe(
            call.name,
            async () => await tool.execute(validatedArgs)
          );
          workingMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: toolResult
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          workingMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: `Error executing tool: ${errorMessage}`
          });
        }
      }

      return this.chat(workingMessages, config, depth + 1);
    }

    return {
      response: {
        type: 'text',
        content: result.text,
      },
      usage: {
        input: result.usage.promptTokens,
        output: result.usage.completionTokens,
        total: result.usage.totalTokens,
      },
      model: modelId,
      provider: providerId,
    };
  }

  async undo(): Promise<string> {
    return this.safety.rollback();
  }
}
