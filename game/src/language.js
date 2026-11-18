// 두 층의 문자. 모양과 소리, 뜻은 data/language.json에 있고, 여기서는 그 데이터를 읽어 쓰기 쉽게만 만든다.
//  기계 고유 표기(k:'m'): 한글처럼 모아 쓰는 소리글자. 한 칸 = 첫소리 조각 + 가운데소리 조각 (7x7)
//  화자의 문자(k:'s'): 한 기호 = 한 형태소. 'sep'은 띄어쓰기 표지

const INI_ORDER = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const MED_ORDER = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';

export function createLanguage(data) {
  const initials = data.machine.initials, medials = data.machine.medials;
  const ini = new Map(initials.map(i => [i.id, i])), med = new Map(medials.map(m => [m.id, m]));
  const morph = new Map(data.speaker.morphemes.map(m => [m.id, m]));

  // 'nu' → ['n', 'u'], 'yo' → ['', 'yo']. 읽을 수 없으면 null.
  function split(syl) {
    for (const i of initials) if (i.id && syl.startsWith(i.id) && med.has(syl.slice(i.id.length))) return [i.id, syl.slice(i.id.length)];
    return med.has(syl) && ini.has('') ? ['', syl] : null;
  }
  // c 또는 v가 null이면 그 조각을 빼고 그린다(사전 기록지의 조각 표).
  function blockBits(c, v) {
    const g = Array.from({length: 7}, () => Array(7).fill('.')), vert = v ? med.get(v).vertical : true;
    const put = (bits, x0, y0) => bits.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') g[y0 + j][x0 + i] = '#'; }));
    if (c !== null) put(ini.get(c).bits, vert ? 0 : 1, vert ? 1 : 0);
    if (v) put(med.get(v).bits, vert ? 5 : 0, vert ? 0 : 5);
    return g.map(r => r.join(''));
  }
  const machineBits = syl => { const [c, v] = split(syl); return blockBits(c, v); };
  const speakerBits = id => id === 'sep' ? data.speaker.separator.bits : morph.get(id).bits;
  const bits = q => q.k === 'm' ? machineBits(q.id) : speakerBits(q.id);

  return {
    initials, medials, morph, split, blockBits, machineBits, speakerBits, bits,
    width: q => bits(q)[0].length,
    isVertical: v => !!med.get(v).vertical,
    hangul(syl) {
      const [c, v] = split(syl);
      return String.fromCharCode(0xAC00 + (INI_ORDER.indexOf(ini.get(c).jamo) * 21 + MED_ORDER.indexOf(med.get(v).jamo)) * 28);
    },
    // 낱말(형태소 id 배열)의 소리
    sounds: word => word.flatMap(id => morph.get(id).sound),
  };
}
