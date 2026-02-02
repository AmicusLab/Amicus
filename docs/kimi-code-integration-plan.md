# Kimi Code Integration - Development Plan

> **Date**: 2026-02-02  
> **Prerequisite**: Z.ai provider integration complete  
> **Estimated Time**: 2-3 hours

---

## 📋 Executive Summary

**Goal**: Add Kimi Code provider to Amicus with proper separation from existing Kimi provider

**Key Findings**:
1. ✅ Kimi provider already exists but has the same factory bug as z.ai (needs fix)
2. ✅ Kimi Code uses different endpoint: `https://api.kimi.com/coding/`
3. ✅ Kimi Code has separate model: `kimi-for-coding`
4. ✅ Pattern matches z.ai: general vs coding-specific endpoints

---

## 🔍 Current State Analysis

### Existing Kimi Provider
**Location**: `packages/core/src/llm/plugins/kimi.ts`

**Configuration**:
```typescript
id: 'kimi'
baseURL: 'https://api.kimi.cn/v1'
envKey: 'KIMI_API_KEY'
model: 'kimi-k2.5'
```

**Bug Found** 🐛:
```typescript
// Line 31 - Same bug as z.ai!
return provider('kimi-k2.5');  // ❌ Returns specific model instance
// Should be:
return provider;  // ✅ Returns provider factory
```

