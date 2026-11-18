// 두 층 대조: 화자 문자의 기호(형태소) 하나가 같은 줄 기계 표기의 몇 번째~몇 번째 소리인지.
// 정답은 records.json과 language.json에서 계산하고, 플레이어가 지은 짝(state.pairs)과 비교한다.
// 짝 열쇠는 '줄:순서' (예: '1:2' = 둘째 줄의 셋째 기호). 범위는 [처음, 끝] 소리 번호(0부터).

export const comparable = rec => !!(rec && rec.lines && rec.lines.some(l => l.words));

export function expectedRanges(rec, lang) {
  const out = {};
  rec.lines.forEach((ln, li) => {
    if (!ln.words) return;
    let a = 0, n = 0;
    for (const w of ln.words) for (const id of w) {
      const len = lang.morph.get(id).sound.length;
      out[li + ':' + n] = [a, a + len - 1];
      a += len; n++;
    }
  });
  return out;
}

// 모든 기호에 짝이 있으면 complete, 그 짝이 모두 맞으면 correct. 어느 짝이 틀렸는지는 알려 주지 않는다.
export function checkPairs(rec, lang, pairs = {}) {
  const exp = expectedRanges(rec, lang), keys = Object.keys(exp);
  const done = keys.filter(k => pairs[k]).length;
  const correct = done === keys.length && keys.every(k => pairs[k][0] === exp[k][0] && pairs[k][1] === exp[k][1]);
  return {complete: done === keys.length, correct, done, total: keys.length};
}

// 대조를 마친 기록들에서 소리가 밝혀진 형태소 → 소리(한글). 노트 칸에 적는다.
export function knownSounds(records, verified, lang) {
  const out = {};
  for (const rec of records) {
    if (!verified[rec.id]) continue;
    for (const ln of rec.lines) for (const w of ln.words || []) for (const id of w) out['s:' + id] = lang.morph.get(id).sound.map(lang.hangul).join('');
  }
  return out;
}
