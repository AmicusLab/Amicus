# z.ai Model Management System

## Overview

The z.ai Model Management System provides automated tracking and validation of z.ai (Zhipu AI) model availability. It uses a hybrid approach:

- **Model Metadata**: Hardcoded in `packages/core/src/llm/plugins/zai.ts` (15 models)
- **Availability Status**: Stored in `config/models/zai.json` and updated via validation script
- **Automated Validation**: GitHub Actions runs weekly to check model health

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions                           │
│              (Weekly: Sunday 00:00 UTC)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              scripts/validate-zai-models.ts                 │
│         (Fetches models from ZaiPlugin, validates)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              config/models/zai.json                         │
│         (Stores availability: healthy, lastChecked)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              ModelRegistry / ModelValidator                 │
│         (Core classes for loading and validation)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Daemon API / Dashboard UI                      │
│         (REST endpoints and web interface)                  │
└─────────────────────────────────────────────────────────────┘
```

## Model Metadata

All 15 z.ai models are hardcoded in `packages/core/src/llm/plugins/zai.ts`:

### Text Models (10)

| Model | Description | Input/1M | Output/1M | Complexity |
|-------|-------------|----------|-----------|------------|
| glm-4.7 | Flagship model | $0.60 | $2.20 | 70-100 |
| glm-4.7-flash | Free model | FREE | FREE | 50-80 |
| glm-4.7-flashx | Fast model | $0.07 | $0.40 | 50-80 |
| glm-4.6 | Standard model | $0.50 | $1.80 | 60-90 |
| glm-4.5 | Balanced model | $0.30 | $1.20 | 50-80 |
| glm-4.5-x | Extended model | $0.40 | $1.50 | 55-85 |
| glm-4.5-air | Lightweight | $0.10 | $0.50 | 30-60 |
| glm-4.5-airx | Ultra-fast | $0.05 | $0.30 | 25-55 |
| glm-4.5-flash | Fast balanced | $0.08 | $0.40 | 40-70 |
| glm-4-32b-0414-128k | 32B model | $0.20 | $0.80 | 45-75 |

### Vision Models (5)

| Model | Description | Input/1M | Output/1M | Complexity |
|-------|-------------|----------|-----------|------------|
| glm-4.6v | Vision standard | $0.60 | $2.20 | 60-90 |
| glm-4.6v-flash | Vision fast | FREE | FREE | 50-80 |
| glm-4.6v-flashx | Vision ultra | $0.07 | $0.40 | 50-80 |
| glm-4.5v | Vision balanced | $0.30 | $1.20 | 50-80 |
| autoglm-phone-multilingual | Phone agent | $0.40 | $1.50 | 55-85 |

## Availability Tracking

### File Format

`config/models/zai.json`:

```json
{
  "provider": "zai",
  "lastUpdated": 1704067200000,
  "models": [
    {
      "id": "glm-4.7",
      "healthy": true,
      "lastChecked": 1704067200000
    }
  ]
}
```

### Validation Method

Since z.ai doesn't provide a `/v1/models` endpoint, we use the **Tokenizer API**:

```bash
POST https://api.z.ai/api/paas/v4/tokenizer
Content-Type: application/json
Authorization: Bearer ${ZAI_API_KEY}

{
  "model": "glm-4.7",
  "messages": [{"role": "user", "content": "test"}]
}
```

A successful response (200 OK) indicates the model is healthy.

## Usage

### Manual Validation

```bash
# With environment variable
export ZAI_API_KEY="your-api-key"
bun run validate:zai

# With command line argument
bun run validate:zai -- --api-key=your-api-key
```

### API Endpoints

#### Public Endpoints

- `GET /api/models/zai` - List all models with availability
- `GET /api/models/zai/:id` - Get specific model details

#### Admin Endpoints

- `POST /admin/models/zai/refresh` - Refresh all model availability
- `POST /admin/models/zai/:id/validate` - Validate specific model

### Dashboard

Access the model management UI at:
- **Models Tab**: View all 15 models with details and health status
- **Model Selector**: Change default model and validate individual models

## GitHub Actions Workflow

The workflow `.github/workflows/validate-models.yml`:

1. **Schedule**: Runs every Sunday at 00:00 UTC
2. **Manual Trigger**: Can be triggered manually via `workflow_dispatch`
3. **Steps**:
   - Checkout code
   - Setup Bun
   - Install dependencies
   - Run validation script with `ZAI_API_KEY` secret
   - Create PR if availability changes

### Required Secrets

Set in GitHub repository settings:

- `ZAI_API_KEY`: Your z.ai API key

### PR Creation

When availability changes:
- Branch: `update/zai-model-availability`
- Commit: "chore: update z.ai model availability"
- Title: "[Automated] Update z.ai model availability"
- Labels: `automated`

## Model Selection

The `ModelRegistry.selectOptimalModel(complexity, provider)` method:

1. Filters models by provider
2. Filters by complexity range (model.min ≤ complexity ≤ model.max)
3. Sorts by cost (input + output)
4. Returns the cheapest model that can handle the complexity

Example:

```typescript
const registry = new ModelRegistry();
await registry.loadModels('zai');
const model = registry.selectOptimalModel(80, 'zai');
// Returns: glm-4.7 (can handle complexity 70-100)
```

## Troubleshooting

### Validation Script Fails

1. Check `ZAI_API_KEY` is set correctly
2. Verify API key has access to all models
3. Check network connectivity to `api.z.ai`

### Models Show as Unhealthy

1. Run manual validation: `bun run validate:zai`
2. Check z.ai status page
3. Verify model is still available in your region

### GitHub Actions Fails

1. Verify `ZAI_API_KEY` secret is set in repository settings
2. Check workflow logs for specific errors
3. Ensure branch protection allows PR creation

## Development

### Adding New Models

1. Update `packages/core/src/llm/plugins/zai.ts`
2. Add model to `getModels()` array
3. Update tests in `packages/core/src/llm/plugins/__tests__/zai.test.ts`
4. Run validation to update availability

### Modifying Validation Logic

1. Edit `packages/core/src/llm/model/ModelValidator.ts`
2. Update tests in `packages/core/src/llm/model/__tests__/ModelValidator.test.ts`
3. Test with `bun run validate:zai`

## References

- [z.ai Documentation](https://www.z.ai/)
- [Tokenizer API Reference](https://www.z.ai/api-reference/tokenizer)
- [Model Pricing](https://www.z.ai/pricing)
