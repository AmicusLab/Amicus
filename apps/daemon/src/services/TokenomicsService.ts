import { Economist } from '@amicus/core';
import type { Tokenomics, ModelUsageStats } from '@amicus/types/dashboard';
import type { CostStats } from '@amicus/core';
import { configManager } from './ConfigService.js';

interface CostEntry {
  timestamp: number;
  model: string;
  estimatedCost: number;
  complexity: {
    lexical: number;
    semantic: number;
    scope: number;
    total: number;
  };
}

let economistInstance: Economist | null = null;

export function getEconomist(): Economist {
  if (!economistInstance) {
    const cfg = configManager.getConfig();
    const budget = process.env.LLM_BUDGET_DAILY
      ? parseFloat(process.env.LLM_BUDGET_DAILY)
      : cfg.llm.dailyBudget;
    const threshold = process.env.LLM_BUDGET_ALERT_THRESHOLD
      ? parseFloat(process.env.LLM_BUDGET_ALERT_THRESHOLD)
      : cfg.llm.budgetAlertThreshold;

    economistInstance = new Economist({
      ...(cfg.llm.defaultModel ? { defaultModel: cfg.llm.defaultModel } : {}),
      budget: Number.isFinite(budget) ? budget : Infinity,
      budgetAlertThreshold: threshold,
      onBudgetAlert: (spent, budget) => {
        console.warn(`[Tokenomics] Budget alert: $${spent.toFixed(4)} / $${budget.toFixed(2)} (${((spent / budget) * 100).toFixed(1)}%)`);
      },
    });
  }
  return economistInstance;
}

class TokenomicsService {
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private broadcastCallback: ((tokenomics: Tokenomics) => void) | null = null;

  start(broadcastFn: (tokenomics: Tokenomics) => void): void {
    this.broadcastCallback = broadcastFn;
    this.updateInterval = setInterval(() => this.broadcastUpdate(), 5000);
    console.log('[TokenomicsService] Started with 5s update interval');
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.broadcastCallback = null;
    console.log('[TokenomicsService] Stopped');
  }

  getTokenomics(): Tokenomics {
    const economist = getEconomist();
    const costStats: CostStats = economist.getCostStats();
    const costHistory: readonly CostEntry[] = economist.getCostHistory();

    const modelMap = new Map<string, ModelUsageStats>();

    for (const entry of costHistory) {
      const [provider, modelId] = entry.model.split(':');
      const providerKey = provider || 'unknown';
      const modelKey = modelId || entry.model;

      if (!modelMap.has(entry.model)) {
        modelMap.set(entry.model, {
          model: modelKey,
          provider: providerKey as ModelUsageStats['provider'],
          tokens: { input: 0, output: 0, total: 0 },
          cost: { usd: 0, inputRate: 0, outputRate: 0 },
          callCount: 0,
          avgLatency: 0,
          errorCount: 0,
        });
      }

      const stats = modelMap.get(entry.model)!;
      stats.callCount++;
      stats.cost.usd += entry.estimatedCost;
    }

    const budgetUsedPercent = costStats.budget === Infinity
      ? undefined
      : costStats.budget > 0
        ? (costStats.spent / costStats.budget) * 100
        : 0;

    const budgetLimit = costStats.budget === Infinity ? undefined : costStats.budget;

    const result: Tokenomics = {
      byModel: Array.from(modelMap.values()),
      totalTokens: { input: 0, output: 0, total: 0 },
      totalCost: {
        usd: costStats.spent,
        inputRate: 0,
        outputRate: 0,
      },
      periodStart: Date.now() - 3600000,
      periodEnd: Date.now(),
    };

    if (budgetLimit !== undefined) {
      result.budgetLimit = budgetLimit;
    }
    if (budgetUsedPercent !== undefined) {
      result.budgetUsedPercent = budgetUsedPercent;
    }

    return result;
  }

  private broadcastUpdate(): void {
    if (!this.broadcastCallback) return;

    try {
      const tokenomics = this.getTokenomics();
      this.broadcastCallback(tokenomics);
    } catch (error) {
      console.error('[TokenomicsService] Failed to broadcast update:', error);
    }
  }

  getCostStats(): CostStats {
    return getEconomist().getCostStats();
  }

  getEconomistInstance(): Economist {
    return getEconomist();
  }

  resetCosts(): void {
    getEconomist().clearCostHistory();
    console.log('[TokenomicsService] Cost history cleared');
  }
}

export const tokenomicsService = new TokenomicsService();
