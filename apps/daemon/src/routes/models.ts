import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import type { APIResponse } from '@amicus/types/dashboard';
import { ModelRegistry, ModelValidator } from '@amicus/core';
import { adminAuthMiddleware } from '../middleware/admin-auth.js';
import { providerService } from '../services/ProviderService.js';
import { writeAudit, type AuditEvent } from '../services/AuditLogService.js';
import { configManager } from '../services/ConfigService.js';

const modelRegistry = new ModelRegistry();
const modelValidator = new ModelValidator();

export const modelRoutes = new Hono();
export const modelAdminRoutes = new Hono();

function ok<T>(data: T): APIResponse<T> {
  return {
    success: true,
    data,
    meta: { requestId: randomUUID(), timestamp: Date.now(), duration: 0 },
  };
}

function fail(code: string, message: string): APIResponse<never> {
  return {
    success: false,
    error: { code, message },
    meta: { requestId: randomUUID(), timestamp: Date.now(), duration: 0 },
  };
}

function createAuditEvent(
  action: string,
  resource: string,
  result: 'success' | 'failure',
  errorMessage?: string
): AuditEvent {
  const event: AuditEvent = {
    timestamp: new Date().toISOString(),
    eventId: randomUUID(),
    actor: 'admin',
    action,
    resource,
    result,
  };
  if (errorMessage) {
    event.message = errorMessage;
  }
  return event;
}

modelRoutes.get('/models/:provider', (c) => {
  const provider = c.req.param('provider');

  modelRegistry.loadModels(provider);

  const models = modelRegistry.getModelsByProvider(provider);

  const modelsWithAvailability = models.map((model) => {
    const availability = modelRegistry.getModelAvailability(model.id);
    return {
      ...model,
      availability: availability ?? {
        id: model.id,
        healthy: false,
        lastChecked: 0,
      },
    };
  });

  return c.json(ok({
    provider,
    models: modelsWithAvailability,
    count: modelsWithAvailability.length,
  }));
});

modelRoutes.get('/models/:provider/:id', (c) => {
  const provider = c.req.param('provider');
  const id = c.req.param('id');

  modelRegistry.loadModels(provider);

  const model = modelRegistry.getModel(id);

  if (!model) {
    return c.json(fail('NOT_FOUND', `Model not found: ${id}`), 404);
  }

  if (model.provider !== provider) {
    return c.json(fail('NOT_FOUND', `Model ${id} does not belong to provider ${provider}`), 404);
  }

  const availability = modelRegistry.getModelAvailability(id);

  return c.json(ok({
    model,
    availability: availability ?? {
      id,
      healthy: false,
      lastChecked: 0,
    },
  }));
});

modelAdminRoutes.post('/models/:provider/refresh', adminAuthMiddleware, async (c) => {
  const provider = c.req.param('provider');

  const cfg = providerService.getAdminProviderView();
  const providerConfig = cfg.find((p) => p.id === provider);

  if (!providerConfig) {
    return c.json(fail('NOT_FOUND', `Unknown provider: ${provider}`), 404);
  }

  modelRegistry.loadModels(provider);

  const models = modelRegistry.getModelsByProvider(provider);

  for (const model of models) {
    modelRegistry.updateAvailability(model.id, true);
  }

  writeAudit({
    timestamp: new Date().toISOString(),
    eventId: randomUUID(),
    actor: 'admin',
    action: 'models.refresh',
    resource: `provider:${provider}`,
    result: 'success',
  });

  return c.json(ok({
    provider,
    refreshed: true,
    modelCount: models.length,
  }));
});

modelAdminRoutes.post('/models/:provider/:id/validate', adminAuthMiddleware, async (c) => {
  const provider = c.req.param('provider');
  const id = c.req.param('id');

  const cfg = providerService.getAdminProviderView();
  const providerConfig = cfg.find((p) => p.id === provider);

  if (!providerConfig) {
    return c.json(fail('NOT_FOUND', `Unknown provider: ${provider}`), 404);
  }

  modelRegistry.loadModels(provider);

  const model = modelRegistry.getModel(id);

  if (!model) {
    return c.json(fail('NOT_FOUND', `Model not found: ${id}`), 404);
  }

  if (model.provider !== provider) {
    return c.json(fail('NOT_FOUND', `Model ${id} does not belong to provider ${provider}`), 404);
  }

  const body = await c.req.json().catch(() => null) as { apiKey?: unknown } | null;
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey : '';

  if (!apiKey) {
    const envKey = `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
    const envApiKey = process.env[envKey];
    console.log(`[ModelValidator] Provider: ${provider}, Looking for env key: ${envKey}, found: ${!!envApiKey}`);
    if (envApiKey) {
      const config = configManager.getConfig();
      const providerConfigItem = config.llm.providers.find(p => p.id === provider);
      const baseURL = providerConfigItem?.baseURL;
      console.log(`[ModelValidator] Provider config baseURL: ${baseURL}`);
      console.log(`[ModelValidator] Validating model ${id} with API key from ${envKey} (length: ${envApiKey.length})`);
      const result = await modelValidator.validateModel(id, envApiKey, provider as 'zai' | 'zai-coding-plan', baseURL);
      console.log(`[ModelValidator] Validation result:`, result);
      modelRegistry.updateAvailability(id, result.valid);

      writeAudit(createAuditEvent(
        'models.validate',
        `model:${id}`,
        result.valid ? 'success' : 'failure',
        result.error ?? undefined
      ));

      return c.json(ok({
        modelId: id,
        provider,
        valid: result.valid,
        tokenCount: result.tokenCount,
        error: result.error,
      }));
    }

    return c.json(fail('INVALID_BODY', 'Expected { apiKey: string } or configured provider API key'), 400);
  }

  const config = configManager.getConfig();
  const providerConfigItem = config.llm.providers.find(p => p.id === provider);
  const baseURL = providerConfigItem?.baseURL;
  console.log(`[ModelValidator] Using baseURL from config: ${baseURL} for provider: ${provider}`);
  
  const result = await modelValidator.validateModel(id, apiKey, provider as 'zai' | 'zai-coding-plan', baseURL);
  modelRegistry.updateAvailability(id, result.valid);

  writeAudit(createAuditEvent(
    'models.validate',
    `model:${id}`,
    result.valid ? 'success' : 'failure',
    result.error ?? undefined
  ));

  return c.json(ok({
    modelId: id,
    provider,
    valid: result.valid,
    tokenCount: result.tokenCount,
    error: result.error,
  }));
});
