import { Hono } from 'hono';
import { adminAuthMiddleware } from '../middleware/admin-auth.js';
import { providerService } from '../services/ProviderService.js';
import { secretStore } from '../services/ConfigService.js';

const testRoutes = new Hono();

testRoutes.post('/test/claude', adminAuthMiddleware, async (c) => {
  try {
    const credential = secretStore.getCredential('anthropic');
    
    if (!credential) {
      return c.json({ 
        success: false, 
        error: 'No Anthropic credential found' 
      }, 404);
    }

    let apiKey: string;
    if (credential.type === 'oauth') {
      apiKey = credential.accessToken;
    } else if (credential.type === 'api_key') {
      apiKey = credential.apiKey;
    } else {
      apiKey = credential.token;
    }

    process.env.ANTHROPIC_API_KEY = apiKey;

    const registry = providerService.getRegistry();
    const plugin = registry.getPlugin('anthropic');
    
    if (!plugin) {
      return c.json({ 
        success: false, 
        error: 'Anthropic plugin not loaded' 
      }, 404);
    }

    const { generateText } = await import('ai');
    const anthropic = plugin.createProvider({ apiKey }) as any;
    
    const result = await generateText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      prompt: 'Say "Hello from Claude!" in a friendly way. Keep it under 30 words.',
      maxTokens: 50,
    });

    return c.json({
      success: true,
      data: {
        text: result.text,
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
        finishReason: result.finishReason,
      },
    });

  } catch (error) {
    console.error('[Test] Claude inference failed:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

export { testRoutes };
