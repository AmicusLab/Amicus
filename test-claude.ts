#!/usr/bin/env bun

/**
 * Quick test script for Claude API integration
 * 
 * Usage: bun run test-claude.ts
 */

import { ProviderRegistry } from './packages/core/src/llm/ProviderRegistry.js';
import { llmProviderConfig } from './config/llm-providers.js';
import { secretStore } from './apps/daemon/src/services/ConfigService.js';

async function testClaude() {
  console.log('🧪 Testing Claude API Integration...\n');

  // Load secrets
  await secretStore.load();
  
  // Get OAuth credential
  const credential = secretStore.getCredential('anthropic');
  
  if (!credential) {
    console.error('❌ No Anthropic OAuth credential found');
    console.log('Please connect Anthropic via Dashboard first');
    process.exit(1);
  }
  
  console.log('✅ OAuth credential found');
  console.log(`   Type: ${credential.type}`);
  
  let apiKey: string;
  if (credential.type === 'oauth') {
    apiKey = credential.accessToken;
    console.log(`   Token: ${apiKey.substring(0, 20)}...`);
    console.log(`   Expires: ${credential.expiresAt ? new Date(credential.expiresAt).toISOString() : 'N/A'}\n`);
  } else if (credential.type === 'api_key') {
    apiKey = credential.apiKey;
    console.log(`   API Key: ${apiKey.substring(0, 20)}...\n`);
  } else {
    apiKey = credential.token;
    console.log(`   Token: ${apiKey.substring(0, 20)}...\n`);
  }
  
  process.env.ANTHROPIC_API_KEY = apiKey;
  
  // Create registry and load Anthropic
  const registry = new ProviderRegistry();
  await registry.loadFromConfig(llmProviderConfig);
  
  // Check if loaded
  const loadedProviders = registry.getLoadedProviders();
  console.log('📦 Loaded providers:', loadedProviders);
  
  if (!loadedProviders.includes('anthropic')) {
    console.error('❌ Anthropic provider not loaded');
    console.log('Available providers:', loadedProviders);
    process.exit(1);
  }
  
  console.log('✅ Anthropic provider loaded\n');
  
  // Get available models
  const models = registry.getModelsByProvider('anthropic');
  console.log('🤖 Available Claude models:');
  models.forEach(m => {
    console.log(`   - ${m.id} (${m.contextWindow} tokens)`);
  });
  console.log();
  
  // Test inference
  console.log('🚀 Testing inference with Claude...\n');
  
  const plugin = registry.getPlugin('anthropic');
  if (!plugin) {
    console.error('❌ Could not get Anthropic plugin');
    process.exit(1);
  }
  
  try {
    const { generateText } = await import('ai');
    const anthropic = plugin.createProvider({ apiKey }) as any;
    
    const result = await generateText({
      model: anthropic('claude-3-5-sonnet-20241022'),
      prompt: 'Say "Hello from Claude!" in a friendly way. Keep it under 30 words.',
      maxTokens: 50,
    });
    
    console.log('✅ Inference successful!\n');
    console.log('📝 Response:');
    console.log('   ' + result.text);
    console.log();
    console.log('📊 Usage:');
    console.log(`   Prompt tokens: ${result.usage.promptTokens}`);
    console.log(`   Completion tokens: ${result.usage.completionTokens}`);
    console.log(`   Total tokens: ${result.usage.totalTokens}`);
    
  } catch (error) {
    console.error('❌ Inference failed:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
  
  console.log('\n✅ All tests passed!');
}

testClaude().catch(console.error);
