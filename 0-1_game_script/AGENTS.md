# AGENTS.md — THE Ultima

> 이 파일은 게임 저장소 루트에 두거나, 기존 AGENTS.md가 있으면 아래 내용을 덧붙인다.
> `the-ultima-script/` 폴더는 저장소 안 원하는 위치(예: `vendor/the-ultima-script/` 또는 `design/`)에 그대로 복사한다. 경로를 바꿨다면 아래 경로도 함께 고친다.

## 프로젝트 개요
서기 4100년, 지구에 남은 소멸 언어(조지아 스바네티 지역 언어)의 기록을 해독하는 고고언어학자 게임. 핵심 시스템은 데이터 중심의 **범용 기록문자**(인공 음성 전사 문자)와 해독 진행.

## 작업 전에 반드시 읽을 것
1. `the-ultima-script/docs/dev-guideline.md` — 개발 지침 (최상위 기준)
2. `the-ultima-script/docs/CODEX_HANDOFF.md` — 이번 통합 작업 인계서 (작업 순서·금지 사항·완료 보고 형식)
3. `the-ultima-script/docs/script-decisions.md` — 문자 그래픽 규칙
4. `the-ultima-script/docs/stage0-design.md` — 스테이지 0 명세와 수용 기준
5. `the-ultima-script/stage0/index.html` — 동작하는 참조 구현

## 규칙
- 기존 코드·스테이지·데이터 구조를 먼저 분석하고 보고한다. 기존 기능을 임의로 삭제하거나 전체를 새로 작성하지 않는다.
- IPA(발음 데이터)와 글자 그래픽을 분리한다. 그래픽은 발음 특성에서 규칙으로 생성한다.
- 미확정 항목(유음 등 조음 방법 표시, 전체 음소 목록, 최종 글자 모양, 휘파람 기호 그래픽)을 임의로 완성하지 않는다. 임시 데이터는 `provisional`로 표시한다.
- 표기 규칙 데이터와 단어·퍼즐 데이터를 독립적으로 관리한다.
- 개발 지침과 구 기획서·기존 코드가 충돌하면 개발 지침을 따르고, 충돌 목록을 보고한다.

## 빌드·확인 (참조 패키지)
```bash
cd the-ultima-script
node tools/build-assets.mjs   # SVG 에셋 + 견본 시트
node tools/build-stage0.mjs   # 스테이지 0 단일 HTML
```
Node 18 이상, 외부 의존성 없음.
