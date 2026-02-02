# LLM Provider Plugin Development Guide

이 문서는 AI 에이전트가 새로운 LLM provider를 추가하거나 수정할 때 따라야 하는 규칙과 주의사항을 정의합니다.

---

## 📋 Provider 추가 체크리스트

새로운 LLM provider를 추가할 때 다음 순서로 작업하세요:

### 1. Plugin 파일 생성
- [ ] `packages/core/src/llm/plugins/{provider-id}.ts` 생성
- [ ] `LLMProviderPlugin` 인터페이스 구현
- [ ] JSDoc 주석으로 documentation 작성

### 2. Export 등록
- [ ] `packages/core/src/llm/plugins/index.ts`에 export 추가

### 3. ProviderRegistry 등록
- [ ] `packages/core/src/llm/ProviderRegistry.ts`의 `loadPlugin()` switch case에 추가

### 4. Configuration 설정
- [ ] `config/llm-providers.ts`의 `providers` 배열에 추가
- [ ] `providerEnvMap`에 환경변수 매핑 추가
- [ ] `defaultModelsByProvider`에 기본 모델 추가

### 5. Environment Variables
- [ ] `.env.example`에 API 키 환경변수 추가

### 6. 검증
- [ ] `bun run typecheck` 통과
- [ ] `bun run build` 통과
- [ ] `bun run test` 통과
- [ ] `bun run verify` 전체 통과

---

## ⚠️ CRITICAL: Provider Factory 반환 규칙

### ❌ 잘못된 예 (절대 금지!)
```typescript
createProvider(config?: ProviderConfig): unknown {
  const provider = createOpenAI({
    baseURL: 'https://api.example.com/v1',
    apiKey: config?.apiKey ?? process.env[this.apiKeyEnv],
  });
  return provider('specific-model-id');  // ❌ 특정 모델 인스턴스 반환
}
```

### ✅ 올바른 예 (반드시 준수!)
```typescript
createProvider(config?: ProviderConfig): unknown {
  const apiKey = config?.apiKey ?? process.env[this.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`${this.apiKeyEnv} not set`);
  }
  const provider = createOpenAI({
    baseURL: 'https://api.example.com/v1',
    apiKey,
  });
  return provider;  // ✅ Provider factory 자체를 반환
}
```

### 이유
- Provider factory를 반환해야 모델을 동적으로 선택할 수 있습니다
- 특정 모델 인스턴스를 반환하면 모든 요청이 해당 모델로만 고정됩니다
- 이는 심각한 버그이며 시스템의 모델 라우팅 기능을 무효화합니다

---

## 🏗️ Plugin 구현 템플릿

### 기본 구조
```typescript
import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ProviderConfig, ModelInfo } from './types.js';

/**
 * {Provider Name} Provider Plugin
 *
 * {Brief description of the provider}
 * {Special features or capabilities}
 *
 * Base URL: {API endpoint URL}
 * Documentation: {Official docs URL}
 */
export class {Provider}Plugin implements LLMProviderPlugin {
  readonly name = '{Provider Display Name}';
  readonly id = '{provider-id}';

  constructor(
    private module: Record<string, unknown>,
    private apiKeyEnv: string
  ) {}

  createProvider(config?: ProviderConfig): unknown {
    const apiKey = config?.apiKey ?? process.env[this.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`${this.apiKeyEnv} not set`);
    }
    const provider = createOpenAI({
      baseURL: '{API_ENDPOINT_URL}',
      apiKey,
    });
    return provider;  // ✅ Return factory, not instance!
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: '{model-id}',
        name: '{Model Display Name}',
        description: '{Brief model description}',
        maxTokens: {max_context_tokens},
        inputCostPer1K: {input_cost},
        outputCostPer1K: {output_cost},
        complexityRange: { min: {min_complexity}, max: {max_complexity} },
        capabilities: ['{capability1}', '{capability2}'],
      },
      // Add more models as needed
    ];
  }

  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.getModels().find((m) => m.id === modelId);
    if (!model) return 0;
    return (
      (inputTokens / 1000) * model.inputCostPer1K +
      (outputTokens / 1000) * model.outputCostPer1K
    );
  }
}
```

---

## 📝 Naming Conventions

### Provider ID
- **Format**: `lowercase-with-hyphens`
- **Examples**: `zai`, `zai-coding-plan`, `kimi-code`
- **Rule**: 간결하고 명확하게, 공식 이름 사용

