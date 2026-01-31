# Amicus AI Project Specification (`spec.md`)

## 1. 프로젝트 개요

Amicus는 사용자의 로컬 환경에서 실행되는 **신뢰 기반 자율형 개인 비서**입니다. 단순 대화형 봇을 넘어, 사용자의 시스템 권한을 안전하게 위임받아 루틴을 수행하고 맥락을 기억하는 '로컬 퍼스트 자율 OS' 레이어를 지향합니다.

## 2. 4대 핵심 설계 원칙 (Manifesto)

1. **Trust-First (신뢰 우선):** 모든 시스템 변경은 가시적이어야 하며, 파일 수정 전 Git 기반의 자동 스냅샷을 생성하여 무조건적인 롤백(Undo)을 보장한다.
2. **Protocol-First (표준 준수):** 외부 도구 연동은 **MCP**(Model Context Protocol), IDE 및 인터페이스 연동은 **ACP**(Agent Client Protocol) 표준을 엄격히 따른다. 


3. **Decision-Centric Memory (의사결정 기억):** 단순 로그가 아닌, 사용자가 내린 결정의 이유와 패턴을 `MEMORY.md`에 구조화하여 저장한다. 


4. **Economic Intelligence (비용 지능):** 작업의 복잡도에 따라 저가형(Gemini Flash 등)과 고사양(Claude Opus 등) 모델 사이를 자동 라우팅하여 토큰 비용을 최적화한다.

## 3. 시스템 아키텍처 및 모듈 구조

 ```
packages/
├── core/           # 핵심 추론 루프 및 상태 관리 (RoutineEngine 포함)
├── acp-server/     # IDE와의 통신 규격 구현
├── mcp-engine/     # 외부 도구(GitHub, Slack 등) 호출 관리
└── ui-cli/          # React-Ink 기반 터미널 대시보드
data/
├── NOW.md          # 현재 작업 스냅샷 및 단기 목표
└── MEMORY.md       # 장기 기억 및 의사결정 로그
```
---

## 4. 단계별 개발 가이드 (OpenCode 실행 프롬프트)

### [Phase 1] 기반 인프라 및 신뢰 레이어

 **프롬프트:** "Node.js와 TypeScript를 사용하여 Amicus AI 프로젝트의 모노레포 구조를 초기화해줘. 특히 `packages/core`에 `RoutineEngine`을 구현해야 해. 이 클래스는 작업 실패 시 `git reset --hard`로 즉시 롤백하는 기능을 가져야 해. 모든 기록은 `data/audit.log`에 암호화된 서명과 함께 남겨줘."

### [Phase 2] 지능형 메모리 시스템

**프롬프트:** "`packages/core`에 마크다운 기반의 `ContextManager`를 만들어줘. 세션 시작 시 `data/NOW.md`를 읽고, 종료 시 오늘의 주요 결정 사항과 사용자의 스타일 피드백을 요약해서 `data/MEMORY.md`에 기록해야 해. 컨텍스트 윈도우가 가득 차면 중요하지 않은 대화는 스스로 요약해서 압축하는 `/compact` 로직을 포함해줘." 

### [Phase 3] 루틴 엔진 및 MCP 통합

 **프롬프트:** "사용자의 반복 업무를 관리하는 `RoutineEngine`을 구축해줘. macOS `launchd` 또는 Linux `systemd` 서비스로 등록 가능한 구조여야 하며, 특정 트리거(시간, 파일 변경 등) 시 MCP 서버의 도구들을 호출해야 해. 도구 실행 전에는 반드시 `OperationExecutor`를 거쳐 롤백 지점을 생성하고, 비용 라우팅 로직을 통해 예산 한도 내에서 모델을 선택하게 해줘."

### [Phase 4] 터미널 조종석 UI (Cockpit)

**프롬프트:** "`packages/ui-cli`에서 `react-ink`를 사용하여 실시간 대시보드를 만들어줘. 현재 진행 중인 루틴의 상태, 실시간 토큰 사용 비용, 그리고 에이전트의 내부 추론 과정(Thought)을 가독성 있게 스트리밍으로 보여줘야 해. 위험한 명령 실행 전에는 사용자의 수동 승인을 기다리는 UI 컴포넌트도 추가해줘." 

---

# 개발 시작 가이드 (How to Start)

1. **환경 세팅:**
* Node.js 22 버전 이상 설치 확인. 


* `mkdir amicus && cd amicus`
* `git init` (롤백 기능을 위해 필수)


2. **OpenCode 실행:**
* 터미널에서 `opencode`를 실행하여 에이전트를 깨웁니다.


3. **설계 공유:**
* 에이전트에게 **"앞으로 @spec.md 파일을 기반으로 Amicus 비서를 개발할 거야. 이 문서의 Manifesto를 프로젝트 전반의 헌법으로 삼아줘."**라고 먼저 말하세요.


4. **단계별 진행:**
* 위의 `Phase 1` 프롬프트를 복사해서 던지세요.
* 코드 생성이 완료되면 `opencode build`나 제안된 테스트 명령으로 작동을 확인한 뒤 다음 Phase로 넘어갑니다.
