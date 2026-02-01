/**
 * LLM Provider Configuration
 * 
 * LLM Provider 플러그인 설정 파일
 * 이 파일을 수정하여 Provider를 활성화/비활성화할 수 있습니다.
 */

import type { LLMProviderConfig } from '../packages/core/src/llm/plugins/types.js';

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
      envKey: 'ANTHROPIC_API_KEY'
    },
    { 
      id: 'openai', 
      enabled: true, 
      package: '@ai-sdk/openai',
      envKey: 'OPENAI_API_KEY'
    },
    { 
      id: 'google', 
      enabled: true, 
      package: '@ai-sdk/google',
      envKey: 'GOOGLE_API_KEY'
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
      baseURL: 'https://api.z.ai/v1',
    },
    { 
      id: 'moonshot', 
      enabled: false, 
      package: '@ai-sdk/openai-compatible',
      envKey: 'MOONSHOT_API_KEY'
    },
    
    // 향후 추가될 providers 예시
    // { 
    //   id: 'mistral', 
    //   enabled: false, 
    //   package: '@ai-sdk/mistral',
    //   envKey: 'MISTRAL_API_KEY'
    // },
    // { 
    //   id: 'cohere', 
    //   enabled: false, 
    //   package: '@ai-sdk/cohere',
    //   envKey: 'COHERE_API_KEY'
    // },
  ],
  
  // 기본 모델 (provider:model 형식)
  defaultModel: 'anthropic:claude-3-5-sonnet-20241022',
  
  // 일일 예산 (USD)
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
  moonshot: 'MOONSHOT_API_KEY',
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
  moonshot: 'kimi-k2.5',
};
