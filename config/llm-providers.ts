import type { LLMProviderConfig } from '../packages/core/src/llm/plugins/types.js';
import type { ProviderAuthConfig } from '../packages/types/src/auth.js';

/**
 * LLM Provider 기본 설정
 * 
 * @example
 * // 새로운 Provider 추가
 * { 
 *   id: 'newprovider', 
 *   enabled: true, 
 *   package: '@ai-sdk/new-provider',
 *   envKey: 'NEWPROVIDER_API_KEY'  // 선택적, 기본값은 {ID}_API_KEY
 * }
 */
export const llmProviderConfig: LLMProviderConfig = {
  providers: [
    // 공식 Vercel AI SDK providers
    { 
      id: 'anthropic', 
      enabled: true, 
      package: '@ai-sdk/anthropic',
      envKey: 'ANTHROPIC_API_KEY',
      auth: {
        method: 'both',
        envKey: 'ANTHROPIC_API_KEY',
        oauthMethods: [
          {
            id: 'claude-pro',
            label: 'Claude Pro/Max',
            flow: {
              flow: 'code_paste',
              clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
              authorizationUrl: 'https://claude.ai/oauth/authorize',
              tokenUrl: 'https://console.anthropic.com/v1/oauth/token',
              redirectUri: 'https://console.anthropic.com/oauth/code/callback',
              scope: 'org:create_api_key user:profile user:inference',
            },
          },
          {
            id: 'create-api-key',
            label: 'Create an API Key',
            flow: {
              flow: 'code_paste',
              clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
              authorizationUrl: 'https://console.anthropic.com/oauth/authorize',
              tokenUrl: 'https://console.anthropic.com/v1/oauth/token',
              redirectUri: 'https://console.anthropic.com/oauth/code/callback',
              scope: 'org:create_api_key user:profile',
            },
          },
        ],
      } as ProviderAuthConfig,
    },
    { 
      id: 'openai', 
      enabled: true, 
      package: '@ai-sdk/openai',
      envKey: 'OPENAI_API_KEY',
      auth: {
        method: 'both',
        envKey: 'OPENAI_API_KEY',
        oauthMethods: [
          {
            id: 'chatgpt-browser',
            label: 'ChatGPT Pro/Plus (Browser)',
            flow: {
              flow: 'pkce',
              clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
              authorizationUrl: 'https://auth.openai.com/oauth/authorize',
              tokenUrl: 'https://auth.openai.com/oauth/token',
              callbackUrl: 'http://localhost:3000/oauth/callback',
              scope: 'openid profile email offline_access',
            },
          },
          {
            id: 'chatgpt-headless',
            label: 'ChatGPT Pro/Plus (Headless)',
            flow: {
              flow: 'device_code',
              clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
              deviceCodeUrl: 'https://auth.openai.com/api/accounts/deviceauth/usercode',
              tokenUrl: 'https://auth.openai.com/api/accounts/deviceauth/token',
              scope: 'openid profile email offline_access',
            },
          },
        ],
      } as ProviderAuthConfig,
    },
    { 
      id: 'google', 
      enabled: true, 
      package: '@ai-sdk/google',
      envKey: 'GOOGLE_API_KEY',
      auth: {
        method: 'both',
        envKey: 'GOOGLE_API_KEY',
        oauthMethods: [
          {
            id: 'gemini-browser',
            label: 'Google Gemini (Browser)',
            flow: {
              flow: 'pkce',
              clientId: '456324763910-ejpb7ro7k7baenh62uvnoh3isl2gh66r.apps.googleusercontent.com',
              authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
              tokenUrl: 'https://oauth2.googleapis.com/token',
              callbackUrl: 'http://localhost:3000/oauth/callback',
              scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email',
            },
          },
        ],
      } as ProviderAuthConfig,
    },
    { 
      id: 'groq', 
      enabled: true, 
      package: '@ai-sdk/groq',
      envKey: 'GROQ_API_KEY'
    },
    
    // 커뮤니티/호환 providers
    {
      id: 'zai',
      enabled: false,
      package: '@ai-sdk/openai',
      envKey: 'ZAI_API_KEY',
      baseURL: 'https://api.z.ai/api/paas/v4',
    },
    {
      id: 'zai-coding-plan',
      enabled: false,
      package: '@ai-sdk/openai',
      envKey: 'ZAI_CODING_PLAN_API_KEY',
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
    },
    { 
      id: 'kimi-for-coding', 
      enabled: false, 
      package: '@ai-sdk/openai',
      envKey: 'KIMI_API_KEY'
    },
    {
      id: 'openrouter',
      enabled: false,
      package: '@ai-sdk/openai',
      envKey: 'OPENROUTER_API_KEY',
      baseURL: 'https://openrouter.ai/api/v1',
    },
    {
      id: 'moonshot',
      enabled: false,
      package: '@ai-sdk/openai',
      envKey: 'MOONSHOT_API_KEY',
      baseURL: 'https://api.moonshot.cn/v1',
    },
    {
      id: 'minimax',
      enabled: false,
      package: '@ai-sdk/openai',
      envKey: 'MINIMAX_API_KEY',
      baseURL: 'https://api.minimax.chat/v1',
    },
    
    {
      id: 'github-copilot',
      enabled: false,
      package: '@ai-sdk/openai',
      baseURL: 'https://api.githubcopilot.com',
      auth: {
        method: 'oauth',
        oauthMethods: [
          {
            id: 'copilot-device',
            label: 'GitHub Copilot',
            flow: {
              flow: 'device_code',
              clientId: 'Ov23li8tweQw6odWQebz',
              deviceCodeUrl: 'https://github.com/login/device/code',
              tokenUrl: 'https://github.com/login/oauth/access_token',
              scope: 'read:user',
              copilotTokenUrl: 'https://api.github.com/copilot_internal/v2/token',
            },
          },
        ],
      } as ProviderAuthConfig,
    },
  ],
  
  defaultModel: null,
  
  dailyBudget: 10.00,
  
  // 예산 알림 임계값 (0.0-1.0)
  budgetAlertThreshold: 0.8,
};

/**
 * Provider 환경변수 매핑
 * 
 * 각 Provider에 필요한 환경변수를 정의합니다.
 */
export const providerEnvMap: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
  groq: 'GROQ_API_KEY',
  zai: 'ZAI_API_KEY',
  'zai-coding-plan': 'ZAI_CODING_PLAN_API_KEY',
  'kimi-for-coding': 'KIMI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  moonshot: 'MOONSHOT_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  'google-gemini': 'GOOGLE_API_KEY',
};

/**
 * Provider별 모델 기본값
 */
export const defaultModelsByProvider: Record<string, string> = {
  anthropic: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4-turbo',
  google: 'gemini-1.5-pro',
  groq: 'llama-3.3-70b-versatile',
  zai: 'glm-4.7',
  'zai-coding-plan': 'glm-4.7',
  'kimi-for-coding': 'kimi-for-coding',
  openrouter: 'openai/gpt-4-turbo',
  moonshot: 'moonshot-v1-128k',
  minimax: 'abab5.5-chat',
  'openai-codex': 'gpt-4o',
  'anthropic-max': 'claude-3-5-sonnet-20241022',
  'github-copilot': 'gpt-4o',
  'google-gemini': 'gemini-1.5-pro',
};
