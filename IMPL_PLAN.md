# [Phase 2] 민감 정보 자동 마스킹 - 구현 계획서

## 📋 메타 정보

- **이슈 번호**: #38
- **이슈 제목**: [Phase 2] 민감 정보 자동 마스킹
- **라벨**: enhancement, high-priority, phase-2
- **작성일**: 2026-03-30
- **버전**: v2 (4개 전문가 피드백 반영)
- **우선순위**: 높음 (High)

---

## 🎯 TASK (작업 정의)

LLM 응답, 대시보드 표시, 로그 저장 시 API 키, 비밀번호, 토큰 등의 민감 정보를 자동으로 감지하고 마스킹하는 보안 시스템을 구축합니다.

### 작업 항목

1. **민감 정보 감지 정규식 패턴 정의**
   - API 키 패턴 (OpenAI, Anthropic, AWS 등)
   - 토큰 패턴 (Bearer, JWT, OAuth 등)
   - 비밀번호/시크릿 패턴
   - 개인정보 패턴 (이메일, 전화번호 등 - 선택적)

2. **LLM 응답 후처리 마스킹 로직**
   - ChatEngine 결과 마스킹
   - 스트리밍 응답 실시간 마스킹
   - 도구 실행 결과 마스킹

3. **대시보드 표시용 마스킹 컴포넌트**
   - 마스킹 표시 UI 컴포넌트
   - 권한 있는 사용자용 마스킹 해제 기능

4. **로그 필터링 시스템**
   - ToolExecutionLogger 마스킹 강화
   - AuditLogService 마스킹 적용
   - 콘솔 로그 마스킹

5. **마스킹 해제 권한 관리**
   - 관리자 권한 확인
   - 감사 로그 기록

---

## 🎯 GOAL (목표)

### 주요 목표

1. **민감 정보 유출 방지**: LLM이 생성하거나 참조하는 민감 정보가 실수로 노출되는 것을 방지
2. **보안 규정 준수**: OWASP, GDPR 등 보안 표준 준수
3. **로그 안전 보관**: 로그 파일에 민감 정보가 평문으로 저장되지 않도록 보장
4. **사용자 신뢰도 향상**: 보안 기능을 통한 사용자 신뢰 확보

### 비기능적 목표

- **성능**: 마스킹 처리로 인한 응답 지연 < 10ms
- **정확성**: 오탐지율(False Positive) < 5%
- **확장성**: 새로운 민감 정보 패턴을 쉽게 추가 가능
- **투명성**: 마스킹된 항목을 사용자가 인지 가능

---

## 🔍 SCOPE (범위)

### 포함 범위 (In Scope)

#### 1. `packages/core/src` - 코어 마스킹 로직

| 파일 | 변경 사항 | 설명 |
|------|----------|------|
| `utils/sensitive-mask.ts` | **신규 생성** | 민감 정보 감지 및 마스킹 유틸리티 |
| `chat/ChatEngine.ts` | 수정 | 응답 마스킹 처리 추가 |
| `tools/ToolExecutionLogger.ts` | 수정 | 기존 sanitize 로직 강화 |
| `config/secret-store.ts` | 수정 | getCredential 반환값 마스킹 옵션 추가 |

#### 2. `apps/daemon/src` - 백엔드 로깅

| 파일 | 변경 사항 | 설명 |
|------|----------|------|
| `services/AuditLogService.ts` | 수정 | 감사 로그 마스킹 적용 |
| `routes/chat.ts` | 수정 | 스트리밍 응답 마스킹 |
| `middleware/auth.ts` | 수정 | 인증 정보 로깅 시 마스킹 |

#### 3. `apps/dashboard/src` - 프론트엔드 표시

| 파일 | 변경 사항 | 설명 |
|------|----------|------|
| `utils/sensitive-mask.ts` | **신규 생성** | 프론트엔드 마스킹 유틸리티 |
| `components/ChatPanel.ts` | 수정 | 메시지 표시 시 마스킹 |
| `components/MaskedValue.ts` | **신규 생성** | 마스킹 표시 컴포넌트 |

#### 4. `packages/types/src` - 타입 정의

| 파일 | 변경 사항 | 설명 |
|------|----------|------|
| `security.ts` | **신규 생성** | 마스킹 관련 타입 정의 |
| `index.ts` | 수정 | security 타입 export 추가 |

### 제외 범위 (Out of Scope)

