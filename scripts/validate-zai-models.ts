#!/usr/bin/env bun

/**
 * Z.ai Model Validation Script
 *
 * Validates all Z.ai models by calling the Chat Completions API.
 * Updates config/models/zai.json with availability status.
 *
 * Usage:
 *   bun run scripts/validate-zai-models.ts
 *   bun run scripts/validate-zai-models.ts -- --api-key=<key>
 *   ZAI_API_KEY=<key> bun run scripts/validate-zai-models.ts
 *
 * Exit codes:
 *   0 - All models healthy
 *   1 - One or more models unhealthy
 */

import { ZaiPlugin } from "../packages/core/dist/llm/plugins/zai.js";
import * as fs from "fs";
import * as path from "path";

// Parse command line arguments
function parseArgs(): { apiKey?: string } {
  const args = process.argv.slice(2);
  const result: { apiKey?: string } = {};

  for (const arg of args) {
    if (arg.startsWith("--api-key=")) {
      result.apiKey = arg.slice("--api-key=".length);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Z.ai Model Validation Script

Usage:
  bun run scripts/validate-zai-models.ts [options]

Options:
  --api-key=<key>    Z.ai API key (optional if ZAI_API_KEY env var is set)
  --help, -h         Show this help message

Environment:
  ZAI_API_KEY        Z.ai API key

Exit codes:
  0 - All models healthy
  1 - One or more models unhealthy
      `);
      process.exit(0);
    }
  }

  return result;
}

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
};

interface ModelHealth {
  id: string;
  healthy: boolean;
  lastChecked: number;
  error?: string;
}

interface ValidationResult {
  provider: string;
  lastUpdated: number;
  models: ModelHealth[];
}

/**
 * Validate a single model by calling the Chat Completions API
 * Uses minimal request (max_tokens: 1) to reduce cost while checking availability
 */
async function validateModel(
  modelId: string,
  apiKey: string
): Promise<ModelHealth> {
  const baseURL = "https://api.z.ai/api/paas/v4";
  const timestamp = Date.now();

  try {
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
        stream: false,
      }),
    });

    if (response.status === 200) {
      return {
        id: modelId,
        healthy: true,
        lastChecked: timestamp,
      };
    } else if (response.status === 401) {
      return {
        id: modelId,
        healthy: false,
        lastChecked: timestamp,
        error: "Invalid API key",
      };
    } else {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error?.message || `HTTP ${response.status}`;
      const errorCode = errorData?.error?.code;
      
      // Provide clearer error messages for common error codes
      let detailedError = errorMessage;
      if (errorCode === "1113") {
        detailedError = "Insufficient balance - please check your account";
      } else if (errorCode === "1305") {
        detailedError = "Rate limit exceeded - please try again later";
      } else if (errorCode === "1211") {
        detailedError = "Model not found or not available";
      }
      
      return {
        id: modelId,
        healthy: false,
        lastChecked: timestamp,
        error: `[${errorCode}] ${detailedError}`,
      };
    }
  } catch (error) {
    return {
      id: modelId,
      healthy: false,
      lastChecked: timestamp,
      error: `Connection error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get API key from environment or arguments
 */
function getApiKey(args: { apiKey?: string }): string {
  const apiKey = args.apiKey ?? process.env.ZAI_API_KEY;

  if (!apiKey) {
    console.error(
      `${colors.red}Error: ZAI_API_KEY not set${colors.reset}`
    );
    console.error(
      `${colors.dim}Set ZAI_API_KEY environment variable or use --api-key flag${colors.reset}`
    );
    process.exit(1);
  }

  return apiKey;
}

/**
 * Save validation results to config file
 */
function saveResults(result: ValidationResult): void {
  const configDir = path.join(process.cwd(), "config", "models");
  const outputPath = path.join(configDir, "zai.json");

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
  console.log(
    `${colors.dim}Results saved to: ${outputPath}${colors.reset}`
  );
}

/**
 * Main validation function
 */
async function main(): Promise<void> {
  console.log(
    `${colors.bright}${colors.blue}Z.ai Model Validation${colors.reset}\n`
  );

  const args = parseArgs();
  const apiKey = getApiKey(args);

  const plugin = new ZaiPlugin({}, "ZAI_API_KEY");
  const models = plugin.getModels();

  console.log(
    `${colors.dim}Found ${models.length} models to validate${colors.reset}\n`
  );

  const results: ModelHealth[] = [];
  let healthyCount = 0;
  let unhealthyCount = 0;

  // Validate each model
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const progress = `[${i + 1}/${models.length}]`;

    process.stdout.write(
      `${colors.dim}${progress}${colors.reset} Validating ${colors.bright}${model.id}${colors.reset} ... `
    );

    const result = await validateModel(model.id, apiKey);
    results.push(result);

    if (result.healthy) {
      healthyCount++;
      console.log(`${colors.green}✓ healthy${colors.reset}`);
    } else {
      unhealthyCount++;
      console.log(`${colors.red}✗ unhealthy${colors.reset}`);
      if (result.error) {
        console.log(`      ${colors.dim}${result.error}${colors.reset}`);
      }
    }
  }

  const validationResult: ValidationResult = {
    provider: "zai",
    lastUpdated: Date.now(),
    models: results,
  };

  // Save results
  saveResults(validationResult);

  // Print summary
  console.log(
    `\n${colors.bright}Summary:${colors.reset}`
  );
  console.log(
    `  Validated: ${models.length} models`
  );
  console.log(
    `  ${colors.green}Healthy: ${healthyCount}${colors.reset}`
  );
  console.log(
    `  ${colors.red}Unhealthy: ${unhealthyCount}${colors.reset}`
  );

  // Exit with appropriate code
  if (unhealthyCount > 0) {
    console.log(
      `\n${colors.red}Validation failed: ${unhealthyCount} model(s) unhealthy${colors.reset}`
    );
    process.exit(1);
  } else {
    console.log(
      `\n${colors.green}All models are healthy!${colors.reset}`
    );
    process.exit(0);
  }
}

// Run main
main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
