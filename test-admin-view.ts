import { llmProviderConfig } from './config/llm-providers.js';
import { ProviderRegistry } from './packages/core/src/index.js';
import type { ProviderConfigEntry } from './packages/core/src/llm/plugins/types.js';
import type { ProviderAuthConfig } from './packages/types/src/auth.js';

class TestProviderService {
  private registry: ProviderRegistry;

  constructor() {
    this.registry = new ProviderRegistry();
  }

  private mergeProviders(
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
        
        if (defaultProvider.id === 'anthropic' || defaultProvider.id === 'openai') {
          console.log(`\n[MERGE] ${defaultProvider.id}:`);
          console.log('  defaultProvider:', defaultProvider);
          console.log('  defaultAuth:', defaultAuth);
          console.log('  userProvider:', userProvider);
          console.log('  userAuth:', userAuth);
          console.log('  final auth:', userAuth ?? defaultAuth);
        }
        
        const mergedProvider = {
          ...defaultProvider,
          ...userProvider,
          auth: userAuth ?? defaultAuth,
        } as ProviderConfigEntry;
        
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

  getAdminProviderView() {
    const userConfig: ProviderConfigEntry[] = [
      { id: 'anthropic', enabled: true, package: '@ai-sdk/anthropic' },
      { id: 'openai', enabled: true, package: '@ai-sdk/openai' },
    ];
    
    const rawProviders = this.mergeProviders(llmProviderConfig.providers, userConfig);

    const state = this.registry.getState();
    return rawProviders.map((p) => {
      const loaded = state.loadedProviders.includes(p.id);
      const available = state.availableProviders.includes(p.id);
      const failed = state.failedProviders.find((fp: any) => fp.providerId === p.id);
      
      if (p.id === 'anthropic' || p.id === 'openai') {
        console.log(`\n[DEBUG] ${p.id} raw provider:`, p);
        console.log(`[DEBUG] ${p.id} has auth property:`, 'auth' in p);
        console.log(`[DEBUG] ${p.id} auth value:`, (p as any).auth);
      }
      
      const auth = (p as { auth?: ProviderAuthConfig }).auth;
      const authMethod = auth?.method ?? 'api_key';
      
      let oauthStatus: 'connected' | 'disconnected' | undefined;
      let oauthMethods: Array<{ id: string; label: string; flow: 'device_code' | 'pkce' | 'code_paste' }> | undefined;
      
      if (authMethod === 'oauth' || authMethod === 'both') {
        oauthStatus = 'disconnected';
        
        if (auth?.oauthMethods && auth.oauthMethods.length > 0) {
          oauthMethods = auth.oauthMethods.map((method) => ({
            id: method.id,
            label: method.label,
            flow: method.flow.flow,
          }));
        }
      }
      
      return {
        id: p.id,
        enabled: p.enabled,
        loaded,
        available,
        modelCount: this.registry.getModelsByProvider(p.id).length,
        authMethod,
        ...(oauthStatus ? { oauthStatus } : {}),
        ...(oauthMethods ? { oauthMethods } : {}),
        ...(failed?.message ? { error: failed.message } : {}),
      };
    });
  }
}

const service = new TestProviderService();
const view = service.getAdminProviderView();

const anthropic = view.find(p => p.id === 'anthropic');
const openai = view.find(p => p.id === 'openai');

console.log('Anthropic AdminProviderView:');
console.log(JSON.stringify(anthropic, null, 2));

console.log('\nOpenAI AdminProviderView:');
console.log(JSON.stringify(openai, null, 2));