- 데이터베이스 암호화 (별도 이슈)
- 네트워크 전송 암호화 (TLS)
- 파일 시스템 암호화
- 외부 API 호출 시 마스킹 (API 제공자 책임)

---

## ✅ ACCEPTANCE_CRITERIA (완료 조건)

### 기능적 완료 조건

#### AC-1: 민감 정보 감지

```
GIVEN: LLM 응답에 API 키가 포함되어 있음
WHEN: 응답이 마스킹 처리됨
THEN: API 키가 "sk-***REDACTED***" 형식으로 마스킹됨
```

**테스트 케이스**:
- ✅ OpenAI API 키 (`sk-...`) 감지
- ✅ Anthropic API 키 감지
- ✅ AWS 액세스 키 (`AKIA...`) 감지
- ✅ Bearer 토큰 감지
- ✅ JWT 토큰 감지
- ✅ 일반적인 비밀번호 필드 감지

#### AC-2: LLM 응답 마스킹

```
GIVEN: ChatEngine이 텍스트 응답을 생성함
WHEN: 응답에 민감 정보가 포함되어 있음
THEN: 모든 민감 정보가 마스킹된 상태로 반환됨
```

**검증 방법**:
- 단위 테스트: 마스킹 유틸리티 테스트
- 통합 테스트: ChatEngine 마스킹 테스트
- E2E 테스트: 전체 플로우 테스트

#### AC-3: 대시보드 마스킹 표시

```
GIVEN: 대시보드에 메시지가 표시됨
WHEN: 메시지에 민감 정보가 포함됨
THEN: 민감 정보가 "****" 또는 "[REDACTED]"로 표시됨
AND: 관리자는 hover/클릭으로 원본 확인 가능 (권한 있음)
```

#### AC-4: 로그 마스킹

```
GIVEN: 시스템이 로그를 기록함
WHEN: 로그에 민감 정보가 포함됨
THEN: 로그 파일에 민감 정보가 마스킹되어 저장됨
```

**검증 방법**:
- 로그 파일 내용 검사
- 감사 로그 검사

#### AC-5: 권한 기반 마스킹 해제

```
GIVEN: 관리자가 마스킹된 값을 확인하려 함
WHEN: 적절한 권한이 있음
THEN: 원본 값을 확인할 수 있음
AND: 확인 사항이 감사 로그에 기록됨
```

### 비기능적 완료 조건

#### AC-6: 성능

```
GIVEN: 마스킹 시스템이 활성화됨
WHEN: 1KB 텍스트를 처리함
THEN: 마스킹 처리 시간이 10ms 미만임
```

#### AC-7: 정확성

```
GIVEN: 일반 텍스트 100개 샘플
WHEN: 마스킹 처리를 수행함
THEN: 오탐지(False Positive)가 5개 미만임
```

#### AC-8: 확장성

```
GIVEN: 새로운 민감 정보 패턴이 필요함
WHEN: 설정 파일에 패턴을 추가함
THEN: 코드 수정 없이 패턴이 적용됨
```

---

## 📐 설계

### 1. 민감 정보 감지 패턴

```typescript
// packages/core/src/utils/sensitive-mask.ts

export interface SensitivePattern {
  name: string;
  pattern: RegExp;
  maskFormat: (match: string) => string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export const SENSITIVE_PATTERNS: SensitivePattern[] = [
  // OpenAI API Key
  {
    name: 'openai_api_key',
    pattern: /sk-[a-zA-Z0-9]{20,}T3BlbkFJ[a-zA-Z0-9]{20,}/g,
    maskFormat: () => 'sk-***REDACTED***',
    severity: 'critical',
  },
  // Anthropic API Key
  {
    name: 'anthropic_api_key',
    pattern: /sk-ant-api[a-zA-Z0-9-]{80,}/g,
    maskFormat: () => 'sk-ant-***REDACTED***',
    severity: 'critical',
  },
  // Generic API Key (URL params)
  {
    name: 'api_key_param',
    pattern: /([?&](?:api_key|apikey|key|token)=)[^&\s]+/gi,
    maskFormat: (match) => match.replace(/=[^&\s]+/, '=***REDACTED***'),
    severity: 'high',
  },
  // Bearer Token
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[a-zA-Z0-9._-]+/gi,
    maskFormat: () => 'Bearer ***REDACTED***',
    severity: 'critical',
  },
  // JWT Token
  {
    name: 'jwt_token',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    maskFormat: () => 'eyJ***REDACTED***',
    severity: 'critical',
  },
  // AWS Access Key
  {
    name: 'aws_access_key',
    pattern: /AKIA[A-Z0-9]{16}/g,
    maskFormat: () => 'AKIA***REDACTED***',
    severity: 'critical',
  },
  // Generic Secret Key
  {
    name: 'secret_key',
    pattern: /(?:(?:password|passwd|secret|token|api_key)\s*[=:]\s*)['""]?[^\s'""]{8,}/gi,
    maskFormat: (match) => match.replace(/['""]?[^\s'""]{8,}$/, '***REDACTED***'),
    severity: 'high',
  },
];
```

