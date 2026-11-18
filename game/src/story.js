// 대사 고르기와 효과 실행. 화면을 직접 건드리는 효과는 host가 처리한다.
import {check, mark} from './state.js';

// 변형 목록에서 조건이 맞는 첫 번째를 고른다. 없으면 null.
export function pickVariant(variants, state) {
  for (const v of variants || []) if (check(state, v.when)) return v;
  return null;
}

// 효과 문자열 한 줄: '종류:값'
export const EFFECT_KINDS = ['event', 'chapter', 'goto', 'card', 'open_read', 'open_puzzle', 'chapter_end', 'say'];
export function parseEffect(e) {
  const i = e.indexOf(':');
  return i < 0 ? [e, ''] : [e.slice(0, i), e.slice(i + 1)];
}

// host: {goto(map, spawn), card(id), openRead(id), openPuzzle(id), chapterEnd(n), say(dialogueId)}
export function runEffects(effects, state, host) {
  for (const e of effects || []) {
    const [kind, arg] = parseEffect(e);
    switch (kind) {
      case 'event': mark(state, 'event', arg); break;
      case 'chapter': state.chapter = Number(arg); break;
      case 'goto': { const [map, spawn] = arg.split('/'); host.goto(map, spawn); break; }
      case 'card': host.card(arg); break;
      case 'open_read': host.openRead(arg); break;
      case 'open_puzzle': host.openPuzzle(arg); break;
      case 'chapter_end': host.chapterEnd(arg); break;
      case 'say': host.say(arg); break;
      default: throw new Error('알 수 없는 효과: ' + e);
    }
  }
}
