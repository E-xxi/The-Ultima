// 사용법: node tools/build-assets.mjs
// data/*.json → assets/svg/*.svg + preview/specimen.html 생성
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScript } from '../src/scriptRenderer.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const graphemes = JSON.parse(readFileSync(join(root, 'data/graphemes.json'), 'utf8'));
const phonemes = JSON.parse(readFileSync(join(root, 'data/phonemes.sample.json'), 'utf8'));
const script = createScript(graphemes, phonemes);

const out = join(root, 'assets/svg');
rmSync(out, { recursive: true, force: true });
for (const d of ['consonants', 'vowels', 'syllables']) mkdirSync(join(out, d), { recursive: true });

// 파일명에 IPA 기호를 그대로 쓰지 않도록 안전한 이름으로 변환
const safe = (s) =>
  s.replace(/ʼ/g, '_ej').replace(/ʰ/g, '_h').replace(/ʷ/g, '_w').replace(/ʲ/g, '_j')
   .replace(/ː/g, '_long').replace(/ã/g, 'a_nas').replace(/ʌ/g, 'turned_v')
   .replace(/ɕ/g, 'c').replace(/ʑ/g, 'z').replace(/[^\w-]/g, '_');

const manifest = { consonants: {}, vowels: {}, syllables: {} };

for (const c of phonemes.consonants) {
  const file = `consonants/${safe(c.id)}.svg`;
  writeFileSync(join(out, file), script.renderConsonant(c.id));
  const g = script.consonantGlyph(c.id);
  const r = script.resolveConsonant(c.id);
  manifest.consonants[c.id] = {
    file, base: r.baseKey, rotation: r.rotation, mark: r.mark, secondary: r.secondary,
    entry: g.entry.map((n) => Math.round(n * 100) / 100),
    exit: g.exit.map((n) => Math.round(n * 100) / 100),
  };
}
for (const v of phonemes.vowels) {
  const file = `vowels/${safe(v.id)}.svg`;
  writeFileSync(join(out, file), script.renderVowel(v.id));
  const g = script.vowelGlyph(v.id);
  manifest.vowels[v.id] = { file, ring: g.entry, exit: g.exit };
}
for (const s of phonemes.sampleSyllables) {
  const file = `syllables/${safe(s.ipa)}.svg`;
  writeFileSync(join(out, file), script.renderSyllable(s));
  manifest.syllables[s.ipa] = { file, label: s.label };
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));

// ---------- 견본 시트 ----------
const cell = (svg, cap, sub = '') =>
  `<figure><div class="g">${svg}</div><figcaption>${cap}${sub ? `<span>${sub}</span>` : ''}</figcaption></figure>`;
const big = { scale: 1.6 };
const C = (id, sub) => cell(script.renderConsonant(id, big), `/${id}/`, sub);
const V = (id, sub) => cell(script.renderVowel(id, big), `/${id}/`, sub);
const B = graphemes.consonantBases;

