import { generateText, streamText, experimental_createProviderRegistry, type LanguageModelUsage } from 'ai';
import type { Task } from '@amicus/types/core';

export interface EconomistOptions {
  defaultModel?: string;
  budget?: number;
  onBudgetAlert?: (spent: number, budget: number) => void;
  budgetAlertThreshold?: number;
}

export interface ModelRoutingResult {
  model: string;
  provider: string;
  estimatedCost: number;
  complexity: ComplexityScore;
}

export interface ComplexityScore {
  lexical: number;
  semantic: number;
  scope: number;
  total: number;
}

export interface CostStats {
  spent: number;
  budget: number;
  requests: number;
  averageCost: number;
  remaining: number;
}

export interface StreamingResult {
  textStream: AsyncIterable<string>;
  fullTextPromise: Promise<string>;
  usage: Promise<LanguageModelUsage>;
}

interface ModelConfig {
  id: string;
  provider: string;
  modelId: string;
  inputCostPer1K: number;
  outputCostPer1K: number;
  complexityRange: { min: number; max: number };
  description: string;
}

interface CostEntry {
  timestamp: number;
  model: string;
  estimatedCost: number;
  complexity: ComplexityScore;
}

export class Economist {
  private options: Required<EconomistOptions>;
  private providerRegistry: ReturnType<typeof experimental_createProviderRegistry> | undefined;
  private costHistory: CostEntry[] = [];
  private budgetAlertTriggered = false;

  private readonly models: ModelConfig[] = [
    {
      id: 'anthropic:claude-3-haiku-20240307',
      provider: 'anthropic',
      modelId: 'claude-3-haiku-20240307',
      inputCostPer1K: 0.00025,
      outputCostPer1K: 0.00125,
      complexityRange: { min: 0, max: 30 },
      description: 'Fast and efficient for simple tasks',
    },
    {
      id: 'openai:gpt-3.5-turbo',
      provider: 'openai',
      modelId: 'gpt-3.5-turbo',
      inputCostPer1K: 0.0005,
      outputCostPer1K: 0.0015,
      complexityRange: { min: 30, max: 70 },
      description: 'Balanced performance and cost',
    },
    {
      id: 'anthropic:claude-3-sonnet-20240229',
      provider: 'anthropic',
      modelId: 'claude-3-sonnet-20240229',
      inputCostPer1K: 0.003,
      outputCostPer1K: 0.015,
      complexityRange: { min: 30, max: 70 },
      description: 'Strong performance for medium complexity',
    },
    {
      id: 'anthropic:claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
      inputCostPer1K: 0.003,
      outputCostPer1K: 0.015,
      complexityRange: { min: 70, max: 100 },
      description: 'Best for complex reasoning tasks',
    },
    {
      id: 'openai:gpt-4',
      provider: 'openai',
      modelId: 'gpt-4',
      inputCostPer1K: 0.03,
      outputCostPer1K: 0.06,
      complexityRange: { min: 70, max: 100 },
      description: 'Most capable for complex tasks',
    },
    {
      id: 'openai:gpt-4-turbo',
      provider: 'openai',
      modelId: 'gpt-4-turbo',
      inputCostPer1K: 0.01,
      outputCostPer1K: 0.03,
      complexityRange: { min: 70, max: 100 },
      description: 'Latest GPT-4 with improved capabilities',
    },
  ];

  private readonly complexKeywords = [
    'architect', 'design', 'optimize', 'refactor', 'complex',
    'analyze', 'synthesize', 'evaluate', 'research', 'implement',
    'create', 'build', 'system', 'framework', 'algorithm', 'integration',
  ];

  private readonly simpleKeywords = [
    'fix', 'update', 'simple', 'quick', 'minor', 'tweak',
    'adjust', 'change', 'edit', 'modify', 'format', 'style',
    'typo', 'comment', 'rename',
  ];

  constructor(options: EconomistOptions = {}) {
    this.options = {
      defaultModel: options.defaultModel ?? 'openai:gpt-3.5-turbo',
      budget: options.budget ?? Infinity,
      onBudgetAlert: options.onBudgetAlert ?? (() => {}),
      budgetAlertThreshold: options.budgetAlertThreshold ?? 0.8,
    };

    this.initializeProviderRegistry();
  }