### 2. 마스킹 유틸리티 API

```typescript
// packages/core/src/utils/sensitive-mask.ts

export interface MaskOptions {
  /** 마스킹 문자 (기본값: '***REDACTED***') */
  maskChar?: string;
  /** 특정 패턴만 적용 (선택적) */
  patterns?: string[];
  /** 컨텍스트 정보 로깅 */
  logContext?: boolean;
  /** 최대 처리 길이 (성능 보호) */
  maxLength?: number;
}

export interface MaskResult {
  /** 마스킹된 텍스트 */
  masked: string;
  /** 발견된 민감 정보 목록 */
  detected: Array<{
    pattern: string;
    severity: string;
    count: number;
  }>;
  /** 처리 시간 (ms) */
  processingTime: number;
}

export function maskSensitiveInfo(text: string, options?: MaskOptions): MaskResult;
export function maskSensitiveInfoInObject(obj: unknown, options?: MaskOptions): unknown;
```

### 3. ChatEngine 통합

```typescript
// packages/core/src/chat/ChatEngine.ts 수정 사항

import { maskSensitiveInfo } from '../utils/sensitive-mask.js';

// chat() 메서드 수정
async chat(messages: Message[], config?: ChatConfig, depth = 0): Promise<ChatResult> {
  // ... 기존 로직 ...
  
  const result = await generateText(generateConfig);
  
  // ✨ 응답 마스킹 추가
  const maskedResult = config?.disableMasking 
    ? result.text 
    : maskSensitiveInfo(result.text).masked;
  
  return {
    response: {
      type: 'text',
      content: maskedResult,
    },
    // ...
  };
}
```

### 4. 대시보드 컴포넌트

```typescript
// apps/dashboard/src/components/MaskedValue.ts

@customElement('masked-value')
export class MaskedValue extends LitElement {
  @property({ type: String }) value = '';
  @property({ type: Boolean }) canReveal = false;
  @property({ type: Boolean }) revealed = false;
  
  // 렌더링: revealed ? value : '****'
  // 클릭 시: 감사 로그 기록 + 원본 표시
}
```

---

## 🔄 구현 순서

### Phase 1: 코어 마스킹 (1-2일)

1. `packages/core/src/utils/sensitive-mask.ts` 구현
2. 단위 테스트 작성
3. `packages/types/src/security.ts` 타입 정의

### Phase 2: ChatEngine 통합 (1일)

1. `ChatEngine.chat()` 마스킹 적용
2. `ChatEngine.chatStream()` 스트리밍 마스킹
3. 도구 실행 결과 마스킹

### Phase 3: 로깅 강화 (1일)

1. `ToolExecutionLogger` 마스킹 로직 강화
2. `AuditLogService` 마스킹 적용
3. 콘솔 로그 마스킹

### Phase 4: 대시보드 UI (1일)

1. `MaskedValue` 컴포넌트 구현
2. `ChatPanel` 통합
3. 권한 확인 API

### Phase 5: 권한 관리 (0.5일)

1. 관리자 권한 확인 미들웨어
2. 마스킹 해제 감사 로그

### Phase 6: 테스트 및 문서화 (1일)

1. 통합 테스트
2. E2E 테스트
3. 사용자 가이드 작성

---

## 📁 관련 파일 목록

### 신규 생성 파일

```
packages/core/src/utils/sensitive-mask.ts
packages/core/src/utils/__tests__/sensitive-mask.test.ts
packages/types/src/security.ts
apps/dashboard/src/utils/sensitive-mask.ts
apps/dashboard/src/components/MaskedValue.ts
```

### 수정 필요 파일

