/**
 * LLM Provider Plugin Types
 * 
 * 플러그인 아키텍처 기반 LLM Provider 인터페이스 정의
 * Vercel AI SDK의 LanguageModelV1을 기반으로 함
 */

/**
 * LLM Provider 플러그인 인터페이스
 * 
 * 모든 LLM Provider 플러그인은 이 인터페이스를 구현해야 함
 */
export interface LLMProviderPlugin {
  /** Provider 표시 이름 */
  readonly name: string;
  
  /** Provider 고유 ID */
  readonly id: string;
  
  /**
   * Provider 인스턴스 생성
   * @param config Provider 설정
   * @returns LanguageModelV1 인스턴스 (실제 타입은 ai 패키지에서 import)
   */
  createProvider(config: ProviderConfig): unknown;
  
  /**
   * 사용 가능 여부 확인
   * API 키 존재 여부 등을 확인
   * @returns 사용 가능 여부
   */
  isAvailable(): boolean;
  
  /**
   * 제공하는 모델 목록 반환
   * @returns ModelInfo 배열
   */
  getModels(): ModelInfo[];
  
  /**
   * 비용 계산
   * @param modelId 모델 ID
   * @param inputTokens 입력 토큰 수
   * @param outputTokens 출력 토큰 수
   * @returns 총 비용 (USD)
   */
  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number;
}

/**
 * 모델 정보 인터페이스
 */
export interface ModelInfo {
  /** 모델 ID */
  id: string;
  
  /** 모델 표시 이름 */
  name: string;
  
  /** 모델 설명 */
  description: string;
  
  /** 최대 토큰 수 */
  maxTokens: number;
  
  /** 1K 입력 토큰당 비용 (USD) */
  inputCostPer1K: number;
  
  /** 1K 출력 토큰당 비용 (USD) */
  outputCostPer1K: number;
  
  /** 복잡도 범위 (0-100) */
  complexityRange: { min: number; max: number };
  
  /** 지원 기능 */
  capabilities: ('text' | 'vision' | 'tools' | 'streaming')[];
  
  /** 입력 컨텍스트 창 크기 (토큰 단위, maxTokens와 별도) */
  contextWindow?: number;
  
  /** 모델 모달리티 타입 */
  modality?: 'text' | 'multimodal' | 'vision' | 'audio';
  
  /** 추론 능력 지원 여부 (o1, o3 등의 reasoning 모델) */
  supportsReasoning?: boolean | 'basic' | 'extended';
  
  /** 모델 출시일 (YYYY-MM-DD 형식) */
  releaseDate?: string;
}

/**
 * Provider 설정 인터페이스
 */
export interface ProviderConfig {
  /** API 키 */
  apiKey?: string;
  
  /** 기본 URL (선택적, OpenAI 호환 API용) */
  baseURL?: string;
  
  /** 추가 헤더 (선택적) */
  headers?: Record<string, string>;
  
  /** 타임아웃 (ms) */
  timeout?: number;
}

/**
 * 모델 라우팅 결과 인터페이스
 */
export interface ModelRoutingResult {
  /** 선택된 모델 ID */
  model: string;
  
  /** Provider ID */
  provider: string;
  
  /** 예상 비용 */
  estimatedCost: number;
  
  /** 모델 정보 */
  modelInfo: ModelInfo;
}

/**
 * Provider 설정 항목 인터페이스
 */
export interface ProviderConfigEntry {
  /** Provider ID */
  id: string;
  
  /** 활성화 여부 */
  enabled: boolean;
  
  /** 패키지 이름 */
  package: string;
  
  /** 환경변수 키 (기본값: {ID}_API_KEY) */
  envKey?: string;
  
  /** 기본 URL (OpenAI 호환 API용) */
  baseURL?: string;
}

/**
 * LLM Provider 전체 설정 인터페이스
 */
export interface LLMProviderConfig {
  /** Provider 목록 */
  providers: ProviderConfigEntry[];
  
  /** 기본 모델 (provider:model 형식) */
  defaultModel?: string | null;
  
  /** 일일 예산 (USD) */
  dailyBudget?: number;
  
  /** 예산 알림 임계값 (0.0-1.0) */
  budgetAlertThreshold?: number;
}

/**
 * 복잡도 점수 인터페이스
 */
export interface ComplexityScore {
  /** 어휘적 복잡도 */
  lexical: number;
  
  /** 의미적 복잡도 */
  semantic: number;
  
  /** 범위 복잡도 */
  scope: number;
  
  /** 총 복잡도 (0-100) */
  total: number;
}

/**
 * Provider 로딩 오류 인터페이스
 */
export interface ProviderLoadingError {
  /** Provider ID */
  providerId: string;
  
  /** 오류 메시지 */
  message: string;
  
  /** 원본 오류 */
  error?: Error | undefined;
}

/**
 * Provider 레지스트리 상태 인터페이스
 */
export interface ProviderRegistryState {
  /** 로드된 Provider 목록 */
  loadedProviders: string[];
  
  /** 사용 가능한 Provider 목록 */
  availableProviders: string[];
  
  /** 로딩 실패한 Provider 목록 */
  failedProviders: ProviderLoadingError[];
  
  /** 전체 모델 목록 */
  allModels: Array<ModelInfo & { providerId: string }>;
}