  private async initializeProviderRegistry(): Promise<void> {
    const providers: Record<string, unknown> = {};

    try {
      const anthropic = await import('@ai-sdk/anthropic');
      providers.anthropic = anthropic.anthropic;
    } catch {}

    try {
      const openai = await import('@ai-sdk/openai');
      providers.openai = openai.openai;
    } catch {}

    if (Object.keys(providers).length > 0) {
      this.providerRegistry = experimental_createProviderRegistry(providers as Parameters<typeof experimental_createProviderRegistry>[0]);
    }
  }

  analyzeComplexity(task: Task): ComplexityScore {
    const description = task.description.toLowerCase();
    const lexical = this.calculateLexicalScore(description);
    const semantic = this.calculateSemanticScore(description);
    const scope = this.calculateScopeScore(task);
    const total = Math.round((lexical * 0.3 + semantic * 0.4 + scope * 0.3));

    return { lexical, semantic, scope, total };
  }

  private calculateLexicalScore(description: string): number {
    let score = Math.min(100, description.length / 10);
    const words = description.split(/\s+/);
    const complexWords = words.filter((w) => w.length > 6).length;
    const complexityRatio = words.length > 0 ? complexWords / words.length : 0;
    score += complexityRatio * 30;

    const technicalTerms = [
      'api', 'database', 'algorithm', 'architecture', 'implementation',
      'configuration', 'infrastructure', 'microservice', 'middleware', 'dependency',
    ];
    const termCount = technicalTerms.filter((term) =>
      description.includes(term)
    ).length;
    score += termCount * 2;

    return Math.min(100, Math.round(score));
  }

