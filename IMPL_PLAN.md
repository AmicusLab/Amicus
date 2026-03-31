# 구현 계획: [Phase 2] 기존 실패 테스트 3건 수정

## 목표
CI에서 실패하는 테스트 3개 통과

## 변경 파일
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| StatusBoard.test.ts | 수정 | JSDOM + MockStatusBoard |
| SessionList.test.ts | 수정 | JSDOM + MockSessionList |
| bunfig.toml | 생성 | experimentalDecorators = true |
| package.json | 수정 | jsdom devDependency 추가 |

## 구현 단계
### Step 1: bunfig.toml 생성
- 테스트: [Red] 데코레이터 오류
- 구현: [Green] experimentalDecorators = true 설정
- 리팩터: [Refactor] 해당 없음

### Step 2: jsdom 설치
- 테스트: [Red] Cannot find module 'jsdom'
- 구현: [Green] bun add -d jsdom
- 리팩터: [Refactor] 해당 없음

### Step 3: StatusBoard.test.ts 수정
- 테스트: [Red] Lit 데코레이터가 bun:test에서 동작하지 않음
- 구현: [Green] MockStatusBoard만 사용 (실제 컴포넌트 import 제거)
- 리팩터: [Refactor] 해당 없음

### Step 4: SessionList.test.ts 수정
- 동일 방식 적용

## 위험도
- [ ] 보안 영향
- [ ] 성능 영향
- [ ] 하위 호환성
- [ ] 기존 기능 영향

## 수용 기준
1. StatusBoard 테스트 통과
2. SessionList 테스트 통과
3. 기존 테스트 회귀 없음

## 검증 방법
```bash
bun test apps/dashboard/src/components/StatusBoard.test.ts
bun test apps/dashboard/src/components/SessionList.test.ts
```

Closes #59
