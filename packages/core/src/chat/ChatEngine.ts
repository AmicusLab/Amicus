import { generateText, streamText, jsonSchema } from 'ai';
import type { Message, ChatConfig, ChatResult, StreamChunk } from '@amicus/types';
import type { ProviderRegistry } from '../llm/ProviderRegistry.js';
import type { ToolRegistry } from '../tools/types.js';
import type { CoreMessage } from 'ai';
import { SafetyExecutor } from '@amicus/safety';

const DEFAULT_SYSTEM_PROMPT = 'You are Amicus, a local-first AI assistant.';

export interface ChatEngineOptions {
  providerRegistry: ProviderRegistry;
  toolRegistry?: ToolRegistry;
}

interface ProviderAndModel {
  providerId: string;
  modelId: string;
}

export class ChatEngine {
  private providerRegistry: ProviderRegistry;
  private toolRegistry?: ToolRegistry;
  private safety!: SafetyExecutor;
  private safetyReady: Promise<void>;

  constructor(options: ChatEngineOptions) {
    this.providerRegistry = options.providerRegistry;
    if (options.toolRegistry) {
      this.toolRegistry = options.toolRegistry;
    }
    this.safety = new SafetyExecutor(process.cwd());
    this.safetyReady = this.safety.initRepo().catch((err: unknown) => {
      console.error('[ChatEngine] Failed to init Git repo:', err);
      throw err;
    });
  }

  /**
   * Maps internal Message[] to AI SDK CoreMessage[] format.
   */
  private _mapMessagesToCoreMessages(messages: Message[]): CoreMessage[] {
    return messages.map(msg => {
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
      return { role: msg.role as 'user' | 'system' | 'assistant', content: msg.content };
    });
  }

  /**
   * Resolves provider and model IDs from config or via automatic routing.
   */
  private _getProviderAndModel(config?: ChatConfig): ProviderAndModel {
    if (config?.model) {
      const parsed = this.providerRegistry.parseModelId(config.model);
      return { providerId: parsed.provider, modelId: parsed.model };
    }
    const routingResult = this.providerRegistry.selectModel(50);
    return { providerId: routingResult.provider, modelId: routingResult.modelInfo.id };
  }

  async chat(messages: Message[], config?: ChatConfig, depth = 0): Promise<ChatResult> {
    await this.safetyReady;

    // #2: Prevent infinite recursion
    if (depth >= 10) {
      throw new Error('Maximum tool call depth (10) exceeded');
    }

    // #6: Prevent mutation of original messages array
    const workingMessages = [...messages];

    const systemPrompt = config?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    const { providerId, modelId } = this._getProviderAndModel(config);

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
      messages: this._mapMessagesToCoreMessages(workingMessages),
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
            () => tool.execute(validatedArgs)
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

  /**
   * Streaming chat method that yields StreamChunk objects via AsyncGenerator.
   * Supports tool call streaming with automatic re-streaming after tool execution.
   */
  async *chatStream(messages: Message[], config?: ChatConfig, depth = 0): AsyncGenerator<StreamChunk> {
    await this.safetyReady;

    // Prevent infinite recursion
    if (depth >= 10) {
      yield { type: 'error', message: 'Maximum tool call depth (10) exceeded' };
      return;
    }

    const workingMessages = [...messages];
    const systemPrompt = config?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    let modelId: string;
    let providerId: string;

    try {
      const resolved = this._getProviderAndModel(config);
      providerId = resolved.providerId;
      modelId = resolved.modelId;

      const plugin = this.providerRegistry.getPlugin(providerId);
      if (!plugin) {
        yield { type: 'error', message: `Provider ${providerId} not available` };
        return;
      }

      const provider = plugin.createProvider({});
      if (typeof provider !== 'function') {
        yield { type: 'error', message: `Invalid provider factory for ${providerId}` };
        return;
      }

      const model = provider(modelId);

      const streamConfig: Parameters<typeof streamText>[0] = {
        model,
        system: systemPrompt,
        messages: this._mapMessagesToCoreMessages(workingMessages),
      };

      if (config?.maxTokens !== undefined) {
        streamConfig.maxTokens = config.maxTokens;
      }
      if (config?.temperature !== undefined) {
        streamConfig.temperature = config.temperature;
      }
      if (config?.topP !== undefined) {
        streamConfig.topP = config.topP;
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

          streamConfig.tools = toolsConfig;
        }
      }

      const result = await streamText(streamConfig);

      // Stream text deltas
      for await (const textPart of result.textStream) {
        yield { type: 'text_delta', content: textPart };
      }

      // Wait for the full result to get tool calls and usage
      const [fullText, toolCallsResult, usageResult] = await Promise.all([
        result.text,
        result.toolCalls,
        result.usage,
      ]);

      // Handle tool calls if any
      if (toolCallsResult && toolCallsResult.length > 0) {
        const toolCalls = toolCallsResult.map((tc: {
          toolCallId: string;
          toolName: string;
          args: Record<string, unknown>;
        }) => ({
          id: tc.toolCallId,
          name: tc.toolName,
          arguments: tc.args ?? {}
        }));

        // Add assistant message with tool calls
        workingMessages.push({
          role: 'assistant',
          content: fullText || '',
          tool_calls: toolCalls
        });

        // Execute each tool and yield results
        for (const call of toolCalls) {
          yield { type: 'tool_call_start', toolName: call.name, toolCallId: call.id };

          const tool = this.toolRegistry?.get(call.name);
          if (!tool) {
            const errorMsg = `Error: Unknown tool '${call.name}'`;
            workingMessages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: errorMsg
            });
            yield { type: 'tool_call_result', toolCallId: call.id, content: errorMsg };
            continue;
          }

          try {
            const validatedArgs = tool.schema.parse(call.arguments);
            const toolResult = await this.safety.executeSafe(
              call.name,
              () => tool.execute(validatedArgs)
            );
            workingMessages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: toolResult
            });
            yield { type: 'tool_call_result', toolCallId: call.id, content: toolResult };
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            workingMessages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: `Error executing tool: ${errorMessage}`
            });
            yield { type: 'tool_call_result', toolCallId: call.id, content: `Error executing tool: ${errorMessage}` };
          }
        }

        // Recursively continue streaming for the follow-up response
        yield* this.chatStream(workingMessages, config, depth + 1);
        return;
      }

      // Yield usage information
      yield {
        type: 'usage',
        input: usageResult.promptTokens,
        output: usageResult.completionTokens,
        total: usageResult.totalTokens,
      };

      yield { type: 'done' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      yield { type: 'error', message: errorMessage };
    }
  }

  async undo(): Promise<string> {
    await this.safetyReady;
    return this.safety.rollback();
  }
}
