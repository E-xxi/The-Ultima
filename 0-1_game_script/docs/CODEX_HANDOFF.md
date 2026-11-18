# Codex 인계서 — THE Ultima 기록문자 시스템 · 스테이지 0 적용

## 0. 이 작업이 무엇인가
기존 THE Ultima 게임 저장소에 다음 두 가지를 통합한다.
1. **범용 기록문자 시스템**: 데이터 중심 문자 규칙 + 렌더러(음소 → 글자 SVG, 음절 블록 조립·이어 쓰기)
2. **스테이지 0 · 출발 전 연습**: 최소대립쌍 비교로 글자를 배우는 학습 스테이지

이 폴더(`the-ultima-script/`)는 **참조 구현과 기준 데이터**다. 저장소 구조에 맞게 옮기되, 규칙과 데이터의 의미는 바꾸지 않는다.

## 1. 기준 문서 (우선순위 순)
1. 개발 지침 「기록문자 및 특수 발화 시스템 개발 지침」 (사용자 제공) — 세계관·데이터 구조의 최상위 기준
2. `docs/script-decisions.md` — 문자 그래픽 규칙 결정 기록
3. `docs/stage0-design.md` — 스테이지 0 화면·상호작용 명세와 수용 기준
4. `stage0/index.html` — 동작하는 참조 구현 (브라우저로 열어 직접 플레이 가능)

구 기획서(기계 표기/화자 문자 2층, 상형 화자 문자)와 개발 지침이 충돌하면 **개발 지침이 우선**한다. 충돌은 조용히 해소하지 말고 목록으로 보고한다.

## 2. 작업 순서 (개발 지침 7장)
1. **기존 저장소 분석 먼저.** 언어·문자 시스템, 스테이지 구성, 퍼즐·스토리 데이터 구조를 파악하고 요약한다. 기존 기능을 임의로 삭제하거나 전체를 새로 작성하지 않는다.
2. 기존 구현과 이 패키지·개발 지침의 충돌 지점을 목록으로 정리한다.
3. 개발 지침 5장 개념에 맞춰 데이터 모델을 배치한다 (아래 3절 대응표).
4. 렌더러를 저장소의 언어·엔진에 맞게 이식한다. JS/TS 웹 프로젝트면 `src/scriptRenderer.mjs`를 거의 그대로 쓸 수 있다. 다른 엔진이면 로직(회전·앵커·블록 배치·연결선)을 그대로 옮긴다.
5. 스테이지 0을 기존 스테이지 시스템 위에 구현한다 (`docs/stage0-design.md`).
6. `SpecialVocalization`(휘파람 발화 기호)은 **확장 지점만** 마련하고 그래픽·퍼즐은 만들지 않는다. 스토리 진행에 따라 해금되는 구조여야 한다.
7. 기존 기능 회귀 테스트 + 6절 수용 기준 테스트.

## 3. 개발 지침 개념 ↔ 이 패키지
| 지침 개념 | 위치 |
|---|---|
| `Phoneme`, `PhoneticFeature` | `data/phonemes.sample.json` (place, manner, laryngeal, secondary, nasal, long) |
| `Grapheme` | `data/graphemes.json` → `consonantBases`, `vowelBases` (path + 연결 앵커 ports/ring/exit) |
| `Diacritic` | `marks`(조음 방법), `vowelDiacritics`(비음 점·장음 윗줄), `rules.secondaryArticulation` |
| `SyllableBlock` | `rules.blockLayout` + `layoutSyllable()` |
| `SpecialVocalization` | 없음 — 새로 확장 지점만 |
| `TranscriptionHypothesis` | 스테이지 0의 write 입력(`comp`) — 정답 데이터와 분리 |
| `DeciphermentProgress` | 스테이지 0의 `known`·`rules` — 저장소의 진행/세이브 시스템에 연결 |

## 4. 반드시 지킬 것
- **IPA와 그래픽 분리.** 글자 모양은 `graphemes.json`의 path만 바꿔서 교체 가능해야 한다 (SVG/이미지/폰트로 교체 대비).
- **그래픽은 발음 특성에서 규칙으로 생성**한다. 음소마다 그림을 하드코딩하지 않는다.
- **미확정 규칙은 렌더되지 않게** 한다. `rules.mannerMark`가 `UNDECIDED`(유음·떨음·탄음)이면 에러. 임의로 글자를 만들지 않는다.
- 전체 음소 목록·최종 글자 모양·특수 발화 그래픽을 **임의로 완성하지 않는다**. 샘플 데이터는 `provisional: true`.
- 표기 규칙(graphemes)과 단어·퍼즐 데이터(stage0.json)를 독립적으로 관리한다.
- 하나의 음절에 여러 자음(CCV, CCCV…)이 올 수 있다. 블록은 자음 수만큼 길어진다.
- 구 기획서의 제외 항목(타일 뒤집기, 앞면 상형·뒷면 한글 타일, 한글 타일 격자)을 UI에 넣지 않는다.

## 5. 문자 규칙 요약 (자세히는 `docs/script-decisions.md`)
- 모음: 작은 고리에서 시작해 라틴 글자 모양(a e i o u ʌ). 자음에는 고리가 없다. ʌ는 가로획 추가.
- 자음 기본 획 = 조음 위치(이누크티투트 음절문자 참고): 입술 꺾쇠 · 잇몸 아치 · 경구개 갈고리 · 연구개 P형 · 구개수 B형.
- 회전 = 후두 특성(장애음만): 0° 기본 · 90° 유성 · 180° 유기 · 270° 방출.
- 획 끝 표시 = 조음 방법: 비음 점 · 마찰 평행 획 · 접근 말림 · 파열 무표.
- 2차 조음: 해당 위치 기본 획 40% 축소, 오른쪽 위 부착.
- 모음 부호: 비음 위 점, 장음 윗줄.
- 음절 블록: 한 음절 안은 이어 쓰기(자음→자음 바닥선, 자음→모음 고리로, 모음→받침 획 끝), 음절 사이는 끊김. 받침은 60% 작은 꼴, 바닥선 정렬. 연결점은 바닥선 우선(`x + 1.5y`).

## 6. 렌더러 API
```js
import { createScript } from './src/scriptRenderer.mjs';
const script = createScript(graphemes, phonemes);
script.renderSyllable({ onset: ['kʼ'], nucleus: 'ãː', coda: [] }); // 독립 SVG 문자열
script.renderWord([{ onset: ['dʑ'], nucleus: 'i' }, { onset: ['w'], nucleus: 'ʌ', coda: ['n'] }]);
script.layoutWord(syllables); // { svg: 내부 요소, width } — 엔진에서 직접 배치할 때
```
각 글자는 `<g class="part" data-ph data-slot data-syl>` 그룹이고 투명 히트 영역 `rect.hit`을 가진다. 스테이지 0의 클릭·강조·이름표가 이 속성을 쓴다. 테마 대응이 필요하면 `graphemes.style.consonantInk = 'currentColor'`로 바꿔 쓴다.

## 7. 완료 보고에 포함할 것
- 기존 구조 분석 요약과 변경 파일 목록
- 개발 지침·구 기획서·기존 코드 간 충돌 목록과 처리 방식 (해소하지 못한 것은 질문으로)
- 임시 데이터로 남긴 항목 목록
- 테스트 결과 (기존 기능 회귀 + `docs/stage0-design.md` 6절)
