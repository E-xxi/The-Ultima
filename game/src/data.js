// 게임 데이터 불러오기와 검증. 검증은 브라우저와 테스트(Node)에서 같이 쓴다.
import {KINDS} from './state.js';
import {EFFECT_KINDS, parseEffect} from './story.js';
import {PUZZLE_TYPES} from './puzzles.js';
import {createLanguage} from './language.js';
import {createScript} from './script.js';
import {createScript as createRenderer} from './scriptRenderer.js';
import {diffKeys} from './stage0.js';

export const DATA_FILES = ['language', 'graphemes', 'phonemes', 'script', 'stage0', 'records', 'story', 'maps', 'puzzles'];

export async function loadData(baseUrl = 'data/') {
  const out = {};
  await Promise.all(DATA_FILES.map(async name => {
    const res = await fetch(baseUrl + name + '.json');
    if (!res.ok) throw new Error(name + '.json을 불러오지 못함 (' + res.status + ')');
    out[name] = await res.json();
  }));
  return out;
}

// 개발용 테스트 시작 지점 검증 (data/dev.json). 출시 빌드에는 이 파일이 없다.
export function validateDevStarts(d, dev) {
  const errs = [], ids = new Set();
  for (const s of dev.starts || []) {
    const where = `테스트 시작 '${s.id}'`, mp = d.maps.maps.find(m => m.id === s.map);
    if (ids.has(s.id)) errs.push(`${where}: id 중복`); ids.add(s.id);
    if (!mp || !mp.spawns[s.spawn]) errs.push(`${where}: 없는 장소/시작점 '${s.map}/${s.spawn}'`);
    if (typeof s.chapter !== 'number') errs.push(`${where}: 단계 번호가 없음`);
    for (const c of s.set || []) { const [kind, id] = c.split(':'); if (!KINDS[kind] || !id) errs.push(`${where}: 잘못된 상태 '${c}'`); }
  }
  if (!(dev.starts || []).length) errs.push('테스트 시작 지점이 없음');
  return errs;
}

const MODES = ['direct', 'relay', 'thought'];
const NPC_LOOKS = ['me', 'grandma', 'sibling', 'friendA', 'friendB', 'prof'];

