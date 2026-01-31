# Interface Layer 테스트 가이드

## 개요

Amicus 프로젝트의 Interface Layer(daemon, dashboard, cli)에 대한 테스트 실행 방법 및 작성 가이드입니다.

---

## 테스트 구조

```
apps/
├── daemon/__tests__/          # 통합 테스트 (CI 포함)
│   ├── api.test.ts
│   ├── websocket.test.ts
│   └── test-utils.ts
├── dashboard/tests/           # E2E 테스트 (로컬 전용)
│   ├── dashboard.e2e.ts
│   └── realtime.e2e.ts
└── cli/__tests__/             # 실행 테스트 (CI 포함)
    └── cli.test.ts
```

---

## 테스트 명령어

### 로컬에서 실행

```bash
# 모든 테스트 (unit + interface)
bun run test:all

# unit 테스트만
bun run test

# interface 테스트만 (daemon + cli)
bun run test:interface

# E2E 테스트만 (dashboard - 로컬 전용)
bun run test:e2e

# 전체 검증 (typecheck + build + test:all)
bun run verify
```

### 개별 앱 테스트

```bash
# Daemon
cd apps/daemon
bun test

# CLI
cd apps/cli
bun test

# Dashboard (E2E)
cd apps/dashboard
bun run test:e2e
bun run test:e2e:ui      # UI 모드
bun run test:e2e:report  # 리포트 보기
```

---

## E2E 테스트 (로컬 전용)

Dashboard E2E 테스트는 Playwright를 사용하며 **로컬에서만 실행**됩니다.

### Playwright 설치

```bash
cd apps/dashboard
bunx playwright install chromium
```

### E2E 테스트 실행

```bash
# 기본 실행 (headless)
bun run test:e2e

# UI 모드로 실행 (브라우저 표시)
bun run test:e2e:ui

# 리포트 보기
bun run test:e2e:report
```

### 왜 CI에서 제외하는가?

- 실행 시간 증가 (브라우저 설치 + 실행)
- 헤드리스 환경의 불안정성
- 로컬에서 충분한 검증 가능

---

## CI에서의 테스트

GitHub Actions에서 실행되는 테스트:

1. **Unit Tests**: `bun run test`
2. **Interface Tests**: `bun run test:interface`
3. **Build Validation**: 각 앱의 build 명령어

```yaml
# .github/workflows/ci.yml
- name: Unit Tests
  run: bun run test

- name: Interface Tests
  run: bun run test:interface

- name: Build Interface Apps
  run: |
    bun run --cwd apps/daemon build
    bun run --cwd apps/dashboard build
    bun run --cwd apps/cli build
```

---

## 테스트 작성 가이드

### Daemon 통합 테스트

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, stopTestServer, getTestURL } from './test-utils';

describe('Daemon API', () => {
  beforeAll(async () => {
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  it('should return status', async () => {
    const response = await fetch(getTestURL('/api/status'));
    expect(response.status).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
  });
});
```

### Dashboard E2E 테스트

```typescript
import { test, expect } from '@playwright/test';

test('should display status board', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=System Status')).toBeVisible();
});
```

### CLI 테스트

```typescript
import { describe, it, expect } from 'bun:test';
import { spawn } from 'node:child_process';

describe('CLI', () => {
  it('should run in non-interactive mode', async () => {
    const proc = spawn('bun', ['src/index.tsx'], { env: { CI: 'true' } });
    
    let stdout = '';
    proc.stdout?.on('data', (data) => stdout += data);
    
    await new Promise((resolve) => proc.on('close', resolve));
    expect(stdout).toContain('Amicus CLI');
  });
});
```

---

## 트러블슈팅

### Daemon 테스트 실패

**증상**: `ECONNREFUSED` 에러

**해결**: 테스트 서버가 제대로 시작되지 않음
```bash
# 포트 3001이 사용 중인지 확인
lsof -i :3001

# 테스트 다시 실행
bun run test:interface
```

### Playwright 브라우저 설치 실패

**증상**: `Executable doesn't exist` 에러

**해결**:
```bash
cd apps/dashboard
bunx playwright install chromium
```

### CLI 테스트 타임아웃

**증상**: 테스트가 30초 이상 걸림

**해결**: Daemon이 실행 중인지 확인
```bash
# Daemon 실행
bun run --cwd apps/daemon start &

# CLI 테스트
bun run --cwd apps/cli test
```

---

## 테스트 커버리지 목표

| 컴포넌트 | 목표 | 현재 |
|---------|------|------|
| Daemon API | 100% 엔드포인트 | 6/6 ✅ |
| WebSocket | 주요 이벤트 | 3/3 ✅ |
| Dashboard | 핵심 플로우 | 로컬 전용 |
| CLI | 비-TTY 모드 | 2/2 ✅ |

---

## 관련 문서

- [Phase 4 구현 계획](../implementation/phase4-interface-layer.md)
- [Playwright 문서](https://playwright.dev/)
- [Bun Test 문서](https://bun.sh/docs/cli/test)
