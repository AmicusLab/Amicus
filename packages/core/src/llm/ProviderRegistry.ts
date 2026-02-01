import type {
  LLMProviderPlugin,
  LLMProviderConfig,
  ProviderConfigEntry,
  ModelInfo,
  ModelRoutingResult,
  ProviderRegistryState,
  ProviderLoadingError,
  ProviderConfig,
} from './plugins/types.js';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ZhipuPlugin } from './plugins/zhipu.js';
import { MoonshotPlugin } from './plugins/moonshot.js';

/**
 * Provider 레지스트리
 *
 * LLM Provider 플러그인을 동적으로 로드하고 관리하는 중앙 레지스트리.
 * 설정 파일 기반 자동 로딩, 모델 선택, 생명주기 관리 기능 제공.
 */
export class ProviderRegistry {
  private plugins = new Map<string, LLMProviderPlugin>();
  private loadingErrors: ProviderLoadingError[] = [];

  /**
   * 설정 파일에서 Provider 자동 로드
   * @param config LLMProviderConfig 설정 객체
   */
  async loadFromConfig(config: LLMProviderConfig): Promise<void> {
    this.loadingErrors = [];

    for (const provider of config.providers) {
      if (provider.enabled) {
        await this.loadPlugin(provider.id, provider.package, provider.envKey);
      }
    }
  }

