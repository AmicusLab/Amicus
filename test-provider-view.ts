import { llmProviderConfig } from './config/llm-providers.js';
import type { ProviderConfigEntry } from './packages/core/src/llm/plugins/types.js';
import type { ProviderAuthConfig } from './packages/types/src/auth.js';

function mergeProviders(
  defaults: ProviderConfigEntry[],
  userConfig: ProviderConfigEntry[]
): ProviderConfigEntry[] {
  const userMap = new Map(userConfig.map((p) => [p.id, p]));
  const merged: ProviderConfigEntry[] = [];

  for (const defaultProvider of defaults) {
    const userProvider = userMap.get(defaultProvider.id);
    if (userProvider) {
      const defaultAuth = (defaultProvider as unknown as { auth?: ProviderAuthConfig }).auth;
      const userAuth = (userProvider as unknown as { auth?: ProviderAuthConfig }).auth;
      
      const mergedProvider = {
        ...defaultProvider,
        ...userProvider,
      };
      
      if (defaultAuth) {
        (mergedProvider as unknown as { auth: ProviderAuthConfig }).auth = userAuth ?? defaultAuth;
      }
      
      merged.push(mergedProvider);
      userMap.delete(defaultProvider.id);
    } else {
      merged.push(defaultProvider);
    }
  }

  for (const remaining of userMap.values()) {
    merged.push(remaining);
  }

  return merged;
}

const userConfig: ProviderConfigEntry[] = [
  { id: 'anthropic', enabled: true, package: '@ai-sdk/anthropic' },
  { id: 'openai', enabled: true, package: '@ai-sdk/openai' },
];

const merged = mergeProviders(llmProviderConfig.providers, userConfig);

const anthropic = merged.find(p => p.id === 'anthropic');
const openai = merged.find(p => p.id === 'openai');

console.log('Anthropic:');
console.log('  - enabled:', anthropic?.enabled);
console.log('  - auth:', (anthropic as any)?.auth);
console.log('  - auth.method:', (anthropic as any)?.auth?.method);
console.log('  - auth.oauthMethods:', (anthropic as any)?.auth?.oauthMethods?.map((m: any) => m.id));

console.log('\nOpenAI:');
console.log('  - enabled:', openai?.enabled);
console.log('  - auth:', (openai as any)?.auth);
console.log('  - auth.method:', (openai as any)?.auth?.method);
console.log('  - auth.oauthMethods:', (openai as any)?.auth?.oauthMethods?.map((m: any) => m.id));