const baseCells = Object.entries(B).map(([k, b]) =>
  cell(script.toSVG(`<path d="${b.path}" fill="none" stroke="${graphemes.style.consonantInk}" stroke-width="${graphemes.style.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`, 50, big), b.label, b.reference.replace('이누크티투트 ', '')));

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>THE Ultima 기록문자 견본 v${graphemes.meta.version}</title>
<style>
body{margin:0;padding:40px 48px;background:#F6F3EC;color:#2C2C2A;font-family:"Noto Sans KR","Apple SD Gothic Neo",sans-serif}
header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.5px solid #2C2C2A;padding-bottom:12px;margin-bottom:8px}
h1{font-size:26px;font-weight:600;margin:0;letter-spacing:-.01em}
.tag{font-size:12px;color:#8A6A2E;border:1px solid #BA7517;border-radius:4px;padding:2px 8px}
h2{font-size:15px;font-weight:600;margin:30px 0 4px}
p.rule{font-size:13px;color:#5F5E5A;margin:0 0 12px}
.row{display:flex;flex-wrap:wrap;gap:14px}
figure{margin:0;background:#FFFDF8;border:1px solid #E3DED2;border-radius:8px;padding:10px 12px 8px;display:flex;flex-direction:column;align-items:center}
.g svg{display:block}
figcaption{font-size:14px;margin-top:4px;text-align:center}
figcaption span{display:block;font-size:11px;color:#888780;margin-top:2px}
footer{margin-top:36px;font-size:12px;color:#888780;border-top:1px solid #E3DED2;padding-top:10px}
</style></head><body>
<header><h1>THE Ultima · 범용 기록문자 견본</h1><span class="tag">v${graphemes.meta.version} · 임시 그래픽</span></header>

<h2>1. 자음 기본 획 = 조음 위치</h2>
<p class="rule">이누크티투트 음절문자의 p·t·g·k·q 계열 모양을 참고. 안쪽(목 쪽)일수록 고리가 늘어난다.</p>
<div class="row">${baseCells.join('')}</div>

<h2>2. 회전 = 후두 특성 (장애음만)</h2>
<p class="rule">0° 기본 · 90° 유성 · 180° 유기 · 270° 방출. 공명음은 회전하지 않는다.</p>
<div class="row">${['k', 'g', 'kʰ', 'kʼ'].map((id, i) => C(id, ['기본 0°', '유성 90°', '유기 180°', '방출 270°'][i])).join('')}
${['t', 'd', 'tʰ', 'tʼ'].map((id, i) => C(id, ['기본 0°', '유성 90°', '유기 180°', '방출 270°'][i])).join('')}</div>

<h2>3. 조음 방법 = 획 끝 표시</h2>
<p class="rule">파열 무표 · 비음 끝 점 · 마찰 평행 획 · 접근 끝 말림. 유음(l, r) 등은 미정.</p>
<div class="row">${C('t', '파열')}${C('n', '비음')}${C('s', '마찰')}${C('z', '유성 마찰')}${C('m', '비음')}${C('w', '접근')}${C('j', '접근')}</div>

<h2>4. 2차 조음 = 기본 획 축소 부착</h2>
<p class="rule">해당 위치의 기본 획을 40%로 줄여 오른쪽 위에 붙인다 (회전하지 않음).</p>
<div class="row">${C('kʷ', '순음화')}${C('tʲ', '구개음화')}</div>

<h2>5. 모음 = 고리 + 라틴 글자</h2>
<p class="rule">모든 모음은 고리에서 시작한다. 자음에는 고리가 없다. 비음은 위 점, 장음은 윗줄.</p>
<div class="row">${['a', 'e', 'i', 'o', 'u', 'ʌ'].map((id) => V(id)).join('')}${V('ã', '비음')}${V('aː', '장음')}${V('ãː', '비음 장음')}</div>

<h2>6. 음절 블록 = 자음 수만큼 길어지고, 한 음절은 이어 쓴다</h2>
<p class="rule">자음→자음은 바닥선에서, 자음→모음은 고리로, 모음→받침은 획 끝에서 연결. 음절 사이는 끊는다. 받침은 60% 작은 꼴.</p>
<div class="row">${phonemes.sampleSyllables.map((s) => cell(script.renderSyllable(s, big), `/${s.ipa}/`, s.label)).join('')}</div>

<h2>7. 단어</h2>
<div class="row">${cell(script.renderWord(phonemes.sampleSyllables.slice(0, 2), { scale: 2 }), '/dʑi.wʌn/', '지원 — 음절 사이는 끊김')}</div>

<footer>${graphemes.meta.note}</footer>
</body></html>`;
mkdirSync(join(root, 'preview'), { recursive: true });
writeFileSync(join(root, 'preview/specimen.html'), html);
console.log('consonants', Object.keys(manifest.consonants).length, 'vowels', Object.keys(manifest.vowels).length, 'syllables', Object.keys(manifest.syllables).length);
