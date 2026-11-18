// 범용 기록문자의 소리 쪽 도구. 글자 그리기는 scriptRenderer.js(원본: 0-1_game_script)가 맡는다.
//  소리 목록: phonemes.json (IPA·발음 특성), 회전이 붙는 조음 방법: graphemes.json rules
//  시대별 사용 범위·음절 틀·특수 발화 기호: script.json
//  음절은 IPA 문자열('kʼãː'), 단어는 음절을 '.'로 나눠 쓴다('dʑi.wʌn').
//  소리만 다룬다. 뜻은 language.json에 있다(글자를 읽을 수 있다 ≠ 언어를 이해한다).

export function createScript(data, phonemes, graphemes) {
  const eras = new Map(data.eras.map(e => [e.id, e]));
  const cons = new Map(phonemes.consonants.map(c => [c.id, c])), vows = new Map(phonemes.vowels.map(v => [v.id, v]));
  const rotating = new Set(graphemes.rules.laryngealRotation.appliesTo);
  // id와 IPA 둘 다로 찾는다('g'와 'ɡ'). 긴 것부터 맞춘다('kʰ'가 'k'보다 먼저).
  const keys = new Map();
  for (const c of phonemes.consonants) for (const k of [c.id, c.ipa]) keys.set(k.normalize('NFC'), {cls: 'C', id: c.id});
  for (const v of phonemes.vowels) for (const k of [v.id, v.ipa]) keys.set(k.normalize('NFC'), {cls: 'V', id: v.id});
  const byLength = [...keys.keys()].sort((a, b) => b.length - a.length);
  const byTemp = new Map(data.utterance.symbols.map(s => [s.temp, s]));

  // 'kʼãː' → [{cls:'C', id:'kʼ'}, {cls:'V', id:'ãː'}]. 모르는 소리가 있으면 null.
  function tokens(str) {
    const s = str.normalize('NFC'), out = [];
    for (let i = 0; i < s.length;) {
      const k = byLength.find(k => s.startsWith(k, i));
      if (!k) return null;
      out.push({...keys.get(k)}); i += k.length;
    }
    return out;
  }
  const templateOf = segs => segs.map(s => s.cls).join('');
  function parseSyllable(str) {
    const segments = tokens(str);
    if (!segments || !data.templates.includes(templateOf(segments))) return null;
    return {segments, template: templateOf(segments)};
  }
  function parseWord(str) {
    const syls = str.split('.').map(parseSyllable);
    return syls.includes(null) ? null : syls;
  }
  // 렌더러가 받는 음절 모양: {onset, nucleus, coda}
  function toSpec(segments) {
    const v = segments.findIndex(s => s.cls === 'V');
    return {onset: segments.slice(0, v).map(s => s.id), nucleus: segments[v].id, coda: segments.slice(v + 1).map(s => s.id)};
  }
  // 이 소리가 쓰는 표시: 회전(장애음의 후두 특성), 2차 조음, 모음 부호
  function marksOf(seg) {
    if (seg.cls === 'V') { const v = vows.get(seg.id); return [v.nasal && 'nasal', v.long && 'long'].filter(Boolean); }
    const c = cons.get(seg.id);
    return [rotating.has(c.manner) && c.laryngeal !== 'plain' && c.laryngeal, c.secondary].filter(Boolean);
  }
  // 그 시대 표기 지식으로 이 음절을 읽을 수 있는지. 모르는 표시와 모르는 틀을 돌려준다.
  // 예: LHS에서 배운 사람에게 지구 기록의 방출 회전(270°)은 '잊힌 구별'로 보인다.
  function readable(eraId, str) {
    const era = eras.get(eraId), syl = parseSyllable(str);
    if (!era || !syl) return null;
    const unknownMarks = [...new Set(syl.segments.flatMap(marksOf))].filter(m => !era.marks.includes(m));
    const templateKnown = era.templates.includes(syl.template);
    return {ok: templateKnown && !unknownMarks.length, template: syl.template, templateKnown, unknownMarks};
  }
  // 특수 발화 표기: '↗—‖↘' → ['rise','sustain','break','fall']. 모르는 기호가 있으면 null.
  function contour(str) {
    const ids = [...str].filter(ch => ch.trim()).map(ch => byTemp.get(ch)?.id);
    return ids.includes(undefined) ? null : ids;
  }

  return {eras, tokens, parseSyllable, parseWord, toSpec, marksOf, readable, contour};
}
