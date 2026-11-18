# THE Ultima — 범용 기록문자 그래픽 패키지 v0.1 (임시 그래픽)

규칙은 확정, 글자 모양은 임시. 모양을 바꾸려면 `data/graphemes.json`의 `path`만 수정하고 빌드를 다시 돌리면 된다.

## 구성
| 경로 | 내용 |
|---|---|
| `data/graphemes.json` | 그래픽 규칙: 기본 획, 모음, 표시(마크), 회전·배치 규칙, 색·선 굵기 |
| `data/phonemes.sample.json` | 검증용 샘플 음소(IPA·발음 특성)와 샘플 음절. 최종 음소 목록 아님 |
| `src/scriptRenderer.mjs` | 의존성 없는 ES 모듈. 음소 → 글자 SVG, 음절 블록 조립·이어 쓰기 |
| `tools/build-assets.mjs` | 개별 SVG 에셋과 견본 시트 생성 |
| `assets/svg/` | 자음 24 · 모음 9 · 샘플 음절 6개 SVG + `manifest.json`(연결점·회전값) |
| `preview/specimen.html`, `.png` | 전체 규칙 견본 시트 |

## 빌드
```bash
node tools/build-assets.mjs
```

## 게임 코드에서 쓰기
```js
import { createScript } from './src/scriptRenderer.mjs';
const script = createScript(graphemes, phonemes);

script.renderSyllable({ onset: ['kʼ'], nucleus: 'ãː', coda: [] });          // SVG 문자열
script.renderWord([{ onset: ['dʑ'], nucleus: 'i' }, { onset: ['w'], nucleus: 'ʌ', coda: ['n'] }]);
script.layoutSyllable(spec);   // { svg(내부 요소), width } — 엔진에서 직접 배치할 때
```
- 모든 선은 `vector-effect="non-scaling-stroke"`라 크기를 바꿔도 굵기가 유지된다.
- `rules.mannerMark` 값이 `UNDECIDED`인 조음 방법(유음 등)은 렌더 시 에러를 내서, 미확정 글자가 몰래 섞이지 않게 한다.

## 데이터 모델 대응 (개발 지침 5장)
| 지침 개념 | 이 패키지 |
|---|---|
| `Phoneme` / `PhoneticFeature` | `phonemes.sample.json` (place, manner, laryngeal, secondary, nasal, long) |
| `Grapheme` | `graphemes.json`의 `consonantBases`·`vowelBases` (path + ports/ring/exit 연결 앵커) |
| `Diacritic` | 조음 방법 표시(`marks`), `vowelDiacritics`, `secondaryArticulation` |
| `SyllableBlock` | `rules.blockLayout` + `layoutSyllable()` |
| `SpecialVocalization` | 미포함 — 지침 4장 임시 기호 유지, 후속 작업 |

## 그래픽 규칙 요약
1. 모음은 고리에서 시작하는 라틴 글자 형태, 자음에는 고리가 없다. ʌ는 가로획 추가.
2. 자음 기본 획 = 조음 위치 (이누크티투트 p·t·g·k·q 계열 참고): 꺾쇠 / 아치 / 갈고리 / P형 / B형.
3. 회전 = 후두 특성, 장애음만: 0° 기본, 90° 유성, 180° 유기, 270° 방출.
4. 획 끝 표시 = 조음 방법: 비음 점, 마찰 평행 획, 접근 말림. 파열 무표.
5. 2차 조음 = 해당 위치 기본 획 40% 축소, 오른쪽 위 부착.
6. 모음 부호: 비음 위 점, 장음 윗줄.
7. 음절 블록은 자음 수만큼 길어지고 한 음절 안은 이어 쓴다. 연결점은 바닥선 우선. 받침은 60% 작은 꼴, 바닥선 정렬.

## 미정
유음(l, r)·성문음 등 조음 방법 표시, 전체 음소 목록, 최종 글자 그래픽, 특수 발화 기호 그래픽.
