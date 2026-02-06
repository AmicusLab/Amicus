# Vertical Slice 3: Safety Lite 구현

## 개요
도구 실행 후 자동 Git 스냅샷 생성 및 롤백 기능

## 아키텍처

### 컴포넌트 구조
- **packages/safety**: SafetyExecutor 인터셉터
- **ChatEngine**: SafetyExecutor 통합
- **Daemon**: /chat/undo API 엔드포인트
- **CLI**: /undo 명령 처리

### 실행 흐름
1. LLM이 tool call 요청 (예: create_file)
2. ChatEngine이 SafetyExecutor.executeSafe() 호출
3. 도구 실행
4. SafetyExecutor가 Git 스냅샷 생성 (`git add . && git commit`)
5. 사용자가 `/undo` 입력 시 `git reset --hard HEAD~1`

## 사용법

### 자동 스냅샷
도구 실행 시 자동으로 Git 커밋이 생성됩니다:
```
[Safety] Snapshot created for create_file
```

### 롤백
CLI에서 `/undo` 입력:
```
You: /undo
Amicus: ✅ 성공적으로 이전 상태로 되돌렸습니다.
```

## 기술 스택

- **simple-git**: Git 명령 래퍼 라이브러리
- **Interceptor Pattern**: 도구 실행 가로채기
- **Fail-Safe Design**: 스냅샷 실패 시 도구 실행 차단

## 제약사항

- 단일 undo만 지원 (여러 단계 undo 불가)
- 쓰기 도구만 스냅샷 생성 (WRITE_TOOLS 참조)
- Git 레포지토리가 없으면 자동 초기화
- main 브랜치만 사용 (브랜치 관리 없음)

## 구현 상세

### WRITE_TOOLS 목록
```typescript
export const WRITE_TOOLS = [
  'create_file',
  'edit_file',
  'delete_file',
  'run_shell_command'
];
```

읽기 전용 도구 (read_file 등)는 스냅샷을 건너뛰어 성능 최적화.

### 에러 처리
- 스냅샷 생성 실패: 도구 실행 차단 (Fail-Safe)
- Git 레포지토리 없음: 자동으로 `git init`
- 롤백 커밋 없음: "❌ 되돌릴 커밋이 없습니다." 메시지

## 향후 개선 사항

- 다중 undo 지원 (undo 히스토리)
- 스냅샷 압축 (오래된 스냅샷 정리)
- 브랜치 기반 실험 모드