### Class Name
- **Format**: `{Provider}Plugin`
- **Examples**: `ZaiPlugin`, `KimiCodePlugin`
- **Rule**: PascalCase, "Plugin" suffix 필수

### Environment Variable
- **Format**: `{PROVIDER_ID}_API_KEY`
- **Examples**: `ZAI_API_KEY`, `KIMI_API_KEY`
- **Rule**: UPPERCASE_WITH_UNDERSCORES, `_API_KEY` suffix 표준
- **Note**: Multiple providers can share the same API key (e.g., kimi and kimi-code both use KIMI_API_KEY)

---

## 🔑 API Key 관리

### 환경변수 우선순위
1. `config?.apiKey` (Runtime configuration)
2. `process.env[this.apiKeyEnv]` (Environment variable)
3. Error if neither available

### Validation
```typescript
const apiKey = config?.apiKey ?? process.env[this.apiKeyEnv];
if (!apiKey) {
  throw new Error(`${this.apiKeyEnv} not set`);
}
```

### Security
- ❌ 절대 API 키를 코드에 하드코딩하지 마세요
- ❌ 절대 API 키를 Git에 커밋하지 마세요
- ✅ 항상 환경변수나 설정 파일 사용
- ✅ `.env.example`에는 placeholder만 포함

---

## 🎯 Model Information Guidelines

### complexityRange 설정
모델의 성능과 비용을 기반으로 복잡도 범위를 설정합니다:

- **min: 25-30, max: 50-60**: Ultra-lightweight, fast models
- **min: 40-50, max: 70-80**: Standard models
- **min: 60-70, max: 90-100**: High-performance models
- **min: 70-80, max: 100**: Flagship models

### capabilities 정의
사용 가능한 capability 값:
- `'text'`: Text generation
- `'vision'`: Image understanding
- `'audio'`: Audio processing
- `'tools'`: Function calling
- `'streaming'`: Streaming responses

### Pricing Information
- 정확한 가격 정보를 공식 문서에서 확인
- USD per 1K tokens 단위 사용
- 불확실하면 TODO 주석과 함께 임시값 사용:
  ```typescript
  inputCostPer1K: 0.0,  // TODO: Verify pricing
  outputCostPer1K: 0.0,  // TODO: Verify pricing
  ```

---

## 🔄 Multiple Endpoints Pattern

동일 provider에 여러 endpoint가 있을 경우 (예: general vs coding):

### 1. 별도 Plugin 생성
```typescript
// zai.ts - General endpoint
export class ZaiPlugin implements LLMProviderPlugin {
  readonly id = 'zai';
  // baseURL: 'https://api.z.ai/api/paas/v4'
}

// zai-coding-plan.ts - Coding endpoint
export class ZaiCodingPlanPlugin implements LLMProviderPlugin {
  readonly id = 'zai-coding-plan';
  // baseURL: 'https://api.z.ai/api/coding/paas/v4'
}
```

### 2. 별도 Configuration
```typescript
// config/llm-providers.ts
{
  id: 'zai',
  envKey: 'ZAI_API_KEY',
  baseURL: 'https://api.z.ai/api/paas/v4',
},
{
  id: 'zai-coding-plan',
  envKey: 'ZAI_CODING_PLAN_API_KEY',
  baseURL: 'https://api.z.ai/api/coding/paas/v4',
}
```

### 3. 별도 API Key (선택적)
- 같은 API 키 사용 가능: 동일 envKey 사용
- 다른 API 키 필요: 별도 envKey 사용

---

## 🧪 Testing Guidelines

### Manual Testing Steps
1. `.env`에 API 키 설정
2. `config/llm-providers.ts`에서 provider `enabled: true` 설정
3. Daemon 실행: `bun run --cwd apps/daemon dev`
4. Dashboard 접속: http://localhost:5173
5. Admin 패널에서 provider 확인
6. API 키 입력 및 validation 테스트
7. 모델 선택 및 실제 요청 테스트