```
packages/core/src/chat/ChatEngine.ts
packages/core/src/tools/ToolExecutionLogger.ts
packages/core/src/config/secret-store.ts
packages/types/src/index.ts
apps/daemon/src/services/AuditLogService.ts
apps/daemon/src/routes/chat.ts
apps/daemon/src/middleware/auth.ts
apps/dashboard/src/components/ChatPanel.ts
```

### 기존 참고 파일

```
packages/core/src/utils/encryption.ts        # 암호화 유틸리티
packages/core/src/config/secret-store.ts     # 시크릿 저장소
packages/core/src/tools/ToolExecutionLogger.ts # 기존 sanitize 로직
```

---

## 🔧 엣지 케이스 처리 (기획자 피드백 반영)

### 입력 검증

| 케이스 | 처리 방안 |
|--------|----------|
| `null`/`undefined` | 빈 결과 반환 `{ masked: '', detected: [], processingTime: 0 }` |
| 빈 문자열 `""` | 빈 결과 반환 |
| `maxLength` 초과 | 경고 로그 + 앞부분만 처리 (또는 에러) |
| 유니코드/이모지 | 정규식 `u` 플래그 사용 |

### 동시성 처리

- 마스킹 유틸리티는 **stateless** → 스레드 안전
- 감사 로그 기록 시 DB 트랜잭션 사용

### 타임아웃

- 정규식 매칭 타임아웃: 기본 **5초**
- 초과 시: 원본 반환 + 경고 로그

### 이중 마스킹 방지

```typescript
// 이미 마스킹된 값 감지
const ALREADY_MASKED = /\*{3,}REDACTED\*{3,}/;
```

---

## ⚠️ 에러 시나리오 (기획자 피드백 반영)

### E-1: 정규식 처리 실패 (500)

**상황**: 정규식 엔진 오류, 메모리 부족
**대응**:
- try-catch로 감싸기
- 실패 시 원본 텍스트 반환 (마스킹 실패 로그 기록)
- 모니터링 알림 발송

### E-2: 마스킹 요청 과부하 (429)

**상황**: 대량의 텍스트 마스킹 요청
**대응**:
- Rate limiting 적용 (IP/사용자별)
- 큐잉 시스템 도입 검토

### E-3: 잘못된 옵션 (400)

**상황**: 유효하지 않은 MaskOptions
**대응**:
- 런타임 검증 (Zod 스키마)
- 명확한 에러 메시지 반환

### E-4: 권한 없음 (403)

**상황**: 마스킹 해제 권한 없음
**대응**:
- 백엔드에서 권한 검증
- "공개 권한 없음" 메시지 표시

---

## 🏗️ 아키텍처 개선 (아키텍트 피드백 반영)

### 인터페이스 추상화 (DI/전략 패턴)

```typescript
// packages/core/src/utils/sensitive-mask.ts

// 마스킹 전략 인터페이스
export interface MaskingStrategy {
  mask(text: string, options?: MaskOptions): MaskResult;
}

// 기본 구현
export class DefaultMaskingStrategy implements MaskingStrategy {
  constructor(private patterns: SensitivePattern[] = SENSITIVE_PATTERNS) {}
  mask(text: string, options?: MaskOptions): MaskResult { /* ... */ }
}

// ChatEngine에서 인터페이스 주입
class ChatEngine {
  constructor(
    private maskingStrategy: MaskingStrategy = new DefaultMaskingStrategy()
  ) {}
}
```

### 에러 처리 전략

```typescript
export interface MaskOptions {
  // 기존 옵션...
  onMaskError?: 'throw' | 'fallback' | 'log-only';
  fallbackValue?: string;
  timeout?: number; // ms
}

export function maskSensitiveInfo(text: string, options?: MaskOptions): MaskResult {
  const timeout = options?.timeout ?? 5000;
  
  try {
    // 타임아웃과 함께 마스킹 수행
    return maskWithTimeout(text, timeout);
  } catch (error) {
    if (options?.onMaskError === 'throw') throw error;
    if (options?.onMaskError === 'fallback') {
      return { masked: options.fallbackValue ?? text, detected: [], processingTime: 0 };
    }
    // log-only: 로그 기록 후 원본 반환
    console.warn('Masking failed:', error);
    return { masked: text, detected: [], processingTime: 0 };
  }
}
```

### 스트리밍 마스킹 버퍼링

