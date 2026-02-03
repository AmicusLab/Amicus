#!/usr/bin/env bun

/**
 * Quick test script for Claude API integration
 * 
 * Usage: bun run test-claude.ts
 */

import { ProviderRegistry, llmProviderConfig } from '@amicus/core';
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
  
  if (credential.type === 'oauth') {
    console.log(`   Token: ${credential.accessToken.substring(0, 20)}...`);
    console.log(`   Expires: ${credential.expiresAt ? new Date(credential.expiresAt).toISOString() : 'N/A'}\n`);
    process.env.ANTHROPIC_API_KEY = credential.accessToken;
  } else {
    console.log(`   API Key: ${credential.apiKey.substring(0, 20)}...\n`);
    process.env.ANTHROPIC_API_KEY = credential.apiKey;
  }
  
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
    const result = await plugin.generateText(
      'claude-3-5-sonnet-20241022',
      'Say "Hello from Claude!" in a friendly way.',
      { maxTokens: 50 }
    );
    
    console.log('✅ Inference successful!\n');
    console.log('📝 Response:');
    console.log('   ' + result.text);
    console.log();
    console.log('📊 Usage:');
    console.log(`   Input tokens: ${result.usage?.inputTokens ?? 0}`);
    console.log(`   Output tokens: ${result.usage?.outputTokens ?? 0}`);
    console.log(`   Total tokens: ${result.usage?.totalTokens ?? 0}`);
    
  } catch (error) {
    console.error('❌ Inference failed:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
  
  console.log('\n✅ All tests passed!');
}

testClaude().catch(console.error);
