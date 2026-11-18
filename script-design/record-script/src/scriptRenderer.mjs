// THE Ultima — 범용 기록문자 렌더러 (v0.1, provisional)
// 의존성 없음. 브라우저·Node 모두에서 동작하는 ES 모듈.
// 입력: graphemes.json(그래픽 규칙) + phonemes(IPA/발음 특성 데이터)
// 출력: SVG 문자열. 그래픽은 PhoneticFeature로부터 규칙에 따라 생성되므로
//       graphemes.json의 path만 바꾸면 모양 교체가 가능하다.

const GLYPH = 50;
const PIVOT = 25;

const r2 = (n) => Math.round(n * 100) / 100;

function rotatePoint([x, y], deg) {
  const t = (deg * Math.PI) / 180;
  const dx = x - PIVOT;
  const dy = y - PIVOT;
  return [PIVOT + dx * Math.cos(t) - dy * Math.sin(t), PIVOT + dx * Math.sin(t) + dy * Math.cos(t)];
}

// 연결점은 "바닥선에 가까울수록" 우선한다 (y 가중치 1.5).
// 들어오는 점: 왼쪽 아래, 나가는 점: 오른쪽 아래.
const BASELINE_WEIGHT = 1.5;
const argmax = (points, score) => points.reduce((b, p) => (score(p) > score(b) + 0.01 ? p : b));

function pickEntry(points) {
  return argmax(points, ([x, y]) => -x + BASELINE_WEIGHT * y);
}

function pickExit(points) {
  return argmax(points, ([x, y]) => x + BASELINE_WEIGHT * y);
}