// 문제 목록(문자열 배열)을 돌려준다. 비어 있으면 통과.
// opts.sprites: 그림 이름 목록, opts.photos: 사진 이름 목록 (있을 때만 검사)
export function validateData(d, opts = {}) {
  const errs = [], err = m => errs.push(m);
  const dupCheck = (label, ids) => { const s = new Set(); for (const id of ids) { if (s.has(id)) err(`${label}: id 중복 '${id}'`); s.add(id); } return s; };
  const story = d.story, maps = d.maps;

  // 언어
  dupCheck('기계 표기 첫소리', d.language.machine.initials.map(i => i.id));
  dupCheck('기계 표기 가운데소리', d.language.machine.medials.map(m => m.id));
  const morphs = dupCheck('형태소', d.language.speaker.morphemes.map(m => m.id));
  const lang = createLanguage(d.language);
  for (const m of d.language.speaker.morphemes) {
    if (!m.meaning) err(`형태소 '${m.id}': 뜻이 없음`);
    if (m.bits.length !== 7 || m.bits.some(r => r.length !== 7)) err(`형태소 '${m.id}': 모양이 7x7이 아님`);
    for (const s of m.sound) if (!lang.split(s)) err(`형태소 '${m.id}': 기계 표기로 쓸 수 없는 소리 '${s}'`);
  }

  // 범용 기록문자: 소리(phonemes)·글자 규칙(graphemes)은 0-1_game_script 원본 그대로, 시대·특수 발화(script)는 게임 쪽
  const S = d.script, P = d.phonemes;
  dupCheck('기록문자 자음', P.consonants.map(c => c.id)); dupCheck('기록문자 모음', P.vowels.map(v => v.id));
  for (const t of S.templates) if (!/^C*VC*$/.test(t)) err(`음절 틀 '${t}': 모음이 하나여야 함`);
  const markIds = new Set(['voiced', 'aspirated', 'ejective', 'labialized', 'palatalized', 'nasal', 'long']);
  dupCheck('기록문자 시대', S.eras.map(e => e.id));
  for (const e of S.eras) {
    for (const t of e.templates) if (!S.templates.includes(t)) err(`시대 '${e.id}': 없는 음절 틀 '${t}'`);
    for (const m of e.marks) if (!markIds.has(m)) err(`시대 '${e.id}': 없는 표시 '${m}'`);
  }
  const script = createScript(S, P, d.graphemes), renderer = createRenderer(d.graphemes, P);
  for (const ex of S.examples) {
    const syl = script.parseSyllable(ex.ipa);
    if (!syl) { err(`기록문자 예시 '${ex.ipa}': 읽을 수 없는 음절`); continue; }
    if (syl.template !== ex.template) err(`기록문자 예시 '${ex.ipa}': 틀 ${syl.template} ≠ ${ex.template}`);
    try { renderer.renderSyllable(script.toSpec(syl.segments)); } catch (e) { err(`기록문자 예시 '${ex.ipa}': ${e.message}`); }
  }
  dupCheck('특수 발화 기호', S.utterance.symbols.map(x => x.id));
  dupCheck('특수 발화 임시 표기', S.utterance.symbols.map(x => x.temp));
  for (const x of S.utterance.symbols) if ([...x.temp].length !== 1) err(`특수 발화 기호 '${x.id}': 임시 표기는 한 글자`);
  stage0Errs(d.stage0, P, renderer).forEach(err);

  // 해독 대상 면 (기록, 단어 모음집, 표)
  const R = d.records, surfaces = dupCheck('기록/모음집/표', [...R.records, ...R.booklets, ...R.tables].map(x => x.id));
  const morphRef = (where, id) => { if (!morphs.has(id)) err(`${where}: 없는 형태소 '${id}'`); };
  for (const r of R.records) {
    if (opts.photos && !opts.photos.includes(r.photo)) err(`기록 '${r.id}': 없는 사진 '${r.photo}'`);
    for (const ln of r.lines) for (const w of ln.words || []) for (const id of w) morphRef(`기록 '${r.id}'`, id);
  }
  for (const b of R.booklets) for (const e of b.entries) if (e.morpheme) morphRef(`모음집 '${b.id}'`, e.morpheme);
  for (const t of R.tables) for (const row of t.rows) if (row.handwritten) morphRef(`표 '${t.id}'`, row.handwritten);
  const afters = [...R.records, ...R.tables].filter(x => x.after);

  // 조건과 효과 검사 도구
  const mapIds = new Set(maps.maps.map(m => m.id));
  const spawnOK = (target) => { const [m, s] = target.split('/'); const mp = maps.maps.find(x => x.id === m); return mp && mp.spawns[s]; };
  const condOK = (where, cond) => {
    if (cond && !Array.isArray(cond) && typeof cond === 'object') {
      if (!Number.isInteger(cond.atleast) || !Array.isArray(cond.of) || cond.atleast > cond.of.length) err(`${where}: 잘못된 '이 중 N개 이상' 조건`);
      return condOK(where, cond.of);
    }
    for (const c of cond ? [].concat(cond) : []) {
      if (typeof c === 'object') { condOK(where, c); continue; }
      const [kind] = (c.startsWith('!') ? c.slice(1) : c).split(':');
      if (!KINDS[kind] || !c.includes(':')) err(`${where}: 잘못된 조건 '${c}'`);
    }
  };
  const puzzleIds = dupCheck('퍼즐', d.puzzles.puzzles.map(p => p.id));
  const effectOK = (where, e) => {
    const [kind, arg] = parseEffect(e);
    if (!EFFECT_KINDS.includes(kind)) return err(`${where}: 잘못된 효과 '${e}'`);
    if (kind === 'goto' && !spawnOK(arg)) err(`${where}: 없는 장소/시작점 '${arg}'`);
    if (kind === 'card' && !story.cards[arg]) err(`${where}: 없는 카드 '${arg}'`);
    if (kind === 'open_read' && !story.reads[arg]) err(`${where}: 없는 문서 '${arg}'`);
    if (kind === 'open_puzzle' && !puzzleIds.has(arg)) err(`${where}: 없는 퍼즐 '${arg}'`);
    if (kind === 'chapter_end' && !story.ui.chapter_end[arg]) err(`${where}: 없는 단계 끝 화면 '${arg}'`);
    if (kind === 'chapter' && Number.isNaN(Number(arg))) err(`${where}: 단계 번호가 아님 '${arg}'`);
    if (kind === 'say' && !story.dialogues[arg]) err(`${where}: 없는 대사 '${arg}'`);
  };

  // 대사
  for (const [id, variants] of Object.entries(story.dialogues)) {
    if (!Array.isArray(variants) || !variants.length) { err(`대사 '${id}': 변형이 없음`); continue; }
    variants.forEach((v, i) => {
      const where = `대사 '${id}' #${i + 1}`;
      condOK(where, v.when);
      for (const ln of v.lines) {
        if (!Array.isArray(ln) || ln.length !== 3) { err(`${where}: 대사 줄 형식이 틀림`); continue; }
        const [who, mode] = ln;
        if (who && !story.speakers[who]) err(`${where}: 없는 화자 '${who}'`);
        if (!MODES.includes(mode)) err(`${where}: 없는 말하기 방식 '${mode}'`);
      }
      for (const e of v.effects || []) effectOK(where, e);
      if (!v.lines.length && !(v.effects || []).length) err(`${where}: 대사도 효과도 없음`);
    });
  }
  for (const x of afters) if (!story.dialogues[x.after]) err(`'${x.id}': 없는 대사 '${x.after}'`);

  // 받은 아이템: 아이콘 그림, 생기는 조건, 쓰임(지금은 문서 열기만), 단축키
  dupCheck('아이템', (story.items || []).map(x => x.id));
  for (const it of story.items || []) {
    const where = `아이템 '${it.id}'`;
    condOK(where, it.when);
    if (opts.sprites && !opts.sprites.includes(it.icon)) err(`${where}: 없는 아이콘 '${it.icon}'`);
    const [k, ref] = (it.use || '').split(':');
    if (k !== 'read' || !story.reads[ref]) err(`${where}: 잘못된 use '${it.use}'`);
    if (!it.label) err(`${where}: 이름(label)이 없음`);
  }

  // 꺼내 읽는 문서: 일기장은 날짜와 내용이 있는 쪽들, 그 밖의 문서는 머리말이 있어야 한다
  for (const [id, doc] of Object.entries(story.reads)) {
    if (doc.style === 'diary') {
      if (!Array.isArray(doc.pages) || !doc.pages.length) err(`문서 '${id}': 일기 쪽이 없음`);
      else doc.pages.forEach((p, i) => { if (!p.date || !Array.isArray(p.lines) || !p.lines.length) err(`문서 '${id}' ${i + 1}쪽: 날짜나 내용이 없음`); });
      if (!story.ui.diary) err('화면 문구(ui.diary)가 없음');
    } else if (!Array.isArray(doc.head)) err(`문서 '${id}': 머리말(head)이 없음`);
    if (doc.after && !story.dialogues[doc.after]) err(`문서 '${id}': 없는 대사 '${doc.after}'`);
    for (const sec of doc.sections || []) for (const syl of sec.machine_line || []) if (!lang.split(syl)) err(`문서 '${id}': 기계 표기로 쓸 수 없는 소리 '${syl}'`);
  }

  condOK('특수 발화 해금 조건', d.script.utterance.unlock);

  // 퍼즐
  for (const p of d.puzzles.puzzles) {
    if (!PUZZLE_TYPES[p.type]) err(`퍼즐 '${p.id}': 없는 유형 '${p.type}'`);
    condOK(`퍼즐 '${p.id}'`, p.requires);
    for (const e of p.on_solve || []) effectOK(`퍼즐 '${p.id}'`, e);
    if (p.record && !surfaces.has(p.record)) err(`퍼즐 '${p.id}': 없는 기록 '${p.record}'`);
    for (const w of p.words || []) for (const s of w) if (!lang.split(s)) err(`퍼즐 '${p.id}': 기계 표기로 쓸 수 없는 소리 '${s}'`);
    if (!story.ui[p.id]) err(`퍼즐 '${p.id}': 화면 문구(ui.${p.id})가 없음`);
    if (p.after && !story.dialogues[p.after]) err(`퍼즐 '${p.id}': 없는 대사 '${p.after}'`);
    if (p.type === 'stage0_practice' && !story.ui[p.id]?.rules) err(`퍼즐 '${p.id}': 규칙 문장(ui.${p.id}.rules)이 없음`);
  }

  // 맵과 문
  dupCheck('맵', maps.maps.map(m => m.id));
  for (const [id, door] of Object.entries(maps.doors)) {
    if (!spawnOK(door.to)) err(`문 '${id}': 없는 장소/시작점 '${door.to}'`);
    if (!story.dialogues[door.locked]) err(`문 '${id}': 없는 잠김 대사 '${door.locked}'`);
    condOK(`문 '${id}'`, door.when);
  }
  if (!spawnOK(maps.start.map + '/' + maps.start.spawn)) err('시작 장소/시작점이 없음');
  if (maps.start.card && !story.cards[maps.start.card]) err(`시작 카드 '${maps.start.card}'가 없음`);
  for (const m of maps.maps) {
    const where = `맵 '${m.id}'`, [W, H] = m.size;
    if (m.tiles.length !== H || m.tiles.some(r => r.length !== W)) err(`${where}: 타일 크기가 ${W}x${H}이 아님`);
    for (const r of m.tiles) for (const ch of r) if (!maps.legend[ch]) { err(`${where}: 모르는 타일 '${ch}'`); break; }
    for (const [k, [x, y]] of Object.entries(m.spawns)) if (x < 0 || y < 0 || x >= W * 16 || y >= H * 16) err(`${where}: 시작점 '${k}'이 맵 밖`);
    if (m.on_enter) { const [k, id] = m.on_enter.split(':'); if (k !== 'dialogue' || !story.dialogues[id]) err(`${where}: 잘못된 on_enter '${m.on_enter}'`); }
    dupCheck(where + ' 물건', m.objects.filter(o => o.id).map(o => o.id));
    for (const o of m.objects) {
      const ow = `${where} 물건 '${o.id || o.sprite}'`;
      if (opts.sprites && o.sprite && !opts.sprites.includes(o.sprite)) err(`${ow}: 없는 그림 '${o.sprite}'`);
      if (o.npc && !NPC_LOOKS.includes(o.npc)) err(`${ow}: 없는 인물 모습 '${o.npc}'`);
      for (const si of o.sprite_if || []) { condOK(ow, si.when); if (opts.sprites && !opts.sprites.includes(si.sprite)) err(`${ow}: 없는 그림 '${si.sprite}'`); }
      if (o.use) {
        const [k, ref] = o.use.split(':');
        const ok = k === 'dialogue' ? story.dialogues[ref] : k === 'read' ? story.reads[ref] : k === 'inspect' ? surfaces.has(ref) : k === 'door' ? maps.doors[ref] : false;
        if (!ok) err(`${ow}: 잘못된 use '${o.use}'`);
        if (!o.hit) err(`${ow}: use가 있는데 hit이 없음`);
      }
    }
  }
  return errs;
}

