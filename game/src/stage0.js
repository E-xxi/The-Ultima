// 0단계 출발 전 연습(비교 → 읽기 → 쓰기)의 판정. 화면 없이 쓰는 순수 함수만 둔다.
// 명세: 0-1_game_script/docs/stage0-design.md, 데이터: data/stage0.json
// 정답(stage0.json)과 플레이어의 진행(state.decipher: 알아낸 글자·규칙)은 따로 둔다.

export const SLOTS = ['onset0', 'nucleus', 'coda0'];
export const PHASES = ['compare', 'read', 'write'];

// 단어 → {'음절번호:자리' → 소리}. 예: 감자 → {'0:onset0':'k', '0:nucleus':'a', '0:coda0':'m', '1:onset0':'dʑ', ...}
export function partsOf(syls) {
  const out = new Map();
  syls.forEach((s, si) => {
    (s.onset || []).forEach((p, i) => out.set(`${si}:onset${i}`, p));
    out.set(`${si}:nucleus`, s.nucleus);
    (s.coda || []).forEach((p, i) => out.set(`${si}:coda${i}`, p));
  });
  return out;
}
// 두 단어에서 글자가 다른 자리
export function diffKeys(a, b) {
  const A = partsOf(a), B = partsOf(b);
  return [...new Set([...A.keys(), ...B.keys()])].filter(k => A.get(k) !== B.get(k));
}
// 비교: 누른 자리가 달라진 자리면 'found', 아니면 'same'(진행하지 않는다)
export const compareResult = (S, round, key) => diffKeys(S.words[round.a], S.words[round.b]).includes(key) ? 'found' : 'same';
// 읽기: 정답이면 {ok:true}, 아니면 고른 단어와 다른 자리
export const readResult = (S, q, option) => option === q.word ? {ok: true, diff: []} : {ok: false, diff: diffKeys(S.words[q.word], S.words[option])};
// 쓰기 팔레트: 아는 글자 중 그 칸에 들어갈 수 있는 것. 모음 칸은 모음만, 첫소리·받침은 자음만, 받침에는 '없음('')'을 더한다.
export function paletteFor(S, slot, known, isVowel) {
  const ids = S.notebookOrder.filter(id => known.includes(id) && (slot === 'nucleus') === isVowel(id));
  return slot === 'coda0' ? [...ids, ''] : ids;
}
// 쓰기 판정: 틀린 칸 목록(['0:coda0', ...]). 비어 있으면 정답. comp = [{onset0, nucleus, coda0}] (받침 없음은 '')
export function writeWrong(S, target, comp) {
  const want = S.words[target], wrong = [];
  want.forEach((w, si) => {
    const exp = {onset0: w.onset[0] ?? '', nucleus: w.nucleus, coda0: w.coda[0] ?? ''};
    for (const k of SLOTS) if ((comp[si]?.[k] ?? null) !== exp[k]) wrong.push(`${si}:${k}`);
  });
  return wrong;
}
// 해독 진행: 글자와 규칙을 더한다(중복 없이). 새로 알게 된 글자를 돌려준다.
export function learn(progress, ids, rule) {
  const fresh = ids.filter(id => !progress.known.includes(id));
  progress.known.push(...fresh);
  if (rule && !progress.rules.includes(rule)) progress.rules.push(rule);
  return fresh;
}
// 처음 시작하거나 '처음부터 다시'일 때: 시작할 때 아는 글자만 남긴다
export function resetProgress(progress, S) {
  progress.known = [...S.knownAtStart];
  progress.rules = [];
}