### Automated Testing
```typescript
// packages/core/src/llm/plugins/__tests__/{provider}.test.ts
describe('{Provider}Plugin', () => {
  it('should return provider factory', () => {
    const plugin = new {Provider}Plugin({}, 'TEST_API_KEY');
    const provider = plugin.createProvider({ apiKey: 'test-key' });
    expect(provider).toBeDefined();
    expect(typeof provider).toBe('function');
  });

  it('should provide model information', () => {
    const plugin = new {Provider}Plugin({}, 'TEST_API_KEY');
    const models = plugin.getModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty('id');
    expect(models[0]).toHaveProperty('name');
  });
});
```

---

## 📊 Configuration Files Reference

### 수정해야 하는 파일 목록

1. **Plugin Implementation**
   - `packages/core/src/llm/plugins/{provider}.ts`

2. **Export Declaration**
   - `packages/core/src/llm/plugins/index.ts`

3. **Registry Integration**
   - `packages/core/src/llm/ProviderRegistry.ts`

4. **Configuration**
   - `config/llm-providers.ts` (3곳: providers, providerEnvMap, defaultModelsByProvider)

5. **Environment Variables**
   - `.env.example`

---

## ⚠️ Common Pitfalls

### 1. Provider Factory 버그 ⛔ CRITICAL
```typescript
// ❌ 절대 금지!
return provider('model-id');

// ✅ 반드시 이렇게!
return provider;
```

### 2. Switch Case 누락
`ProviderRegistry.ts`의 `loadPlugin()` switch case에 추가를 잊지 마세요.

### 3. Configuration 불일치
`providerEnvMap`과 `defaultModelsByProvider`의 provider ID가 정확히 일치해야 합니다.

### 4. Environment Variable 오타
환경변수 이름이 모든 곳에서 일치해야 합니다:
- Plugin constructor
- .env.example
- config/llm-providers.ts

### 5. baseURL 누락
OpenAI-compatible provider는 반드시 `baseURL`을 지정해야 합니다.

---

## 🔍 Debugging Tips

### Provider가 로드되지 않을 때
1. `ProviderRegistry.ts` switch case 확인
2. `config/llm-providers.ts`에서 `enabled: true` 확인
3. Environment variable 설정 확인
4. Daemon 로그에서 에러 메시지 확인

### 모델이 표시되지 않을 때
1. `getModels()` 반환값 확인
2. Model registry 로딩 확인
3. API 키 validation 상태 확인

### Dynamic Model Selection이 안 될 때
1. **가장 먼저 확인**: `createProvider()`가 factory 반환하는지 확인
2. Provider configuration의 baseURL 확인
3. Model ID가 정확한지 확인

---

## 📚 Reference Examples

### 완벽한 구현 예시
참고할 provider 구현:
- ✅ `zai.ts` - General endpoint, multiple models, clean implementation
- ✅ `zai-coding-plan.ts` - Coding endpoint variation
- ✅ `anthropic.ts` - Official SDK integration
- ✅ `openai.ts` - Standard implementation

### 버그 있는 구현 (참고 금지!)
- ❌ `kimi.ts:31` - Provider factory 버그 (수정 필요)

---

## 🚀 Quick Reference

### 최소 구현 체크리스트
1. ✅ Plugin 파일 생성 (`{provider}.ts`)
2. ✅ `createProvider()` - factory 반환 (인스턴스 ❌)
3. ✅ `getModels()` - 모델 목록 반환
4. ✅ Export 추가 (`index.ts`)
5. ✅ Registry 등록 (switch case)
6. ✅ Config 3곳 추가 (providers, envMap, defaultModels)
7. ✅ `.env.example` 업데이트
8. ✅ `bun run verify` 통과

### 검증 명령어
```bash
bun run typecheck  # TypeScript 검사
bun run build      # 빌드 확인
bun run test       # 단위 테스트
bun run verify     # 전체 검증 (권장)
```

---

## 💡 Best Practices

1. **문서화**: JSDoc 주석으로 provider 정보 명확히 작성
2. **에러 처리**: API 키 누락 시 명확한 에러 메시지
3. **일관성**: 기존 provider 코드 스타일 따르기
4. **테스트**: 실제 API 호출로 검증
5. **보안**: API 키는 절대 하드코딩 금지

---

## 📖 Further Reading

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Provider Registry Implementation](../ProviderRegistry.ts)
- [Model Registry](../model/ModelRegistry.ts)
- [Z.ai Integration PR #17](https://github.com/AmicusLab/Amicus/pull/17)

---

**Last Updated**: 2026-02-02  
**Version**: 1.0.0
