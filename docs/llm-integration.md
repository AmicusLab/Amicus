# LLM 통합 가이드

이 문서는 Amicus 프로젝트에서 지원하는 LLM(Large Language Model) 프로바이더의 통합 방법, 설정, 사용법을 설명합니다.

---

## 1. 개요

Amicus는 Vercel AI SDK를 기반으로 6개의 LLM 프로바이더를 지원합니다. `Economist` 클래스가 작업 복잡도를 분석하고 비용 최적화를 위해 적절한 모델로 자동 라우팅합니다.

### 핵심 특징

- **다중 프로바이더 지원**: Anthropic, OpenAI, Google, Groq, z.ai, Moonshot
- **자동 모델 라우팅**: 작업 복잡도에 따라 최적의 모델 선택
- **비용 추적 및 예산 관리**: 실시간 비용 모니터링 및 예산 알림
- **스트리밍 지원**: 실시간 텍스트 생성
- **오픈소스 SDK**: Vercel AI SDK 기반

---

## 2. 지원 프로바이더

### 2.1 공식 Vercel AI SDK 프로바이더 (기본 활성화)

| 프로바이더 | ID | 패키지 | 상태 | 주요 모델 |
|------------|----|----|----|----|----|
| **Anthropic** | `anthropic` | `@ai-sdk/anthropic` | ✅ 활성 | claude-3-haiku, claude-3-sonnet, claude-3-5-sonnet |
| **OpenAI** | `openai` | `@ai-sdk/openai` | ✅ 활성 | gpt-3.5-turbo, gpt-4, gpt-4-turbo |
| **Google** | `google` | `@ai-sdk/google` | ✅ 활성 | gemini-1.5-flash |
| **Groq** | `groq` | `@ai-sdk/groq` | ✅ 활성 | (고속 추론 전용) |

### 2.2 커뮤니티/호환 프로바이더 (기본 비활성)

| 프로바이더 | ID | 패키지 | 상태 | 비고 |
|------------|----|----|----|----|
| **z.ai** | `zai` | `@ai-sdk/openai` | ⚪ 비활성 | OpenAI 호환 API |
| **Moonshot AI** | `moonshot` | `@ai-sdk/openai` | ⚪ 비활성 | OpenAI 호환 API |

### 2.3 모델별 가격 정보

| 모델 ID | 프로바이더 | 입력 토큰/1K | 출력 토큰/1K | 복잡도 범위 | 설명 |
|---------|-----------|--------------|--------------|-------------|------|
| `gemini-1.5-flash` | Google | $0.000075 | $0.0003 | 0-30 | 빠르고 저렴한 간단 작업용 |
| `claude-3-haiku-20240307` | Anthropic | $0.00025 | $0.00125 | 0-30 | 빠르고 효율적인 간단 작업용 |
| `gpt-3.5-turbo` | OpenAI | $0.0005 | $0.0015 | 30-70 | 균형 잡힌 성능과 비용 |
| `claude-3-sonnet-20240229` | Anthropic | $0.003 | $0.015 | 30-70 | 중간 복잡도에 강한 성능 |
| `claude-3-5-sonnet-20241022` | Anthropic | $0.003 | $0.015 | 70-100 | 복잡한 추론 작업용 (기본값) |
| `gpt-4-turbo` | OpenAI | $0.01 | $0.03 | 70-100 | 향상된 GPT-4 모델 |
| `gpt-4` | OpenAI | $0.03 | $0.06 | 70-100 | 가장 강력한 복잡 작업용 |

---

## 3. 빠른 시작

### 3.1 환경 변수 설정

`.env` 파일에 사용할 프로바이더의 API 키를 추가합니다. 최소 하나의 프로바이더가 필요합니다.

```bash
# LLM API 키 (최소 하나 필요)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
GROQ_API_KEY=gsk_...

# 커뮤니티 프로바이더 (선택사항)
ZAI_API_KEY=...
MOONSHOT_API_KEY=...

# 예산 설정
LLM_BUDGET_DAILY=10.00
LLM_BUDGET_ALERT_THRESHOLD=0.8

# 기본 모델 (형식: provider:model)
LLM_DEFAULT_MODEL=anthropic:claude-3-5-sonnet-20241022
```

