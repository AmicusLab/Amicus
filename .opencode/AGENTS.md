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