  /**
   * 개별 플러그인 로드
   * @param id Provider ID
   * @param packageName NPM 패키지 이름
   * @param envKey 환경변수 키 (선택적)
   */
  async loadPlugin(
    id: string,
    packageName: string,
    envKey?: string
  ): Promise<void> {
    try {
      const module = await import(packageName);
      const plugin = this.createPlugin(id, packageName, module, envKey);

      if (plugin.isAvailable()) {
        this.plugins.set(id, plugin);
        console.log(`Loaded LLM provider: ${id}`);
      } else {
        const error: ProviderLoadingError = {
          providerId: id,
          message: `Provider ${id} not available (missing API key?)`,
        };
        this.loadingErrors.push(error);
        console.warn(`Provider ${id} not available (missing API key?)`);
      }
    } catch (error) {
      const loadingError: ProviderLoadingError = {
        providerId: id,
        message: `Failed to load provider ${id}: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : undefined,
      };
      this.loadingErrors.push(loadingError);
      console.error(`Failed to load provider ${id}:`, error);
    }
  }

  /**
   * 모듈에서 플러그인 인스턴스 생성
   * @param id Provider ID
   * @param packageName 패키지 이름
   * @param module 임포트된 모듈
   * @param envKey 환경변수 키
   * @returns LLMProviderPlugin 인스턴스
   */
  private createPlugin(
    id: string,
    packageName: string,
    module: Record<string, unknown>,
    envKey?: string
  ): LLMProviderPlugin {
    const apiKeyEnv = envKey ?? `${id.toUpperCase()}_API_KEY`;

    switch (id) {
      case 'anthropic':
        return new AnthropicPlugin(module, apiKeyEnv);
      case 'openai':
        return new OpenAIPlugin(module, apiKeyEnv);
      case 'google':
        return new GooglePlugin(module, apiKeyEnv);
      case 'groq':
        return new GroqPlugin(module, apiKeyEnv);
      case 'zhipu':
        return new ZhipuPlugin(module, apiKeyEnv);
      case 'moonshot':
        return new MoonshotPlugin(module, apiKeyEnv);
      default:
        throw new Error(`Unknown provider: ${id}`);
    }
  }

  /**
   * 플러그인 언로드
   * @param id Provider ID
   */
  unloadPlugin(id: string): void {
    if (this.plugins.has(id)) {
      this.plugins.delete(id);
      console.log(`Unloaded LLM provider: ${id}`);
    }
  }

  /**
   * 모든 플러그인 언로드
   */
  unloadAll(): void {
    const ids = Array.from(this.plugins.keys());
    for (const id of ids) {
      this.unloadPlugin(id);
    }
  }

  /**
   * 복잡도와 선호도를 기반으로 모델 선택
   * @param complexity 복잡도 점수 (0-100)
   * @param preferredProvider 선호 Provider ID (선택적)
   * @returns ModelRoutingResult
   */
  selectModel(
    complexity: number,
    preferredProvider?: string
  ): ModelRoutingResult {
    const allModels = this.getAllModels();

    if (allModels.length === 0) {
      throw new Error('No providers loaded');
    }

    // 선호 Provider가 있는 경우 해당 Provider의 모델만 필터링
    let candidateModels = preferredProvider
      ? allModels.filter((m) => m.providerId === preferredProvider)
      : allModels;

    if (candidateModels.length === 0 && preferredProvider) {
      console.warn(
        `Preferred provider ${preferredProvider} not available, falling back to all providers`
      );
      candidateModels = allModels;
    }

    // 복잡도 범위에 맞는 모델 필터링
    const suitableModels = candidateModels.filter(
      (m) => complexity >= m.complexityRange.min && complexity <= m.complexityRange.max
    );

    let selectedModel: (ModelInfo & { providerId: string }) | undefined;

    if (suitableModels.length > 0) {
      // 비용 기반으로 최적 모델 선택
      selectedModel = suitableModels.reduce((best, current) => {
        const bestTotalCost = best.inputCostPer1K + best.outputCostPer1K;
        const currentTotalCost = current.inputCostPer1K + current.outputCostPer1K;
        return currentTotalCost < bestTotalCost ? current : best;
      });
    } else {
      // 복잡도 범위에 맞는 모델이 없으면 가장 가까운 복잡도 범위의 모델 선택
      selectedModel = candidateModels.reduce((closest, current) => {
        const closestMid =
          (closest.complexityRange.min + closest.complexityRange.max) / 2;
        const currentMid =
          (current.complexityRange.min + current.complexityRange.max) / 2;
        return Math.abs(currentMid - complexity) < Math.abs(closestMid - complexity)
          ? current
          : closest;
      });
    }

    const estimatedCost =
      (selectedModel.inputCostPer1K + selectedModel.outputCostPer1K) / 1000;

    return {
      model: `${selectedModel.providerId}:${selectedModel.id}`,
      provider: selectedModel.providerId,
      estimatedCost,
      modelInfo: selectedModel,
    };
  }

  /**
   * Provider ID로 플러그인 조회
   * @param id Provider ID
   * @returns LLMProviderPlugin 또는 undefined
   */
  getPlugin(id: string): LLMProviderPlugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * 로드된 모든 Provider 목록 반환
   * @returns Provider ID 배열
   */
  getLoadedProviders(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * 사용 가능한 모든 모델 목록 반환
   * @returns ModelInfo 배열 (providerId 포함)
   */
  getAllModels(): Array<ModelInfo & { providerId: string }> {
    const models: Array<ModelInfo & { providerId: string }> = [];

    for (const [providerId, plugin] of this.plugins) {
      for (const model of plugin.getModels()) {
        models.push({ ...model, providerId });
      }
    }

    return models;
  }

  /**
   * 특정 Provider의 모델 목록 반환
   * @param providerId Provider ID
   * @returns ModelInfo 배열
   */
  getModelsByProvider(providerId: string): ModelInfo[] {
    const plugin = this.plugins.get(providerId);
    return plugin ? plugin.getModels() : [];
  }

  /**
   * 레지스트리 상태 조회
   * @returns ProviderRegistryState
   */
  getState(): ProviderRegistryState {
    const loadedProviders = this.getLoadedProviders();
    const availableProviders = loadedProviders.filter((id) =>
      this.plugins.get(id)?.isAvailable()
    );

    return {
      loadedProviders,
      availableProviders,
      failedProviders: [...this.loadingErrors],
      allModels: this.getAllModels(),
    };
  }

  /**
   * Provider 로딩 오류 목록 반환
   * @returns ProviderLoadingError 배열
   */
  getLoadingErrors(): ProviderLoadingError[] {
    return [...this.loadingErrors];
  }

  /**
   * 모델 ID에서 Provider와 모델명 파싱
   * @param modelId 전체 모델 ID (provider:model 형식)
   * @returns { provider: string; model: string }
   */
  parseModelId(modelId: string): { provider: string; model: string } {
    const parts = modelId.split(':');
    if (parts.length !== 2) {
      throw new Error(`Invalid model ID format: ${modelId}. Expected "provider:model"`);
    }
    return { provider: parts[0]!, model: parts[1]! };
  }
}

// Provider 플러그인 구현체들 (임시 - Task 2에서 실제 구현)

class AnthropicPlugin implements LLMProviderPlugin {
  readonly name = 'Anthropic';
  readonly id = 'anthropic';

  constructor(
    private module: Record<string, unknown>,
    private apiKeyEnv: string
  ) {}

  createProvider(config?: ProviderConfig): unknown {
    const apiKey = config?.apiKey ?? process.env[this.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`${this.apiKeyEnv} not set`);
    }
    const provider = createAnthropic({ apiKey });
    return provider('claude-3-5-sonnet-20241022');
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Best for complex reasoning tasks',
        maxTokens: 8192,
        inputCostPer1K: 0.003,
        outputCostPer1K: 0.015,
        complexityRange: { min: 70, max: 100 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fast and efficient',
        maxTokens: 4096,
        inputCostPer1K: 0.00025,
        outputCostPer1K: 0.00125,
        complexityRange: { min: 0, max: 70 },
        capabilities: ['text', 'vision', 'streaming'],
      },
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

class OpenAIPlugin implements LLMProviderPlugin {
  readonly name = 'OpenAI';
  readonly id = 'openai';

  constructor(
    private module: Record<string, unknown>,
    private apiKeyEnv: string
  ) {}

  createProvider(config?: ProviderConfig): unknown {
    const apiKey = config?.apiKey ?? process.env[this.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`${this.apiKeyEnv} not set`);
    }
    const provider = createOpenAI({ apiKey });
    return provider('gpt-4-turbo');
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Latest GPT-4 with improved capabilities',
        maxTokens: 4096,
        inputCostPer1K: 0.01,
        outputCostPer1K: 0.03,
        complexityRange: { min: 70, max: 100 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Balanced performance and cost',
        maxTokens: 4096,
        inputCostPer1K: 0.0005,
        outputCostPer1K: 0.0015,
        complexityRange: { min: 30, max: 70 },
        capabilities: ['text', 'tools', 'streaming'],
      },
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

class GooglePlugin implements LLMProviderPlugin {
  readonly name = 'Google';
  readonly id = 'google';

  constructor(
    private module: Record<string, unknown>,
    private apiKeyEnv: string
  ) {}

  createProvider(config?: ProviderConfig): unknown {
    const apiKey = config?.apiKey ?? process.env[this.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`${this.apiKeyEnv} not set`);
    }
    const provider = createGoogleGenerativeAI({ apiKey });
    return provider('gemini-1.5-pro');
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'High performance',
        maxTokens: 8192,
        inputCostPer1K: 0.0035,
        outputCostPer1K: 0.0105,
        complexityRange: { min: 70, max: 100 },
        capabilities: ['text', 'vision', 'tools', 'streaming'],
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Ultra-low cost for simple tasks',
        maxTokens: 8192,
        inputCostPer1K: 0.000075,
        outputCostPer1K: 0.0003,
        complexityRange: { min: 0, max: 30 },
        capabilities: ['text', 'vision', 'streaming'],
      },
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

class GroqPlugin implements LLMProviderPlugin {
  readonly name = 'Groq';
  readonly id = 'groq';

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
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey,
    });
    return provider('llama-3.3-70b-versatile');
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        description: 'High-speed inference',
        maxTokens: 8192,
        inputCostPer1K: 0.00059,
        outputCostPer1K: 0.00079,
        complexityRange: { min: 30, max: 100 },
        capabilities: ['text', 'tools', 'streaming'],
      },
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