### 3.2 API 키 발급 방법

#### Anthropic
- [Anthropic Console](https://console.anthropic.com/) 접속
- API Keys 탭에서 새 키 생성

#### OpenAI
- [OpenAI Platform](https://platform.openai.com/api-keys) 접속
- Create new secret key 클릭

#### Google AI
- [Google AI Studio](https://makersuite.google.com/app/apikey) 접속
- Create API Key 클릭

#### Groq
- [Groq Console](https://console.groq.com/keys) 접속
- Create Key 클릭

#### z.ai
- [z.ai Platform](https://z.ai) 접속
- API 키 생성

#### Moonshot AI
- [Moonshot Platform](https://platform.moonshot.cn/console/api-keys) 접속
- API Key 생성

---

## 4. 설정

### 4.1 프로바이더 설정 파일

`packages/core/src/config/llm-providers.ts`에서 프로바이더를 관리합니다.

```typescript
export const llmProviderConfig: LLMProviderConfig = {
  providers: [
    {
      id: 'anthropic',
      enabled: true,  // 활성화/비활성화
      package: '@ai-sdk/anthropic',
      envKey: 'ANTHROPIC_API_KEY',
    },
    {
      id: 'openai',
      enabled: true,
      package: '@ai-sdk/openai',
      envKey: 'OPENAI_API_KEY',
    },
    // ... 다른 프로바이더
  ],

  // 기본 모델 (형식: provider:model)
  defaultModel: 'anthropic:claude-3-5-sonnet-20241022',

  // 일일 예산 (USD)
  dailyBudget: 10.0,

  // 예산 알림 임계값 (0.0 - 1.0)
  budgetAlertThreshold: 0.8,  // 예산의 80% 사용 시 알림
};
```

### 4.2 프로바이더 활성화/비활성화

사용하지 않는 프로바이더는 `enabled: false`로 설정하여 비용을 절약하세요.

```typescript
{
  id: 'moonshot',
  enabled: false,  // 비활성화
  package: '@ai-sdk/openai',
  envKey: 'MOONSHOT_API_KEY',
},
```

### 4.3 기본 모델 변경

작업의 성격에 따라 기본 모델을 변경하세요.

```typescript
// 빠르고 저렴한 응답을 원할 때
defaultModel: 'anthropic:claude-3-haiku-20240307',

// 균형 잡힌 성능이 필요할 때
defaultModel: 'openai:gpt-3.5-turbo',

// 복잡한 추론이 필요할 때
defaultModel: 'anthropic:claude-3-5-sonnet-20241022',
```

---

## 5. 사용 예제

### 5.1 Economist 클래스 초기화

```typescript
import { Economist } from '@amicus/core';

const economist = new Economist({
  defaultModel: 'anthropic:claude-3-5-sonnet-20241022',
  budget: 10.0,  // 일일 예산 $10
  budgetAlertThreshold: 0.8,
  onBudgetAlert: (spent, budget) => {
    console.warn(`⚠️ 예산 경고: $${spent.toFixed(2)} / $${budget}`);
  },
});
```

### 5.2 텍스트 생성

```typescript
// Example: Task definition for text generation
const task = {
  id: 'task-1',
  description: 'Create a simple REST API endpoint',
  status: 'pending' as const,  // Task status (pending/running/completed/failed)
  priority: 'medium' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const prompt = 'Design a REST API endpoint for user registration';

try {
  const result = await economist.generateText(task, prompt);
  console.log('Generated text:', result);
} catch (error) {
  console.error('Generation failed:', error);
}
```

### 5.3 스트리밍 텍스트 생성

```typescript
// Example: Task definition for streaming text generation
const task = {
  id: 'task-2',
  description: 'Generate code for authentication system',
  status: 'pending' as const,  // Task status (pending/running/completed/failed)
  priority: 'high' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const prompt = 'Write TypeScript code for JWT authentication';

try {
  const result = await economist.generateTextStream(task, prompt);

  // 실시간 스트림 처리
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }

  // 전체 텍스트 가져오기
  const fullText = await result.fullTextPromise;
  console.log('\nFull text:', fullText);

  // 토큰 사용량 확인
  const usage = await result.usage;
  console.log('Token usage:', usage);
} catch (error) {
  console.error('Streaming failed:', error);
}
```

### 5.4 작업 복잡도 분석

```typescript
// Example: Task with metadata for complexity analysis
const task = {
  id: 'task-3',
  description: 'Design and implement a microservice architecture with event-driven communication',
  status: 'pending' as const,  // Task status (pending/running/completed/failed)
  priority: 'high' as const,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  metadata: {
    steps: ['design', 'implement', 'test', 'deploy'],
    dependencies: ['api-gateway', 'service-discovery'],
  },
};

const complexity = economist.analyzeComplexity(task);
console.log('Complexity Score:', complexity);
// 출력:
// {
//   lexical: 45,  // 어휘적 복잡도
//   semantic: 65, // 의미적 복잡도
//   scope: 55,    // 범위 복잡도
//   total: 55     // 전체 복잡도
// }
```

### 5.5 모델 라우팅 확인

```typescript
const routing = economist.route(task);
console.log('Routing Result:', routing);
// 출력:
// {
//   model: 'anthropic:claude-3-sonnet-20240229',
//   provider: 'anthropic',
//   estimatedCost: 0.015,
//   complexity: { lexical: 45, semantic: 65, scope: 55, total: 55 }
// }
```

### 5.6 사용 가능한 모델 확인

```typescript
const models = economist.getAvailableModels();
models.forEach(model => {
  console.log(`[${model.provider}] ${model.id}`);
  console.log(`  Description: ${model.description}`);
  console.log(`  Input Cost: $${model.inputCostPer1K}/1K tokens`);
  console.log(`  Output Cost: $${model.outputCostPer1K}/1K tokens`);
  console.log(`  Complexity: ${model.complexityRange.min}-${model.complexityRange.max}`);
});
```

---

## 6. 비용 추적 및 예산 관리

### 6.1 비용 통계 확인

```typescript
const stats = economist.getCostStats();
console.log('Cost Statistics:', stats);
// 출력:
// {
//   spent: 2.50,         // 현재 소비 비용
//   budget: 10.00,      // 전체 예산
//   requests: 45,        // 총 요청 수
//   averageCost: 0.056,  // 평균 비용
//   remaining: 7.50      // 남은 예산
// }
```

### 6.2 비용 내역 확인

```typescript
const history = economist.getCostHistory();
history.forEach(entry => {
  console.log(`[${new Date(entry.timestamp).toISOString()}]`);
  console.log(`  Model: ${entry.model}`);
  console.log(`  Cost: $${entry.estimatedCost.toFixed(6)}`);
  console.log(`  Complexity: ${entry.complexity.total}`);
});
```

### 6.3 예산 업데이트

```typescript
// 예산을 $20으로 증액
economist.updateBudget(20.0);
```

### 6.4 비용 내역 초기화

```typescript
// 새로운 세션 시작 시 비용 내역 리셋
economist.clearCostHistory();
```

### 6.5 예산 알림 설정

```typescript
const economist = new Economist({
  budget: 10.0,
  budgetAlertThreshold: 0.8,  // 80% 도달 시 알림
  onBudgetAlert: (spent, budget) => {
    const ratio = (spent / budget) * 100;
    console.error(`⚠️ 예산 ${ratio.toFixed(1)}% 사용됨!`);
    console.error(`   현재: $${spent.toFixed(2)} / $${budget}`);

    // 이메일/Slack 알림 등 추가 처리
    sendNotification(`Budget Alert: ${ratio.toFixed(1)}% used`);
  },
});
```

---

## 7. 문제 해결

### 7.1 API 키 관련 문제

**오류 메시지:**
```
Error: No AI providers available. Please install @ai-sdk/anthropic, @ai-sdk/openai, or @ai-sdk/google
```

**해결 방법:**
1. `.env` 파일에 API 키가 올바르게 설정되었는지 확인
2. `llm-providers.ts`에서 해당 프로바이더가 `enabled: true`로 설정되었는지 확인
3. 프로바이더 패키지가 설치되었는지 확인:
   ```bash
   bun install
   ```

### 7.2 예산 초과 오류

**오류 메시지:**
```
Error: Budget exceeded: Cannot afford estimated cost $0.015000
```

**해결 방법:**
1. 예산 증액:
   ```bash
   # .env 파일 수정
   LLM_BUDGET_DAILY=20.00
   ```
2. 또는 코드에서 업데이트:
   ```typescript
   economist.updateBudget(20.0);
   ```
3. 비용 내역 초기화 (새 세션):
   ```typescript
   economist.clearCostHistory();
   ```

### 7.3 모델 선택 문제

**증상:** 항상 같은 모델이 선택됨

**해결 방법:**
1. 복잡도 점수 확인:
   ```typescript
   const complexity = economist.analyzeComplexity(task);
   console.log('Complexity:', complexity);
   ```
2. 작업 설명이 너무 간단한 경우 복잡도 점수가 낮게 나올 수 있습니다.
3. 메타데이터로 복잡도 힌트 제공:
   ```typescript
   const task = {
     // ...
     metadata: {
       metadata: {
         complexity: 80,  // 명시적으로 복잡도 설정
         steps: ['design', 'implement', 'test'],
       },
     },
   };
   ```

### 7.4 스트리밍 지연 문제

**증상:** 스트리밍 응답이 느림

**해결 방법:**
1. 더 빠른 모델 사용:
   ```typescript
   const economist = new Economist({
     defaultModel: 'google:gemini-1.5-flash',  // 가장 빠른 모델
   });
   ```
2. Groq 사용 (초고속 추론):
   ```typescript
   // llm-providers.ts에서 groq 활성화
   const economist = new Economist({
     defaultModel: 'groq:llama-3.3-70b-versatile',
   });
   ```

### 7.5 토큰 한도 초과

**증상:** Rate limit 오류 발생

**해결 방법:**
1. 다른 프로바이더로 전환:
   ```typescript
   const economist = new Economist({
     defaultModel: 'openai:gpt-3.5-turbo',  // Anthropic → OpenAI
   });
   ```
2. 요청 분산: 여러 프로바이더를 활성화하여 자동 분산
3. API 사용량 제한 확인 및 증액 (해당 프로바이더 콘솔에서)

### 7.6 잘못된 응답 품질

**증상:** 모델이 작업을 제대로 이해하지 못함

**해결 방법:**
1. 프롬프트 개선: 더 구체적이고 명확한 지시사항 작성
2. 더 강력한 모델 사용:
   ```typescript
   const economist = new Economist({
     defaultModel: 'anthropic:claude-3-5-sonnet-20241022',
   });
   ```
3. 작업 설명 개선: 복잡도 분석이 더 정확하도록 상세한 설명 작성

### 7.7 커뮤니티 프로바이더 연결 실패

**증상:** z.ai 또는 Moonshot 연결 실패

**해결 방법:**
1. `.env` 파일에서 API 키 확인
2. `llm-providers.ts`에서 `enabled: true`로 설정
3. OpenAI 호환 API이므로 베이스 URL이 필요할 수 있습니다 (프로바이더 문서 참조)

---

## 8. 모범 사례

### 8.1 비용 최적화

1. **적절한 모델 선택**: 작업 복잡도에 맞는 모델 사용
2. **프롬프트 효율화**: 불필요한 컨텍스트 제거
3. **배치 처리**: 여러 작업을 하나의 요청으로 처리
4. **예산 모니터링**: 정기적으로 비용 통계 확인

### 8.2 성능 최적화

1. **스트리밍 사용**: 긴 응답은 스트리밍으로 실시간 표시
2. **캐싱**: 반복되는 응답은 캐시 활용
3. **Groq 활용**: 고속 추론이 필요한 작업에 사용

### 8.2 신뢰성 향상

1. **다중 프로바이더**: 하나 이상의 프로바이더 활성화
2. **예산 알림**: 예산 초과를 방지하기 위한 알림 설정
3. **오류 처리**: 적절한 try-catch 및 재시도 로직 구현

---

## 9. 추가 리소스

- [Vercel AI SDK 문서](https://sdk.vercel.ai/docs)
- [Anthropic Claude API 문서](https://docs.anthropic.com/)
- [OpenAI API 문서](https://platform.openai.com/docs)
- [Google AI API 문서](https://ai.google.dev/docs)
- [Groq API 문서](https://console.groq.com/docs)

---

## 10. 변경 로그

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2026-02-01 | 초기 문서 생성 |
