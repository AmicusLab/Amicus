# CodeRabbit 한글 리뷰 통합 가이드

## 개요

이 프로젝트는 [CodeRabbit](https://coderabbit.ai)을 사용하여 Pull Request를 자동으로 한국어로 리뷰합니다.

## 주요 기능

### 🇰🇷 한글 리뷰
모든 리뷰 코멘트가 한국어로 제공되어 팀원들이 쉽게 이해할 수 있습니다.

### 🤖 자동 리뷰
- PR 생성 시 자동으로 코드 분석 및 리뷰 수행
- Draft PR은 자동 리뷰에서 제외 (수동으로 요청 가능)
- WIP, "DO NOT REVIEW", "DRAFT" 키워드가 포함된 PR은 자동 리뷰 제외

### 🛠️ 프로젝트 맞춤 설정
프로젝트의 기술 스택과 규칙에 최적화된 리뷰를 제공합니다:
- **Runtime**: Bun (Node.js 아님)
- **TypeScript**: Strict Mode
- **Server**: Hono (Express 사용 금지)
- **Web UI**: Lit + Signals (React DOM 사용 지양)
- **CLI**: React Ink
- **원칙**: Local-First

### 📝 경로별 특화 가이드

#### `apps/daemon/**`
- Hono 기반 백그라운드 서버
- WebSocket 연결 안정성 검토
- API 보안 및 에러 핸들링 확인

#### `apps/dashboard/**`
- Lit + Signals 기반 웹 대시보드
- Lit 컴포넌트 패턴 준수
- 환경변수 보안 (VITE_* 변수에 시크릿 금지)
- 성능 최적화

#### `apps/cli/**`
- React Ink 기반 터미널 인터페이스
- TTY/non-TTY 모드 지원
- Daemon API 통신 검증

#### `packages/**`
- 공유 패키지
- 의존성 최소화
- 타입 안정성 우선
- 모듈화 및 재사용성

#### `**/*.test.ts`
- 테스트 커버리지 확인
- Edge case 고려
- 명확성 및 유지보수성

## 지원 도구

CodeRabbit은 다음 도구들을 활용하여 코드를 분석합니다:

| 도구 | 용도 | 상태 |
|------|------|------|
| **GitHub Checks** | 자동 검사 통합 | ✅ 활성화 |
| **AST-grep** | 코드 패턴 매칭 | ✅ 활성화 |
| **Biome** | JS/TS 린팅 | ✅ 활성화 |
| **Markdownlint** | Markdown 스타일 검사 | ✅ 활성화 |
| **Shellcheck** | Shell 스크립트 검사 | ✅ 활성화 |
| **Yamllint** | YAML 파일 검사 | ✅ 활성화 |

## 사용법

### 1. PR 생성 시 자동 리뷰

PR을 생성하면 CodeRabbit이 자동으로:
1. 코드 변경사항 분석
2. 한글로 리뷰 코멘트 작성
3. GitHub Checks에 결과 표시

### 2. 리뷰에 응답하기

CodeRabbit의 코멘트에 답변할 수 있습니다:
```
@coderabbitai 이 부분에 대해 더 자세히 설명해주세요.
```

### 3. 추가 리뷰 요청

특정 파일이나 코드에 대한 추가 리뷰를 요청할 수 있습니다:
```
@coderabbitai 이 함수의 성능을 검토해주세요.
```

### 4. 리뷰 재실행

코드를 수정한 후 리뷰를 다시 실행하려면:
```
@coderabbitai review
```

## 설정 파일

### 위치
`.coderabbit.yaml` (프로젝트 루트)

### 주요 설정

```yaml
# 리뷰 언어: 한국어
language: ko

# 리뷰 프로필: chill (친화적인 톤)
reviews:
  profile: chill
  
  # 자동 리뷰 활성화
  auto_review:
    enabled: true
    drafts: false  # Draft PR은 제외
```

## 제외 경로

다음 경로는 리뷰에서 제외됩니다:
- `**/*.lock`, `**/*.lockb` (의존성 락 파일)
- `**/node_modules/**` (외부 패키지)
- `**/dist/**`, `**/build/**` (빌드 산출물)
- `**/.opencode/**` (내부 도구)
- `**/EOF` (임시 파일)

## 리뷰 프로필

현재 설정: **chill**

### 특징
- 친화적이고 건설적인 톤
- 긍정적인 피드백도 제공
- 코드 개선을 격려하는 스타일
- 과도하게 엄격하지 않음

### 다른 프로필 옵션
- `assertive`: 더 직접적이고 명확한 피드백
- `pythonic`: Python 스타일 가이드 중심
- `custom`: 사용자 정의 프롬프트

## FAQ

### Q1. CodeRabbit이 리뷰하지 않아요
- PR 제목에 "WIP", "DRAFT", "DO NOT REVIEW"가 포함되어 있는지 확인
- Draft PR인 경우 `@coderabbitai review` 명령으로 수동 실행
- GitHub Actions에서 CodeRabbit 앱 권한 확인

### Q2. 리뷰 언어를 영어로 바꾸고 싶어요
`.coderabbit.yaml` 파일에서 `language: ko`를 `language: en-US`로 변경하세요.

### Q3. 특정 파일/디렉토리를 리뷰에서 제외하고 싶어요
`.coderabbit.yaml`의 `ignore` 섹션에 패턴을 추가하세요:
```yaml
ignore:
  - "path/to/exclude/**"
```

### Q4. 리뷰가 너무 많아요/적어요
`.coderabbit.yaml`의 `profile` 설정을 조정하거나, 커스텀 프롬프트를 작성하세요.

### Q5. 보안 취약점을 찾아주나요?
네, CodeRabbit은 일반적인 보안 패턴을 검토합니다. 더 강력한 보안 검사를 위해서는 CodeQL이나 Snyk 같은 전문 도구와 함께 사용하세요.

## 참고 자료

- [CodeRabbit 공식 문서](https://docs.coderabbit.ai)
- [설정 가이드](https://docs.coderabbit.ai/guides/configure-coderabbit)
- [명령어 참조](https://docs.coderabbit.ai/guides/review-instructions)

## 지원

문제가 발생하면:
1. [CodeRabbit 지원팀](https://coderabbit.ai/support) 문의
2. GitHub Issue로 프로젝트 관리자에게 문의
3. `.coderabbit.yaml` 설정 검토

---

**마지막 업데이트**: 2026-02-06