```typescript
// 스트리밍용 마스킹 클래스
export class StreamingMasker {
  private buffer = '';
  private readonly bufferSize = 256; // 청크 크기
  
  processChunk(chunk: string): string | null {
    this.buffer += chunk;
    // 패턴 매칭을 위해 충분한 버퍼 확보 후 처리
    if (this.buffer.length >= this.bufferSize) {
      return this.flush();
    }
    return null;
  }
  
  flush(): string { /* 버퍼 처리 및 반환 */ }
}
```

---

## 🔒 보안 강화 (보안 전문가 피드백 반영)

### 백엔드 마스킹 강제

```typescript
// ❌ 위험: 프론트엔드에서만 마스킹
// ✅ 안전: 백엔드에서 마스킹 후 전송, 프론트엔드는 표시만 담당

// daemon/src/routes/chat.ts
router.post('/chat', async (req, res) => {
  const response = await chatEngine.chat(messages);
  // 백엔드에서 마스킹 적용
  const maskedResponse = maskSensitiveInfo(response.content);
  res.json({ content: maskedResponse.masked });
});
```

### disableMasking 제어

```typescript
// ❌ 위험: 클라이언트가 제어 가능
// config?.disableMasking

// ✅ 안전: 서버 설정으로만 제어
const DISABLE_MASKING = process.env.DISABLE_MASKING === 'true'; // 개발 환경만
```

### 권한 검증 백엔드 수행

```typescript
// ❌ 위험: 프론트엔드 권한 확인
// @property({ type: Boolean }) canReveal = false;

// ✅ 안전: API 호출로 권한 확인 후 원본 요청
async revealMaskedValue(maskedId: string): Promise<string> {
  // 백엔드에서 권한 확인
  if (!await this.hasPermission('reveal_sensitive')) {
    throw new UnauthorizedError();
  }
  await this.auditLog.record('REVEAL', maskedId);
  return await this.getOriginalValue(maskedId);
}
```

### ReDoS 방지

```typescript
// 각 정규식에 타임아웃 적용
const SAFE_REGEX_FLAGS = { timeout: 1000 }; // 1초

// 위험한 패턴 검출
function validatePatternSafety(pattern: RegExp): boolean {
  // 중첩 수준, 반복자 등 검사
  const dangerousPatterns = [
    /(\+|\*)\1+/,  // 연속 반복자
    /\(\.\*\).\*/,  // 과도한 백트래킹
  ];
  return !dangerousPatterns.some(p => p.test(pattern.source));
}
```

---

## 🎨 UI/UX 설계 (디자이너 피드백 반영)

### MaskedValue 컴포넌트 상세 설계

```typescript
@customElement('masked-value')
export class MaskedValue extends LitElement {
  @property({ type: String }) value = '';
  @property({ type: Boolean }) canReveal = false;
  @property({ type: String }) state: 'idle' | 'loading' | 'revealed' | 'error' = 'idle';
  @property({ type: String }) errorMessage = '';
  
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .masked-value {
      font-family: monospace;
      background: var(--color-surface-muted, #f5f5f5);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      color: #1a1a1a; /* WCAG 4.5:1 준수 */
    }
    .revealed-value {
      font-family: monospace;
      background: var(--color-warning-subtle, #fff3cd);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      color: #1a1a1a;
    }
    button:focus-visible {
      outline: 2px solid var(--color-focus, #005fcc);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      * { transition: none !important; }
    }
  `;
  
  private get ariaLabel(): string {
    if (this.state === 'loading') return '민감 정보 불러오는 중...';
    if (this.state === 'error') return `오류: ${this.errorMessage}`;
    if (this.state === 'revealed') return '민감 정보 숨기기';
    return this.canReveal 
      ? '민감 정보 보기 (클릭하여 공개)' 
      : '민감 정보 (공개 권한 없음)';
  }
}
```

### UI 상태 정의

| 상태 | 시각적 표현 | 사용자 피드백 |
|------|------------|--------------|
| `idle` (마스킹) | `****` 회색 배지 | "클릭하여 공개" 툴팁 |
| `loading` | 스피너 + "확인 중..." | `aria-live="polite"` 로딩 안내 |
| `revealed` | 실제 값 + 노란 배경 | "클릭하여 숨기기" 툴팁 |
| `error` | ⚠️ 아이콘 + 에러 메시지 | `role="alert"` 즉시 안내 |

### 접근성 체크리스트

- [ ] 색 대비 4.5:1 준수 (마스킹/공개 텍스트)
- [ ] 키보드 네비게이션 (Tab + Enter/Space)
- [ ] ARIA 속성 (`role`, `aria-label`, `aria-live`)
- [ ] 포커스 표시 (`:focus-visible`)
- [ ] 스크린 리더 호환 (NVDA, VoiceOver 테스트)
- [ ] `prefers-reduced-motion` 존중

### 다국어 대응

```typescript
// i18n 시스템과 통합
import { i18n } from '../i18n';