### Kimi Code Requirements
**From Documentation** (https://www.kimi.com/code/docs/en/more/third-party-agents.html):

**Endpoint**: `https://api.kimi.com/coding/v1`  
**Model**: `kimi-for-coding`  
**API Key Format**: `sk-kimi-...` (64 chars)  
**Context Window**: 262,144 tokens (256K)  
**Max Output**: 32,768 tokens (32K)  
**Capabilities**: text, tools, streaming  
**OpenAI Compatible**: ✅ Yes

**Configuration Example**:
```bash
ANTHROPIC_BASE_URL=https://api.kimi.com/coding/
ANTHROPIC_API_KEY=sk-kimi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🏗️ Architecture Review

### Current Provider System Structure

```
config/llm-providers.ts          # Provider configurations
    ↓
packages/core/src/llm/
    ├── ProviderRegistry.ts      # Central registry with switch-case
    ├── plugins/
    │   ├── types.ts            # LLMProviderPlugin interface
    │   ├── index.ts            # Export all plugins
    │   ├── anthropic.ts        # Anthropic plugin
    │   ├── openai.ts           # OpenAI plugin
    │   ├── google.ts           # Google plugin
    │   ├── groq.ts             # Groq plugin
    │   ├── kimi.ts         # Kimi plugin (existing)
    │   ├── zai.ts              # Z.ai general plugin
    │   └── zai-coding-plan.ts  # Z.ai coding plugin
    │
    └── model/
        ├── ModelRegistry.ts     # Model storage
        └── ModelValidator.ts    # Model validation
```

### Dependency Graph

```
AdminPanel.ts (Dashboard)
    ↓
adminListProviders() (Daemon API)
    ↓
ProviderService.ts
    ↓
ProviderRegistry.ts
    ↓
Individual Plugins (zai.ts, kimi.ts, etc.)
    ↓
@ai-sdk/openai (Vercel AI SDK)
```

### Modularity Assessment ⚠️

**Strengths** ✅:
- Clear plugin interface (`LLMProviderPlugin`)
- Configuration centralized in `config/llm-providers.ts`
- Each provider is self-contained in its own file

**Weaknesses** ❌:
1. **Switch-case coupling**: `ProviderRegistry.ts:loadPlugin()` requires code change for each new provider
2. **Hard dependencies**: Cannot add providers at runtime
3. **Manual registration**: Need to update multiple places:
   - Plugin file
   - `plugins/index.ts` export
   - `ProviderRegistry.ts` switch case
   - `config/llm-providers.ts`
   - `providerEnvMap`
   - `defaultModelsByProvider`

**Recommendation**: ✅ Current structure is acceptable for now, but consider:
- Dynamic plugin loading using naming convention
- Plugin auto-discovery mechanism
- Separate provider metadata from code

---

## 📝 Development Tasks

### Phase 1: Fix Existing Kimi Provider ⚠️ CRITICAL
**Priority**: HIGH (Same bug as z.ai)

**Files**:
- `packages/core/src/llm/plugins/kimi.ts`

**Changes**:
```typescript
// Line 31
- return provider('kimi-k2.5');
+ return provider;
```

**Verification**:
- Run existing tests
- Ensure dynamic model selection works

---

### Phase 2: Add Kimi Code Provider

#### Task 2.1: Create Plugin File
**File**: `packages/core/src/llm/plugins/kimi-code.ts`

**Implementation**:
```typescript
import { createOpenAI } from '@ai-sdk/openai';
import type { LLMProviderPlugin, ProviderConfig, ModelInfo } from './types.js';

/**
 * Kimi Code Provider Plugin
 *
 * Uses OpenAI-compatible API for coding scenarios.
 * Optimized for software development tasks.
 *
 * Base URL: https://api.kimi.com/coding/v1
 * Documentation: https://www.kimi.com/code/docs/en/
 */
export class KimiCodePlugin implements LLMProviderPlugin {
  readonly name = 'Kimi Code';
  readonly id = 'kimi-code';

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
      baseURL: 'https://api.kimi.com/coding/v1',
      apiKey,
    });
    return provider;  // ✅ Return factory, not instance
  }

  isAvailable(): boolean {
    return !!process.env[this.apiKeyEnv];
  }

  getModels(): ModelInfo[] {
    return [
      {
        id: 'kimi-for-coding',
        name: 'Kimi for Coding',
        description: 'Optimized for software development (262K context, 32K output)',
        maxTokens: 262144,
        inputCostPer1K: 0.0006,  // TODO: Verify pricing
        outputCostPer1K: 0.003,  // TODO: Verify pricing
        complexityRange: { min: 70, max: 100 },
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
```

#### Task 2.2: Export Plugin
**File**: `packages/core/src/llm/plugins/index.ts`

**Add**:
```typescript
export * from './kimi-code.js';
```

#### Task 2.3: Register in ProviderRegistry
**File**: `packages/core/src/llm/ProviderRegistry.ts`

**Add to switch case** (~line 108):
```typescript
case 'kimi-code':
  return new KimiCodePlugin(module, apiKeyEnv);
```

#### Task 2.4: Add Configuration
**File**: `config/llm-providers.ts`

**Add to providers array** (~line 70):
```typescript
{
  id: 'kimi-code',
  enabled: false,
  package: '@ai-sdk/openai',
  envKey: 'KIMI_CODE_API_KEY',
  baseURL: 'https://api.kimi.com/coding/v1',
},
```

**Add to `providerEnvMap`** (~line 108):
```typescript
'kimi-code': 'KIMI_CODE_API_KEY',
```

**Add to `defaultModelsByProvider`** (~line 121):
```typescript
'kimi-code': 'kimi-for-coding',
```

#### Task 2.5: Update Environment Variables
**File**: `.env.example`

**Add**:
```bash
KIMI_CODE_API_KEY=sk-kimi-...
```

---

### Phase 3: Testing & Validation

#### Task 3.1: Unit Tests
**File**: `packages/core/src/llm/plugins/__tests__/kimi-code.test.ts` (optional)

**Test Cases**:
- Plugin initialization
- Model list
- Cost calculation

#### Task 3.2: Integration Test
**Manual Test Steps**:
1. Set `KIMI_CODE_API_KEY` in `.env`
2. Enable `kimi-code` in config
3. Run daemon
4. Check `/api/providers` endpoint
5. Verify model appears in dashboard

#### Task 3.3: Verification
**Commands**:
```bash
bun run typecheck
bun run build
bun run test
bun run verify
```

---

## 📊 Risk Assessment

### Low Risk ✅
- Pattern already proven with z.ai
- OpenAI-compatible API
- No breaking changes

### Medium Risk ⚠️
- Pricing information needs verification
- Model capabilities need real-world testing

### Mitigation
- Start with `enabled: false` (opt-in)
- Document pricing as "TODO: Verify"
- Add validation tests with real API

---

## 🔄 Future Improvements

### Short-term (This PR)
1. ✅ Fix kimi provider bug
2. ✅ Add kimi-code provider
3. ✅ Update documentation

### Medium-term (Next Sprint)
1. 🔄 Refactor switch-case to dynamic plugin loading
2. 🔄 Create provider scaffolding CLI tool
3. 🔄 Add provider validation framework
4. 🔄 Implement provider health checks

### Long-term (Backlog)
1. 📋 Runtime plugin loading
2. 📋 Plugin marketplace/registry
3. 📋 Provider usage analytics
4. 📋 Multi-provider load balancing

---

## ✅ Acceptance Criteria

- [ ] Kimi provider bug fixed
- [ ] Kimi Code provider created and registered
- [ ] Configuration added to all required files
- [ ] Tests pass: `bun run verify`
- [ ] Manual testing successful
- [ ] Documentation updated
- [ ] PR created with detailed description
- [ ] No breaking changes to existing providers

---

## 📚 References

- [Kimi Code Docs](https://www.kimi.com/code/docs/en/)
- [Kimi Code Console](https://www.kimi.com/code/console)
- [Third-Party Agents Guide](https://www.kimi.com/code/docs/en/more/third-party-agents.html)
- [Z.ai Integration PR #17](https://github.com/AmicusLab/Amicus/pull/17)

---

## 🚀 Next Steps

1. Review this plan
2. Confirm pricing information
3. Start with Phase 1 (fix kimi bug)
4. Implement Phase 2 (add kimi-code)
5. Complete Phase 3 (testing)
6. Create PR

**Estimated Total Time**: 2-3 hours  
**Suggested Branch**: `feature/kimi-code-provider`