export function createScript(graphemes, phonemeData) {
  const { style, rules, consonantBases, vowelBases, vowelDiacritics } = graphemes;
  const consonants = new Map(phonemeData.consonants.map((c) => [c.id, c]));
  const vowels = new Map(phonemeData.vowels.map((v) => [v.id, v]));

  const cStroke = `fill="none" stroke="${style.consonantInk}" stroke-width="${style.strokeWidth}" stroke-linecap="${style.lineCap}" stroke-linejoin="${style.lineJoin}" vector-effect="non-scaling-stroke"`;
  const vStroke = `fill="none" stroke="${style.vowelInk}" stroke-width="${style.vowelStrokeWidth}" stroke-linecap="${style.lineCap}" stroke-linejoin="${style.lineJoin}" vector-effect="non-scaling-stroke"`;
  const ringStroke = `fill="none" stroke="${style.vowelInk}" stroke-width="${style.ringStrokeWidth}" vector-effect="non-scaling-stroke"`;
  const linkStroke = `fill="none" stroke="${style.consonantInk}" stroke-width="${style.connectorWidth}" stroke-linecap="round" vector-effect="non-scaling-stroke"`;

  // ---------- 자음 ----------
  function resolveConsonant(id) {
    const ph = consonants.get(id);
    if (!ph) throw new Error(`알 수 없는 자음: ${id}`);
    const baseKey = rules.placeToBase[ph.place];
    if (!baseKey) throw new Error(`조음 위치 매핑 없음: ${ph.place}`);
    const base = consonantBases[baseKey];
    const rotates = rules.laryngealRotation.appliesTo.includes(ph.manner);
    const rotation = rotates ? rules.laryngealRotation[ph.laryngeal] ?? 0 : 0;
    const mark = rules.mannerMark[ph.manner];
    if (mark === 'UNDECIDED') {
      throw new Error(`조음 방법 '${ph.manner}'의 표시 규칙이 아직 정해지지 않음 (${id})`);
    }
    return { ph, baseKey, base, rotation, mark, secondary: ph.secondary ?? null };
  }

  function consonantGlyph(id) {
    const { base, rotation, mark, secondary } = resolveConsonant(id);
    let inner = `<path d="${base.path}" ${cStroke}/>`;
    if (mark === 'nasal') {
      inner += `<circle cx="${base.marks.nasal.cx}" cy="${base.marks.nasal.cy}" r="3.5" fill="${style.consonantInk}"/>`;
    } else if (mark) {
      inner += `<path d="${base.marks[mark]}" ${cStroke}/>`;
    }
    let svg = rotation ? `<g transform="rotate(${rotation} ${PIVOT} ${PIVOT})">${inner}</g>` : inner;
    if (secondary) {
      const sec = rules.secondaryArticulation;
      const miniBase = consonantBases[sec.map[secondary]];
      svg += `<g transform="translate(${sec.offset[0]} ${sec.offset[1]}) scale(${sec.scale})"><path d="${miniBase.path}" ${cStroke}/></g>`;
    }
    const ports = base.ports.map((p) => rotatePoint(p, rotation));
    return { svg, entry: pickEntry(ports), exit: pickExit(ports), ringRadius: 0, width: GLYPH };
  }

  // ---------- 모음 ----------
  function vowelGlyph(id) {
    const ph = vowels.get(id);
    if (!ph) throw new Error(`알 수 없는 모음: ${id}`);
    const base = vowelBases[ph.base];
    let svg = `<circle cx="${base.ring[0]}" cy="${base.ring[1]}" r="${style.ringRadius}" ${ringStroke}/>`;
    svg += `<path d="${base.path}" ${vStroke}/>`;
    if (ph.long) svg += `<path d="${vowelDiacritics.long.path}" ${vStroke}/>`;
    if (ph.nasal) {
      const d = vowelDiacritics.nasal;
      svg += `<circle cx="${d.cx}" cy="${ph.long ? d.cyWithLength : d.cy}" r="${d.r}" fill="${style.vowelInk}"/>`;
    }
    return { svg, entry: base.ring, exit: base.exit, ringRadius: style.ringRadius, width: GLYPH };
  }

  // ---------- 배치 ----------
  const place = (g, x, y, s) => ({
    ...g,
    x, y, s,
    entryAbs: [x + g.entry[0] * s, y + g.entry[1] * s],
    exitAbs: [x + g.exit[0] * s, y + g.exit[1] * s],
    right: x + GLYPH * s,
  });

  const wrap = (p) =>
    `<g transform="translate(${r2(p.x)} ${r2(p.y)})${p.s !== 1 ? ` scale(${p.s})` : ''}">${p.svg}</g>`;

  function connector(from, to) {
    let [ex, ey] = from.exitAbs;
    let [nx, ny] = to.entryAbs;
    if (to.ringRadius) {
      // 연결선은 모음 고리의 테두리에서 멈춘다
      const len = Math.hypot(nx - ex, ny - ey) || 1;
      const rr = to.ringRadius * to.s;
      nx -= ((nx - ex) / len) * rr;
      ny -= ((ny - ey) / len) * rr;
    }
    const cx = ex + (nx - ex) * 0.6;
    return `<path d="M${r2(ex)} ${r2(ey)}Q${r2(cx)} ${r2(ey)} ${r2(nx)} ${r2(ny)}" ${linkStroke}/>`;
  }

  // 음절 하나 = { onset: [자음id...], nucleus: 모음id, coda: [자음id...] }
  function layoutSyllable({ onset = [], nucleus, coda = [] }) {
    const L = rules.blockLayout;
    const parts = [];
    const links = [];

    onset.forEach((id, i) => parts.push(place(consonantGlyph(id), i * L.consonantStep, 0, 1)));

    if (nucleus) {
      const cluster = onset.length >= 2;
      const v = cluster ? L.clusterVowel : L.singleOnsetVowel;
      const x = onset.length ? parts[parts.length - 1].right + L.vowelGap : 0;
      parts.push(place(vowelGlyph(nucleus), x, v.dy, v.scale));
    }

    coda.forEach((id, i) => {
      const s = L.coda.scale;
      const prev = parts[parts.length - 1];
      const x = i === 0 ? prev.right + L.coda.gap : prev.x + L.consonantStep * s;
      const y = L.coda.baselineAlign ? 44 - 44 * s : 0;
      parts.push(place(consonantGlyph(id), x, y, s));
    });

    if (L.connectWithinSyllable) {
      for (let i = 1; i < parts.length; i++) links.push(connector(parts[i - 1], parts[i]));
    }

    const width = Math.max(...parts.map((p) => p.right));
    return { svg: links.join('') + parts.map(wrap).join(''), width };
  }

  function layoutWord(syllables) {
    const gap = rules.blockLayout.syllableGap;
    let x = 0;
    let svg = '';
    for (const syl of syllables) {
      const block = layoutSyllable(syl);
      svg += `<g transform="translate(${r2(x)} 0)">${block.svg}</g>`;
      x += block.width + gap;
    }
    return { svg, width: Math.max(0, x - gap) };
  }

  // 독립 SVG 문서로 감싸기 (여백 포함)
  function toSVG(inner, width, { pad = 16, top = -22, bottom = 60, scale = 1 } = {}) {
    const vbX = -pad;
    const vbY = top - pad / 2;
    const vbW = width + pad * 2;
    const vbH = bottom - top + pad;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}" width="${r2(vbW * scale)}" height="${r2(vbH * scale)}">${inner}</svg>`;
  }

  return {
    consonantGlyph,
    vowelGlyph,
    layoutSyllable,
    layoutWord,
    toSVG,
    resolveConsonant,
    renderConsonant: (id, opts) => toSVG(consonantGlyph(id).svg, GLYPH, opts),
    renderVowel: (id, opts) => toSVG(vowelGlyph(id).svg, GLYPH, opts),
    renderSyllable: (syl, opts) => {
      const b = layoutSyllable(syl);
      return toSVG(b.svg, b.width, opts);
    },
    renderWord: (syls, opts) => {
      const w = layoutWord(syls);
      return toSVG(w.svg, w.width, opts);
    },
  };
}
