# Amicus 프로젝트 에이전트 정의

이 문서는 Amicus 프로젝트에서 사용하는 커스텀 OpenCode 에이전트를 정의합니다.

## 사용 가능한 에이전트

### planner

**역할**: 작업 계획 수립 전문가

**용도**: 복잡한 기능 구현 요청 시 세부 태스크로 분해하여 실행 계획 수립

**트리거**:
- "계획 세워줘"
- "plan [기능명]"
- 복잡한 구현 요청 시 자동 활성화 권장

**사용법**:
```
delegate_task(
  subagent_type="planner",
  load_skills=["planner"],
  prompt="[기능 구현 요청 내용]",
  run_in_background=false
)
```

**출력**:
- 세부 태스크 목록 (TODO 형식)
- 의존성 그래프
- 검증 기준
- 예상 산출물

---

## 에이전트 선택 가이드

| 상황 | 추천 에이전트 | 이유 |
|------|--------------|------|
| 새 기능 구현 계획 | `planner` | 태스크 분해 및 의존성 분석 |
| 코드베이스 탐색 | `explore` | 빠른 패턴 검색 |
| 외부 라이브러리 조사 | `librarian` | 문서 및 예제 검색 |
| 아키텍처 결정 | `oracle` | 고품질 추론 |
| 프론트엔드 UI | `visual-engineering` | UI/UX 전문 |
| 간단한 수정 | `quick` | 빠른 처리 |

---

## 커스텀 스킬

### planner

위치: `.opencode/skills/planner.md`

계획 수립 시 로드되는 전문 지식:
- 프로젝트별 규칙 (기술 스택, 검증 명령, 커밋 컨벤션)
- 계획서 템플릿
- 행동 지침 (MUST DO / MUST NOT DO)

---

## 커밋 규칙 (Commit Guidelines)

### 커밋 타이밍

**커밋은 반드시 아래 조건을 모두 만족한 후에만 수행:**

1. ✅ **테스트 통과**
   - `bun run test:all` 실행
   - 모든 테스트 (unit + interface) 통과

2. ✅ **타입 체크 통과**
   - `bun run typecheck` 실행
   - TypeScript 오류 없음

3. ✅ **빌드 통과**
   - `bun run build` 실행
   - 모든 패키지/앱 빌드 성공

4. ✅ **UI 검증 (해당 시)**
   - `bun run start:dev`로 전체 시스템 실행
   - Dashboard: http://localhost:5173 정상 표시
   - CLI: 터미널 출력 정상
   - Daemon: API 응답 정상

5. ✅ **문서화 완료**
   - 구현 문서: `docs/implementation/*.md`
   - 필요시 README 업데이트
   - API 변경시 타입 문서화

### 커밋 메시지 컨벤션

```
<type>(<scope>): <subject>

<body>

<footer>
```

**타입:**
| 타입 | 설명 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `test` | 테스트 추가/수정 |
| `refactor` | 리팩토링 |
| `chore` | 기타 작업 |

**예시:**
```
feat(daemon): add WebSocket health check

- Daemon 시작 시 health endpoint 확인
- CLI가 Daemon 준비된 후 연결 시도
- 최대 10초 대기, 재시도 5회

Closes #123
```

### 커밋 금지 사항

❌ **금지:**
- 테스트 실패 상태에서 커밋
- 빌드 오류 상태에서 커밋
- 미완성 기능 커밋 (WIP 커밋)
- 커밋 메시지 없이 커밋
- 여러 기능을 하나의 커밋에 포함

✅ **권장:**
- 원자적 커밋 (하나의 기능/수정만)
- 한글 설명과 영어 메시지 병행
- 관련 이슈 번호 참조
