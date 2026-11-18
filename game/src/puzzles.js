// 퍼즐 판정. 퍼즐마다 클래스를 만들지 않고, 유형(type)별 판정 함수 하나씩만 둔다.
import {check} from './state.js';

export const PUZZLE_TYPES = {
  // 기록 장치 표기의 칸마다 첫소리·가운데소리 조각을 고른다. 화면이 칸을 하나씩 맞히고, 모두 맞히면 풀린다.
  compose_syllables: {
    checkStep: (puzzle, lang, wordIndex, sylIndex, pick) => {
      const syl = puzzle.words[wordIndex][sylIndex], [c, v] = lang.split(syl);
      return pick.c === c && pick.v === v;
    },
    accept: () => true,
  },
  // 0단계 출발 전 연습(비교 → 읽기 → 쓰기): 판정은 stage0.js, 데이터는 stage0.json. 화면이 문제를 하나씩 맞히고, 마치기를 누르면 풀린다.
  stage0_practice: {
    accept: () => true,
  },
  // 언어 게임 자리(임시): 언어 디자인이 확정되면 실제 퍼즐 유형으로 바꾼다. 지금은 버튼으로 완료 처리만 한다.
  placeholder: {
    accept: () => true,
  },
  // 보고서: 해석을 글로 적어 낸다. 정답 판정은 없고(이 단계의 해석은 틀려도 된다), 빈 글만 막는다.
  free_text_report: {
    accept: (puzzle, answer) => typeof answer === 'string' && answer.trim().length > 0 && answer.length <= (puzzle.max_length || 200),
  },
};

export const canStart = (puzzle, state) => check(state, puzzle.requires);

// 이미 풀었거나 조건이 안 맞으면 null. 풀리면 실행할 효과 목록을 돌려준다.
export function solve(puzzle, state, answer) {
  if (state.solved[puzzle.id] || !canStart(puzzle, state)) return null;
  if (!PUZZLE_TYPES[puzzle.type].accept(puzzle, answer)) return null;
  state.solved[puzzle.id] = true;
  if (answer !== undefined) state.answers[puzzle.id] = answer.trim();
  return puzzle.on_solve || [];
}