  private calculateSemanticScore(description: string): number {
    let score = 50;

    this.complexKeywords.forEach((keyword) => {
      if (description.includes(keyword)) score += 8;
    });

    this.simpleKeywords.forEach((keyword) => {
      if (description.includes(keyword)) score -= 8;
    });

    if (/\d+\s*\.\s+|steps?|phases?|stages?/i.test(description)) {
      score += 10;
    }

    if (/compare|vs|versus|choose|decide|select/i.test(description)) {
      score += 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateScopeScore(task: Task): number {
    let score = 30;

    if (task.metadata?.parentId) score += 10;

    if (task.metadata?.relatedIds && task.metadata.relatedIds.length > 0) {
      score += task.metadata.relatedIds.length * 5;
    }

    switch (task.priority) {
      case 'high':
      case 'urgent':
        score += 15;
        break;
      case 'low':
        score -= 10;
        break;
    }

    const metadata = task.metadata?.metadata;
    if (metadata) {
      if (typeof metadata.complexity === 'number') {
        score = metadata.complexity as number;
      }

      if (Array.isArray(metadata.dependencies) && metadata.dependencies.length > 0) {
        score += metadata.dependencies.length * 5;
      }

      if (Array.isArray(metadata.steps) && metadata.steps.length > 0) {
        score += metadata.steps.length * 10;
      }
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  route(task: Task): ModelRoutingResult {
    const complexity = this.analyzeComplexity(task);
    const model = this.selectModel(complexity.total);
    const estimatedCost = this.estimateCost(model, task.description.length);

    return {
      model: model.id,
      provider: model.provider,
      estimatedCost,
      complexity,
    };
  }

  private selectModel(complexityScore: number): ModelConfig {
    const suitableModels = this.models.filter(
      (m) => complexityScore >= m.complexityRange.min && complexityScore <= m.complexityRange.max
    );

    if (suitableModels.length > 0) {
      return suitableModels.reduce((best, current) => {
        const bestTotalCost = best.inputCostPer1K + best.outputCostPer1K;
        const currentTotalCost = current.inputCostPer1K + current.outputCostPer1K;
        return currentTotalCost < bestTotalCost ? current : best;
      });
    }

    const defaultModel = this.models.find((m) => m.id === this.options.defaultModel);
    return defaultModel ?? this.models[0]!;
  }

  private estimateCost(
    model: ModelConfig,
    inputLength: number,
    estimatedOutputLength?: number
  ): number {
    const inputTokens = Math.ceil(inputLength / 4);
    const outputTokens = Math.ceil((estimatedOutputLength ?? inputLength * 0.5) / 4);
    const inputCost = (inputTokens / 1000) * model.inputCostPer1K;
    const outputCost = (outputTokens / 1000) * model.outputCostPer1K;

    return Math.round((inputCost + outputCost) * 1000000) / 1000000;
  }

  async generateText(task: Task, prompt: string): Promise<string> {
    if (!this.providerRegistry) {
      await this.initializeProviderRegistry();
    }

    if (!this.providerRegistry) {
      throw new Error('No AI providers available. Please install @ai-sdk/anthropic or @ai-sdk/openai');
    }

    const routing = this.route(task);

    if (!this.checkBudget(routing.estimatedCost)) {
      throw new Error(
        `Budget exceeded: Cannot afford estimated cost $${routing.estimatedCost.toFixed(6)}`
      );
    }

    try {
      const model = this.providerRegistry.languageModel(routing.model);
      const result = await generateText({ model, prompt });
      this.trackCost(routing, prompt.length, result.text.length);
      return result.text;
    } catch (error) {
      this.trackCost(routing, prompt.length, 0, true);
      throw error;
    }
  }

  async generateTextStream(task: Task, prompt: string): Promise<StreamingResult> {
    if (!this.providerRegistry) {
      await this.initializeProviderRegistry();
    }

    if (!this.providerRegistry) {
      throw new Error('No AI providers available. Please install @ai-sdk/anthropic or @ai-sdk/openai');
    }

    const routing = this.route(task);

    if (!this.checkBudget(routing.estimatedCost)) {
      throw new Error(
        `Budget exceeded: Cannot afford estimated cost $${routing.estimatedCost.toFixed(6)}`
      );
    }

    try {
      const model = this.providerRegistry.languageModel(routing.model);
      const result = await streamText({ model, prompt });

      // Track cost after streaming completes
      result.text.then((fullText) => {
        this.trackCost(routing, prompt.length, fullText.length);
      }).catch(() => {
        this.trackCost(routing, prompt.length, 0, true);
      });

      return {
        textStream: result.textStream,
        fullTextPromise: result.text,
        usage: result.usage,
      };
    } catch (error) {
      this.trackCost(routing, prompt.length, 0, true);
      throw error;
    }
  }

  private checkBudget(estimatedCost: number): boolean {
    if (this.options.budget === Infinity) return true;
    const currentSpent = this.getTotalSpent();
    return currentSpent + estimatedCost <= this.options.budget;
  }

  private trackCost(
    routing: ModelRoutingResult,
    inputLength: number,
    outputLength: number,
    failed = false
  ): void {
    const model = this.models.find((m) => m.id === routing.model);
    const actualCost = failed
      ? 0
      : model
        ? this.estimateCost(model, inputLength, outputLength)
        : routing.estimatedCost;

    const entry: CostEntry = {
      timestamp: Date.now(),
      model: routing.model,
      estimatedCost: actualCost,
      complexity: routing.complexity,
    };

    this.costHistory.push(entry);
    this.checkBudgetAlert();
  }

  private checkBudgetAlert(): void {
    if (this.options.budget === Infinity || this.budgetAlertTriggered) return;

    const spent = this.getTotalSpent();
    const ratio = spent / this.options.budget;

    if (ratio >= this.options.budgetAlertThreshold) {
      this.budgetAlertTriggered = true;
      this.options.onBudgetAlert(spent, this.options.budget);
    }
  }

  private getTotalSpent(): number {
    return this.costHistory.reduce((sum, entry) => sum + entry.estimatedCost, 0);
  }

  getCostStats(): CostStats {
    const spent = this.getTotalSpent();
    const requests = this.costHistory.length;

    return {
      spent,
      budget: this.options.budget,
      requests,
      averageCost: requests > 0 ? spent / requests : 0,
      remaining: this.options.budget === Infinity ? Infinity : Math.max(0, this.options.budget - spent),
    };
  }

  resetBudgetAlert(): void {
    this.budgetAlertTriggered = false;
  }

  getCostHistory(): ReadonlyArray<CostEntry> {
    return [...this.costHistory];
  }

  clearCostHistory(): void {
    this.costHistory = [];
    this.budgetAlertTriggered = false;
  }

  getAvailableModels(): ReadonlyArray<ModelConfig> {
    return [...this.models];
  }

  updateBudget(newBudget: number): void {
    this.options.budget = newBudget;
    this.budgetAlertTriggered = false;
  }
}
