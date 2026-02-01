# Model Registry

This directory stores model availability information for different LLM providers.

## Purpose

This registry tracks **runtime model availability** (which models are currently accessible and healthy), NOT model metadata. Model metadata (capabilities, pricing, context windows, etc.) is hardcoded in the provider plugin files.

## Directory Structure

```
config/models/
├── README.md              # This file
└── <provider>.json        # Model availability for each provider
```

## File Format

Each provider file follows this structure:

```json
{
  "provider": "provider-name",
  "lastUpdated": 1699900000,
  "models": [
    {
      "id": "model-id",
      "healthy": true,
      "lastChecked": 1699900000
    }
  ]
}
```

### Fields

- **provider** (string): Provider identifier (e.g., "zai", "openai", "anthropic")
- **lastUpdated** (number): Unix timestamp of last full update
- **models** (array): List of available models
  - **id** (string): Unique model identifier
  - **healthy** (boolean): Whether the model is currently operational
  - **lastChecked** (number): Unix timestamp of last health check

## Updating Model Information

### Manual Updates

To manually update model availability:

1. Open the appropriate provider file (e.g., `zai.json`)
2. Add/update model entries in the `models` array
3. Update the `lastUpdated` timestamp
4. Validate JSON: `cat config/models/<provider>.json | jq .`

### Automated Updates

Use the validation script to sync model availability:

```bash
# Update all providers
bun run verify-models

# Update specific provider
bun run verify-models --provider zai
```

## Provider Files

### Current Providers

- **`zai.json`**: Zai model availability

### Adding New Providers

To add a new provider:

1. Create `<provider>.json` with the template structure
2. Add provider-specific logic to the validation script
3. Update provider configurations in `config/llm-providers.ts`

## Important Notes

- These files are **committed to git** (not in .gitignore)
- They represent the **known available models** for each provider
- Health status is checked periodically via the validation script
- Model metadata (pricing, capabilities) is NOT stored here - it's in the provider plugins

## Validation Script

The validation script (`scripts/verify-models.ts`) performs the following:

1. Fetches available models from provider APIs
2. Checks health status of each model
3. Updates the corresponding JSON file
4. Validates JSON structure

Run the script regularly to keep model availability up-to-date.

## Troubleshooting

### JSON Validation Fails

```bash
# Check JSON syntax
cat config/models/<provider>.json | jq .

# If jq fails, check for syntax errors (missing commas, trailing commas, etc.)
```

### Models Not Updating

1. Check API credentials in `.env`
2. Verify provider API endpoints are accessible
3. Run validation script with verbose mode: `bun run verify-models --verbose`

### Health Status Always False

- Check network connectivity
- Verify provider service status
- Review validation script logs for specific error messages