// 0단계 출발 전 연습(stage0.json): 단어의 소리가 모두 소리 목록에 있고 그릴 수 있어야 하며,
// 비교 라운드마다 두 단어가 달라진 자리의 글자가 '공개 글자'와 맞아야 한다(공개 글자 + 그때까지 아는 글자 = 달라진 글자).
function stage0Errs(S, P, renderer) {
  const errs = [], err = m => errs.push('0단계 연습 ' + m);
  const ids = new Set([...P.consonants, ...P.vowels].map(x => x.id));
  for (const [w, syls] of Object.entries(S.words)) {
    for (const syl of syls) for (const id of [...(syl.onset || []), syl.nucleus, ...(syl.coda || [])]) if (!ids.has(id)) err(`단어 '${w}': 없는 소리 '${id}'`);
    try { renderer.renderWord(syls); } catch (e) { err(`단어 '${w}': ${e.message}`); }
  }
  for (const id of [...S.knownAtStart, ...S.notebookOrder]) if (!S.letters[id]) err(`글자 '${id}': letters에 없음`);
  for (const id of Object.keys(S.letters)) if (!ids.has(id)) err(`글자 '${id}': 소리 목록에 없음`);
  const word = (w, where) => { if (!S.words[w]) { err(`${where}: 없는 단어 '${w}'`); return false; } return true; };
  const known = new Set(S.knownAtStart);
  S.compare.forEach((r, i) => {
    const at = `비교 ${i + 1} (${r.a}/${r.b})`;
    if (!word(r.a, at) || !word(r.b, at)) return;
    const keys = diffKeys(S.words[r.a], S.words[r.b]);
    if (!keys.length) { err(`${at}: 두 단어의 글자가 같음`); return; }
    const changed = new Set(keys.flatMap(k => [...[r.a, r.b].map(w => partOf(S.words[w], k))]).filter(Boolean));
    for (const id of r.reveal) if (!changed.has(id)) err(`${at}: 공개 글자 '${id}'가 달라진 자리에 없음`);
    for (const id of changed) if (!known.has(id) && !r.reveal.includes(id)) err(`${at}: 달라진 글자 '${id}'를 공개하지 않음`);
    r.reveal.forEach(id => known.add(id));
  });
  S.read.forEach((q, i) => {
    const at = `읽기 ${i + 1} (${q.word})`;
    if (!word(q.word, at)) return;
    if (!q.options.includes(q.word)) err(`${at}: 보기에 정답이 없음`);
    if (new Set(q.options).size !== q.options.length) err(`${at}: 보기가 겹침`);
    q.options.forEach(o => word(o, at) && o !== q.word && !diffKeys(S.words[q.word], S.words[o]).length && err(`${at}: 보기 '${o}'가 정답과 같은 기록`));
  });
  for (const w of S.write) if (word(w, `쓰기 '${w}'`)) {
    for (const syl of S.words[w]) if ((syl.onset || []).length !== 1 || (syl.coda || []).length > 1) err(`쓰기 '${w}': 칸은 첫소리 1·모음·받침 0~1만`);
    for (const id of partsList(S.words[w])) if (!known.has(id)) err(`쓰기 '${w}': 연습에서 배우지 않은 글자 '${id}'`);
  }
  return errs;
}
const partOf = (syls, key) => { const [si, slot] = key.split(':'), s = syls[+si]; if (!s) return null; const m = slot.match(/^(onset|coda)(\d)$/); return m ? s[m[1]]?.[+m[2]] ?? null : s.nucleus; };
const partsList = syls => syls.flatMap(s => [...(s.onset || []), s.nucleus, ...(s.coda || [])]);