const getLabel = (key: string) => i18n.t(key, { ns: 'masked-value' });

// 기본 메시지 (한국어)
const MESSAGES = {
  'masked.placeholder': '****',
  'masked.reveal': '민감 정보 보기',
  'masked.hide': '숨기기',
  'masked.loading': '확인 중...',
  'masked.no-permission': '공개 권한 없음',
  'masked.error': '오류가 발생했습니다',
};
```

### 반응형/터치 고려 (WCAG 2.5.5 준수)

```css
/* 터치 타겟 최소 44×44px (WCAG 2.5.5) */
button, .masked-value, .revealed-value {
  min-width: 44px;
  min-height: 44px;
}

/* 모바일 반응형 */
@media (max-width: 768px) {
  .masked-value, .revealed-value {
    font-size: 0.875rem;
    padding: 0.5rem 0.75rem;
  }
}

/* 터치 디바이스 */
@media (hover: none) {
  .masked-value {
    /* 터치 탭으로만 공개 (hover 불가) */
  }
}
```

---

## 🔙 롤백 계획 (기획자 피드백 반영)

### 기능 플래그 도입

```typescript
// 환경 변수로 제어
const ENABLE_SENSITIVE_MASKING = process.env.ENABLE_SENSITIVE_MASKING !== 'false';
```

### 롤백 시나리오

| 상황 | 대응 |
|------|------|
| 오탐지율 과다 | 화이트리스트 긴급 추가 또는 기능 비활성화 |
| 성능 저하 | maxLength 축소 또는 기능 비활성화 |
| 서비스 장애 | 기능 플래그 false로 즉시 롤백 |

### 롤백 절차

1. 기능 플래그 설정 변경 (환경 변수)
2. 서비스 재시작 (필요 시)
3. 롤백 사유를 감사 로그에 기록

---

## ⚠️ 리스크 및 대응 방안

### 리스크 1: 오탐지 (False Positive)

**상황**: 일반 텍스트가 민감 정보로 오인되어 마스킹됨
**대응**:
- 화이트리스트 패턴 추가
- 컨텍스트 기반 감지 (주변 텍스트 분석)
- 사용자 피드백 수집 및 패턴 개선
- **롤백**: 기능 플래그로 즉시 비활성화

### 리스크 2: 성능 저하

**상황**: 대용량 텍스트 처리 시 지연 발생
**대응**:
- `maxLength` 옵션으로 처리 크기 제한
- 패턴 매칭 최적화
- 타임아웃 설정 (기본 5초)
- **롤백**: maxLength 축소 또는 기능 비활성화

### 리스크 3: 탐지 회피

**상황**: 공격자가 패턴을 우회하는 방식으로 민감 정보 전달
**대응**:
- 다층 방어 (여러 패턴 조합)
- 행위 기반 탐지 (비정상적인 패턴)
- 정기적인 패턴 업데이트

### 리스크 4: ReDoS 공격

**상황**: 악의적 입력으로 정규식 과부하
**대응**:
- 각 정규식 타임아웃 설정 (1초)
- 위험한 패턴 검출 및 거부
- 입력 길이 제한

---

## 📚 참고 자료

- [OWASP Sensitive Data Exposure](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_get_request)
- [GDPR Article 32 - Security of Processing](https://gdpr-info.eu/art-32-gdpr/)
- [NIST SP 800-122 - Guide to Protecting PII](https://csrc.nist.gov/publications/detail/sp/800-122/final)

---

## 📝 작업 로그

| 날짜 | 작업자 | 내용 |
|------|--------|------|
| 2026-03-30 | 서브에이전트 | 이슈 분석 및 IMPL_PLAN.md 작성 |

---

## 🎯 다음 단계

1. ✅ 이슈 분석 완료
2. ⏳ 구현 작업 시작 (별도 PR)
3. ⏳ 코드 리뷰
4. ⏳ 테스트 및 검증
5. ⏳ 병합 및 배포
