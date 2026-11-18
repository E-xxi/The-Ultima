// 게임 진행 상태. 진행에 관한 값은 모두 여기 있고, 아래 함수로만 바꾼다.
// 정답(언어 데이터)은 여기 두지 않는다. 노트는 플레이어의 추측이다.

export const PAGES = 5;
export const CELLS = 6;
export const MEMO_MAX = 60;
export const GUESS_MAX = 10;   // 글자 하나에 붙이는 추측 낱말 길이

// 조건 문자열에 쓰는 종류 → 상태 필드
export const KINDS = {event:'events', read:'read', seen:'seen', solved:'solved', visited:'visited', verified:'verified'};

export function newState(start) {
  return {
    chapter: 0,
    map: start.map,
    pos: null,            // null이면 start.spawn에서 시작
    events: {},           // 일어난 스토리 사건 (한 번만)
    read: {},             // 꺼내 읽은 문서
    seen: {},             // 확대해 본 기록
    solved: {},           // 푼 퍼즐
    visited: {},          // 들어가 본 장소
    discovered: {},       // 본 적 있는 글자 ('s:grass', 'm:nu')
    answers: {},          // 플레이어가 낸 보고서 문장
    guesses: {},          // 플레이어가 글자마다 적은 추측 ('s:tree' → '나무?'). 정답과 따로 둔다
    pairs: {},            // 기록별로 플레이어가 지은 대조 짝 ({rec1: {'0:1': [2, 3]}})
    verified: {},         // 대조를 마친(짝이 모두 맞은) 기록
    decipher: {known: [], rules: []},   // 해독 진행: 알아낸 기록문자 글자(소리 id)와 발견한 규칙 문장. 정답(stage0.json)과 따로 둔다
    notebook: {cur: 0, pages: Array.from({length: PAGES}, () => ({g: [], t: ''}))},
  };
}

// 조건: 'event:kit_given', '!solved:practice', 그 배열(모두 참), 또는 {atleast: N, of: [...]}(N개 이상 참). 비어 있으면 참.
export function check(state, cond) {
  if (!cond) return true;
  if (Array.isArray(cond)) return cond.every(c => check(state, c));
  if (typeof cond === 'object') return cond.of.filter(c => check(state, c)).length >= cond.atleast;
  const neg = cond.startsWith('!'), [kind, id] = (neg ? cond.slice(1) : cond).split(':');
  const field = KINDS[kind];
  if (!field) throw new Error('알 수 없는 조건: ' + cond);
  return !!state[field][id] !== neg;
}

// 처음 표시할 때만 true를 돌려준다(중복 실행 방지에 쓴다).
export function mark(state, kind, id) {
  const field = KINDS[kind] || (kind === 'discovered' ? 'discovered' : null);
  if (!field) throw new Error('알 수 없는 종류: ' + kind);
  if (state[field][id]) return false;
  state[field][id] = true;
  return true;
}

/* ---------- 노트 (플레이어의 추측) ---------- */
export function addGlyph(state, q) {
  const page = state.notebook.pages[state.notebook.cur];
  if (page.g.length >= CELLS) return false;
  page.g.push({k: q.k, id: q.id});
  return true;
}
export function removeGlyph(state, i) { state.notebook.pages[state.notebook.cur].g.splice(i, 1); }
export function setMemo(state, text) { state.notebook.pages[state.notebook.cur].t = String(text).slice(0, MEMO_MAX); }
// 글자 하나에 대한 추측. 비우면 지운다.
export const glyphKey = q => q.k + ':' + q.id;
export function setGuess(state, key, text) {
  const t = String(text).trim().slice(0, GUESS_MAX);
  if (t) state.guesses[key] = t; else delete state.guesses[key];
}
// 대조 짝 (플레이어의 가설). 판정은 compare.js
export function setPair(state, recId, key, range) { (state.pairs[recId] = state.pairs[recId] || {})[key] = range; }
export function clearPair(state, recId, key) { if (state.pairs[recId]) delete state.pairs[recId][key]; }
export function turnPage(state, delta) { goToPage(state, state.notebook.cur + delta); }
export function goToPage(state, n) { state.notebook.cur = Math.max(0, Math.min(PAGES - 1, n)); }
