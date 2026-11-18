// 캔버스 위에 뜨는 화면들(대화, 노트, 서류, 퍼즐, 시작·끝 화면). 문구는 story.json에서 받는다.
// 상태를 직접 바꾸지 않고, 바꿀 일이 생기면 main.js가 넘겨준 콜백을 부른다.
import {PAGES, CELLS} from './state.js';

export const $ = id => document.getElementById(id);
const make = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

export function pieceCanvas(art, w, h, draw, px) {
  const c = art.mk(w, h); draw(c.getContext('2d')); c.style.width = w * px + 'px'; c.style.height = h * px + 'px'; return c;
}
export function glyphCanvas(art, lang, q, col) {
  const w = lang.width(q) + 2, c = art.mk(9, 9);
  art.drawQ(c.getContext('2d'), {...q, x: Math.floor((9 - w) / 2) + 1, y: 1}, col);
  return c;
}

/* ---------- 서류: 읽을거리와 사전 기록지 ---------- */
function machineTable(root, art, lang) {
  const {PAL} = art;
  const sec = (title, items) => {
    root.append(make('h3', '', title));
    const row = make('div', 'row');
    for (const [cnv, label] of items) { const d = make('div', 'part'); d.append(cnv, label); row.appendChild(d); }
    root.appendChild(row);
  };
  sec('첫소리 조각', lang.initials.map(i => [pieceCanvas(art, 4, 4, g => art.drawBits(g, i.bits, 0, 0, PAL.print), 5), i.jamo]));
  sec('가운데소리 조각', lang.medials.map(m => [pieceCanvas(art, 7, 7, g => {
    g.fillStyle = 'rgba(59,91,138,.18)'; g.fillRect(m.vertical ? 0 : 1, m.vertical ? 1 : 0, 4, 4);
    art.drawBits(g, lang.blockBits(null, m.id), 0, 0, PAL.print);
  }, 4), m.jamo]));
  sec('보기', ['na', 'so', 'hi', 'yo'].map(s => [pieceCanvas(art, 7, 7, g => art.drawBits(g, lang.machineBits(s), 0, 0, PAL.print), 5), lang.hangul(s)]));
}
// 일기장: 펼친 책(넓은 화면은 양면, 좁은 화면은 한 면). 날짜 한 개가 한 쪽. 돌려주는 {turn, atEnd}로 장을 넘긴다.
function renderDiary(sheet, doc, txt, closeLabel, onClose) {
  sheet.textContent = ''; sheet.className = 'diarybook';
  const spread = make('div', 'spread'), left = make('div', 'dpage left'), right = make('div', 'dpage right');
  spread.append(left, right);
  const nav = make('div', 'dnav'), prev = make('button', 'dturn', '◀'), next = make('button', 'dturn', '▶'), num = make('span', 'dno'), close = make('button', 'act', closeLabel);
  prev.type = next.type = close.type = 'button'; prev.setAttribute('aria-label', txt.prev); next.setAttribute('aria-label', txt.next);
  nav.append(prev, num, next, close);
  sheet.append(spread, nav);
  const pages = doc.pages, per = () => (window.innerWidth >= 720 ? 2 : 1);
  let i = 0, busy = false;
  function fill(el, entry, n) {
    el.textContent = ''; el.classList.toggle('blank', !entry);
    if (!entry) return;
    const body = make('div', 'dbody'); for (const l of entry.lines) body.appendChild(make('p', '', l));
    el.append(make('div', 'ddate', entry.date), body, make('div', 'dnum', String(n)));
  }
  function render() {
    const p = per(); i -= i % p;
    right.hidden = p === 1; spread.classList.toggle('single', p === 1);
    fill(left, pages[i], i + 1); if (p === 2) fill(right, pages[i + 1], i + 2);
    prev.disabled = i === 0; next.disabled = i + p >= pages.length;
    num.textContent = Math.floor(i / p) + 1 + ' / ' + Math.ceil(pages.length / p);
  }
  function turn(d) {
    const p = per(), ni = i + d * p;
    if (busy || ni < 0 || ni >= pages.length) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { i = ni; return render(); }
    busy = true;
    const out = d > 0 && p === 2 ? right : left, inn = d < 0 && p === 2 ? right : left;
    out.classList.add(d > 0 ? 'out-next' : 'out-prev');
    setTimeout(() => {
      out.classList.remove('out-next', 'out-prev'); i = ni; render();
      inn.classList.add(d > 0 ? 'in-next' : 'in-prev');
      setTimeout(() => { inn.classList.remove('in-next', 'in-prev'); busy = false; }, 220);
    }, 220);
  }
  prev.addEventListener('click', () => turn(-1)); next.addEventListener('click', () => turn(1)); close.addEventListener('click', onClose);
  render();
  return {turn, atEnd: () => i + per() >= pages.length};
}

// 학습 창: 한 쪽씩 넘기며 배운다. 쪽마다 제목, 설명, 조각표(table), 보기 낱말(examples). 돌려주는 {turn, atEnd}로 넘긴다.
function renderLesson(sheet, doc, art, lang, txt, closeLabel, onClose) {
  const pages = doc.pages;
  let i = 0;
  function render() {
    const pg = pages[i];
    sheet.textContent = ''; sheet.className = 'sheet doc-lesson';
    const head = make('div', 'shead'); head.append(make('span', '', doc.head[0]), make('span', '', doc.head[1] || ''));
    sheet.append(head, make('h1', '', pg.title));
    for (const p of pg.paragraphs || []) sheet.appendChild(make('p', '', p));
    if (pg.table) {
      const row = make('div', 'ltable'), list = pg.table === 'initials' ? lang.initials : lang.medials;
      for (const p of list) {
        const cell = make('div', 'part');
        cell.append(pg.table === 'initials'
          ? pieceCanvas(art, 4, 4, g => art.drawBits(g, p.bits, 0, 0, art.PAL.print), 7)
          : pieceCanvas(art, 7, 7, g => { g.fillStyle = 'rgba(59,91,138,.18)'; g.fillRect(p.vertical ? 0 : 1, p.vertical ? 1 : 0, 4, 4); art.drawBits(g, lang.blockBits(null, p.id), 0, 0, art.PAL.print); }, 5),
          make('span', '', p.jamo));
        row.appendChild(cell);
      }
      sheet.appendChild(row);
    }
    if (pg.examples) {
      const ex = make('div', 'lexamples');
      for (const word of pg.examples) {
        const f = make('figure'), blocks = make('div', 'lblocks');
        for (const syl of word) blocks.appendChild(pieceCanvas(art, 7, 7, g => art.drawBits(g, lang.machineBits(syl), 0, 0, art.PAL.mInk), 7));
        f.append(blocks, make('figcaption', '', word.map(lang.hangul).join('')));
        ex.appendChild(f);
      }
      sheet.appendChild(ex);
    }
    const nav = make('div', 'sfoot lnav'), prev = make('button', 'dturn', '◀'), next = make('button', 'dturn', '▶'), num = make('span', 'dno', (i + 1) + ' / ' + pages.length);
    const close = make('button', 'act', closeLabel);
    prev.type = next.type = close.type = 'button'; prev.disabled = i === 0; next.disabled = i === pages.length - 1;
    prev.setAttribute('aria-label', txt.prev); next.setAttribute('aria-label', txt.next);
    prev.addEventListener('click', () => turn(-1)); next.addEventListener('click', () => turn(1)); close.addEventListener('click', onClose);
    const pager = make('div', 'pager'); pager.append(prev, num, next);
    nav.append(pager, close); sheet.appendChild(nav);
  }
  function turn(d) { const ni = i + d; if (ni < 0 || ni >= pages.length) return; i = ni; render(); }
  render();
  return {turn, atEnd: () => i >= pages.length - 1};
}

export function renderDoc(sheet, doc, art, lang, closeLabel, onClose, txt) {
  if (doc.style === 'diary') return renderDiary(sheet, doc, txt.diary, closeLabel, onClose);
  if (doc.style === 'lesson') return renderLesson(sheet, doc, art, lang, txt.lesson, closeLabel, onClose);
  sheet.textContent = '';
  // 'doc-' 접두어: 문서 모양 이름(book 등)이 노트(.book) 같은 다른 화면의 클래스와 겹치지 않게
  sheet.className = 'sheet' + (doc.style ? ' doc-' + doc.style : '');
  const head = make('div', 'shead'); head.append(make('span', '', doc.head[0]), make('span', '', doc.head[1] || '')); sheet.appendChild(head);
  if (doc.title) sheet.appendChild(make('h1', '', doc.title));
  if (doc.fields) { const dl = make('dl', 'meta'); for (const [k, v] of doc.fields) dl.append(make('dt', '', k), make('dd', '', v)); sheet.appendChild(dl); }
  const paras = (list, parent) => { for (const p of list || []) parent.appendChild(make('p', '', p)); };
  if (doc.style === 'diary') { const hand = make('div', 'hand'); paras(doc.paragraphs, hand); sheet.appendChild(hand); } else paras(doc.paragraphs, sheet);
  if (doc.flow) { const f = make('div', 'flow'); doc.flow.forEach((s, i) => { if (i) f.appendChild(make('i', '', '→')); f.appendChild(make('span', '', s)); }); sheet.appendChild(f); }
  if (doc.timeline) { const ol = make('ol', 'tl'); for (const [when, what] of doc.timeline) { const li = make('li'); li.append(make('b', '', when), what); ol.appendChild(li); } sheet.appendChild(ol); }
  for (const sec of doc.sections || []) {
    sheet.appendChild(make('h2', '', sec.title)); paras(sec.paragraphs, sheet);
    if (sec.machine_table) { const t = make('div', 'dict'); machineTable(t, art, lang); sheet.appendChild(t); }
    // 기계 고유 표기 한 줄 (띄어쓰기 없이 소리만)
    if (sec.machine_line) {
      const line = make('div', 'mline');
      for (const syl of sec.machine_line) line.appendChild(pieceCanvas(art, 7, 7, g => art.drawBits(g, lang.machineBits(syl), 0, 0, '#9fe8dc'), 6));
      sheet.appendChild(line);
    }
  }
  if (doc.note) sheet.appendChild(make('p', 'note', doc.note));
  const foot = make('div', 'sfoot'), btn = make('button', 'act', closeLabel);
  btn.type = 'button'; btn.addEventListener('click', onClose);
  foot.append(doc.stamp ? make('span', 'stamp', doc.stamp) : make('span'), btn); sheet.appendChild(foot);
  return null;
}

/* ---------- 대화창 ---------- */
// 직접(가족)·중계기(그 밖의 사람)·혼잣말. 중계기 대사는 '· · ·' 뒤에 한 글자씩 나온다.
export function createDialogue(story) {
  const box = $('dlg'), who = $('dlgwho'), mode = $('dlgmode'), text = $('dlgtext');
  let cur = null;
  function show() {
    const [sp, md, t] = cur.lines[cur.i];
    box.className = 'dlg ' + md; box.hidden = false;
    who.textContent = sp ? story.speakers[sp] : ''; who.hidden = !sp;
    const label = (story.ui.modes || {})[md] || '';   // 표시 문구는 story.json ui.modes. 비어 있으면 숨긴다
    mode.textContent = label; mode.hidden = !label;
    cur.typed = md === 'relay' ? -8 : t.length; cur.tick = 0;
    text.textContent = md === 'relay' ? '· · ·' : t;
  }
  return {
    get active() { return !!cur; },
    open(lines, onEnd) { if (!lines.length) { onEnd(); return; } cur = {lines, i: 0, onEnd}; show(); },
    tick(dt) {
      if (!cur) return;
      const t = cur.lines[cur.i][2];
      if (cur.typed >= t.length) return;
      cur.tick += dt * 34;
      while (cur.tick >= 1 && cur.typed < t.length) { cur.tick -= 1; cur.typed++; }
      text.textContent = cur.typed <= 0 ? '· · ·' : t.slice(0, cur.typed);
    },
    advance() {
      const t = cur.lines[cur.i][2];
      if (cur.typed < t.length) { cur.typed = t.length; text.textContent = t; return; }
      cur.i++;
      if (cur.i < cur.lines.length) return show();
      const end = cur.onEnd; cur = null; box.hidden = true; end();
    },
    reset() { cur = null; box.hidden = true; },
  };
}

/* ---------- 노트 (플레이어의 추측) ---------- */
// 칸을 누르면 그 글자를 고르고(sel), 메모 위에 추측 칸이 열린다. 추측은 글자마다 하나(guesses['s:tree']).
// actions: {select(i), page(n)}, txt: story.json ui.notebook
// sounds: 대조를 마쳐 소리가 밝혀진 기호 ('s:tree' → '오마'). 칸에 파란 글씨로 적는다.
export function renderNotebook(nb, art, lang, actions, forwardText, guesses, sel, txt, sounds = {}) {
  // 맨 위 네모 다섯 개 = 1~5장. 지금 장은 채워지고, 적은 게 있는 장은 옅게 칠해진다.
  const tabs = $('ptabs'); tabs.textContent = '';
  for (let n = 0; n < PAGES; n++) {
    const pg = nb.pages[n], b = make('button', (n === nb.cur ? 'on' : '') + (pg.g.length || pg.t ? ' used' : ''), String(n + 1));
    b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(n === nb.cur)); b.setAttribute('aria-label', (n + 1) + txt.page);
    b.addEventListener('click', () => actions.page(n));
    tabs.appendChild(b);
  }
  const fwd = $('fwd'); fwd.hidden = !forwardText; fwd.textContent = forwardText || '';
  const cells = $('cells'), p = nb.pages[nb.cur];
  cells.textContent = '';
  for (let i = 0; i < CELLS; i++) {
    const b = make('button', 'cell'); b.type = 'button';
    const q = p.g[i];
    if (q) {
      const guess = guesses[q.k + ':' + q.id];
      b.classList.add('full'); if (i === sel) b.classList.add('sel');
      b.appendChild(glyphCanvas(art, lang, q, art.PAL.ink));
      const sound = sounds[q.k + ':' + q.id];
      if (sound) b.appendChild(make('span', 'gsound', sound));
      if (guess) b.appendChild(make('span', 'gtext', guess));
      b.setAttribute('aria-label', guess ? txt.cell_with_guess + ' ' + guess : txt.cell);
      b.addEventListener('click', () => actions.select(i));
    } else { b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
    cells.appendChild(b);
  }
  // 고른 글자의 추측 칸
  const row = $('guessrow'), input = $('guess'), q = p.g[sel];
  row.hidden = !q;
  if (q) {
    const holder = $('guessglyph'); holder.textContent = ''; holder.appendChild(glyphCanvas(art, lang, q, art.PAL.ink));
    input.placeholder = txt.guess_placeholder; $('guessdel').textContent = txt.remove;
    if (document.activeElement !== input) input.value = guesses[q.k + ':' + q.id] || '';
  }
  const memo = $('memo');
  if (document.activeElement !== memo) memo.value = p.t;
}
// 메모 한 줄 = 한글 MEMO_LINE_CHARS자. 손글씨 폰트로 실제 글자 너비를 재서 메모 칸 너비를 맞춘다(폰트를 불러온 뒤 다시 잰다).
export const MEMO_LINE_CHARS = 10;
export function fitMemoWidth() {
  const ta = $('memo');
  if (typeof getComputedStyle !== 'function') return;
  const st = getComputedStyle(ta), g = document.createElement('canvas').getContext('2d');
  if (!g || !g.measureText) return;
  g.font = `${st.fontStyle} ${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
  const w = g.measureText('가'.repeat(MEMO_LINE_CHARS)).width;
  if (w > 0) ta.style.width = Math.ceil(w) + 2 + 'px';
}
export function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

/* ---------- 퍼즐: 기록 장치 표기 읽기 ---------- */
let practiceToken = null;
// 칸마다 첫소리·가운데소리 조각을 고른다. onStep(w, b, pick) → 맞으면 true. 모두 맞히면 onDone().
// puzzle.show_jamo면 조각 아래에 소리(ㅎ, ㅏ…)를 적어 준다(처음 배우는 자리). txt.style이 있으면 그 모양(doc-device 등)으로 그린다.
// puzzle.intro_text가 있으면 그 글자(예: 로마자)를 먼저 잠깐 보여 준 뒤 기계 표기로 스르륵 바꾼다.
export function openPractice(puzzle, art, lang, txt, solved, onStep, onDone, onClose) {
  const st = {w: 0, b: 0, c: null, v: null, done: solved, intro: !!puzzle.intro_text && !solved, fading: false, morph: false};
  const token = practiceToken = {};   // 닫았다 다시 열면 앞 화면의 타이머가 새 화면을 덮어쓰지 않게
  const later = (ms, fn) => setTimeout(() => { if (practiceToken === token) fn(); }, ms);
  if (st.intro) later(1400, () => {
    st.fading = true; render();
    later(450, () => { st.intro = false; st.morph = true; render(); later(900, () => { st.morph = false; }); });
  });
  if (solved) { st.w = puzzle.words.length - 1; st.b = puzzle.words[st.w].length; }
  const sheet = $('practicesheet');
  function render() {
    sheet.textContent = ''; sheet.className = 'sheet' + (txt.style ? ' doc-' + txt.style : '');
    const progress = st.done ? txt.done : puzzle.words.length > 1 ? (st.w + 1) + ' / ' + puzzle.words.length : txt.head[1] || '';
    const head = make('div', 'shead'); head.append(make('span', '', txt.head[0]), make('span', '', progress));
    sheet.appendChild(head);
    if (txt.fields) { const dl = make('dl', 'meta'); for (const [k, v] of txt.fields) dl.append(make('dt', '', k), make('dd', '', v)); sheet.appendChild(dl); }
    sheet.appendChild(make('h1', '', txt.title));
    const word = make('div', 'pword'); word.id = 'pword';
    if (st.intro) word.appendChild(make('div', 'romaji' + (st.fading ? ' fading' : ''), puzzle.intro_text));
    else puzzle.words[st.w].forEach((sy, i) => {
      const f = make('figure', (!st.done && i === st.b ? 'cur' : '') + (st.morph ? ' morph' : ''));
      if (st.morph) f.style.animationDelay = i * 90 + 'ms';
      f.appendChild(pieceCanvas(art, 7, 7, g => art.drawBits(g, lang.machineBits(sy), 0, 0, txt.style === 'device' ? '#9fe8dc' : art.PAL.mInk), 8));
      f.appendChild(make('figcaption', '', i < st.b || st.done ? lang.hangul(sy) : ' '));
      word.appendChild(f);
    });
    sheet.appendChild(word);
    const pieces = (title, list, key, canvas) => {
      sheet.appendChild(make('h3', '', title));
      const row = make('div', 'pieces');
      for (const p of list) {
        const b = make('button', st[key] === p.id ? 'on' : ''); b.type = 'button'; b.disabled = st.done || st.intro;
        b.setAttribute('aria-label', p.jamo); b.appendChild(canvas(p));
        if (puzzle.show_jamo) b.appendChild(make('span', 'jamo', p.jamo));
        b.addEventListener('click', () => { st[key] = p.id; pick(); });
        row.appendChild(b);
      }
      sheet.appendChild(row);
    };
    pieces(txt.initials, lang.initials, 'c', p => pieceCanvas(art, 4, 4, g => art.drawBits(g, p.bits, 0, 0, art.PAL.print), 6));
    pieces(txt.medials, lang.medials, 'v', p => pieceCanvas(art, 7, 7, g => {
      g.fillStyle = 'rgba(59,91,138,.18)'; g.fillRect(p.vertical ? 0 : 1, p.vertical ? 1 : 0, 4, 4);
      art.drawBits(g, lang.blockBits(null, p.id), 0, 0, art.PAL.print);
    }, 4));
    const foot = make('div', 'sfoot'), btn = make('button', 'act', st.done ? txt.finish : txt.close);
    btn.type = 'button'; btn.addEventListener('click', onClose); foot.append(make('span'), btn); sheet.appendChild(foot);
  }
  let busy = false;
  function pick() {
    if (st.done || busy || st.intro) return;
    if (st.c === null || st.v === null) return render();
    if (onStep(st.w, st.b, {c: st.c, v: st.v})) {
      st.b++; st.c = st.v = null;
      if (st.b >= puzzle.words[st.w].length) {
        busy = true; render();
        later(700, () => {
          busy = false;
          if (st.w + 1 < puzzle.words.length) { st.w++; st.b = 0; } else { st.done = true; onDone(); }
          render();
        });
        return;
      }
    } else { st.c = st.v = null; render(); shake($('pword')); return; }
    render();
  }
  render();
}

/* ---------- 언어 게임 자리(임시) ---------- */
// 언어 디자인이 확정되기 전, 진행만 이어지도록 버튼으로 완료 처리하는 화면
export function openPlaceholder(txt, solved, onSolve, onClose) {
  practiceToken = null;
  const sheet = $('practicesheet'); sheet.textContent = ''; sheet.className = 'sheet doc-placeholder';
  const head = make('div', 'shead'); head.append(make('span', '', txt.head[0]), make('span', '', txt.head[1] || ''));
  sheet.append(head, make('h1', '', txt.title));
  for (const p of txt.paragraphs || []) sheet.appendChild(make('p', '', p));
  sheet.appendChild(make('p', 'note', solved ? txt.done : txt.note));
  const foot = make('div', 'sfoot'), close = make('button', 'act later', txt.close), ok = make('button', 'act', txt.solve);
  close.type = ok.type = 'button'; ok.disabled = solved;
  close.addEventListener('click', onClose); ok.addEventListener('click', onSolve);
  foot.append(close, ok); sheet.appendChild(foot);
}

/* ---------- 퍼즐: 0단계 출발 전 연습 (비교 → 읽기 → 쓰기) ---------- */
// 참조 구현 0-1_game_script/stage0/template.html을 게임 화면(서류 시트)으로 옮겼다. 판정은 stage0.js, 문구는 story.json ui.study0.
// 해독 진행(progress = state.decipher)은 cb.learn / cb.reset으로만 바꾸고, 마치기는 cb.finish, 덮기는 cb.close.
// 글자는 렌더러가 만든 SVG(우리 데이터로 만든 문자열)를 그대로 넣는다. 각 글자 <g class="part">에 data-syl·data-slot·data-ph가 있다.
export function openStage0(S, phonemes, renderer, txt, progress, logic, cb) {
  practiceToken = {};
  const sheet = $('practicesheet'), W = S.words, LT = S.letters, T = txt;
  const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k]);
  const q = sel => sheet.querySelector(sel), qa = sel => [...sheet.querySelectorAll(sel)];
  const vowels = new Set(phonemes.vowels.map(v => v.id)), isVowel = id => vowels.has(id);
  const PH = logic.PHASES.map(id => ({id, n: S[id].length}));
  const st = {phase: 'intro', i: 0, solved: false, fresh: new Set(), comp: null, sel: null};
  const glyph = (id, scale = 1) => isVowel(id) ? renderer.renderVowel(id, {scale}) : renderer.renderConsonant(id, {scale});
  const word = (name, scale = 1.5) => renderer.renderWord(W[name], {scale});
  const keyOf = g => `${g.dataset.syl}:${g.dataset.slot}`;
  const slotName = k => T.slots[k.split(':')[1]] || k;
  const sylName = k => fill(T.syllable, {n: +k.split(':')[0] + 1});
  if (!progress.known.length) cb.reset();

  sheet.className = 'sheet doc-stage0';
  sheet.innerHTML = `<header class="top"><div class="frieze" aria-hidden="true"></div>
    <div class="toprow"><h1></h1><button type="button" class="act later" id="s0close"></button></div><p class="lede"></p><div class="steps"></div></header>
    <div class="wrap"><main class="stage" aria-live="polite"></main>
    <aside class="s0note"><h2></h2><p class="cnt"></p><div class="ngrid"></div><ul class="rules"></ul></aside></div>`;
  q('h1').textContent = T.title; q('.lede').textContent = T.subtitle; q('#s0close').textContent = T.close; q('.s0note h2').textContent = T.note.title;
  q('aside').setAttribute('aria-label', T.note.title);
  q('#s0close').addEventListener('click', cb.close);
  const syls = ['감자', '강수', '남산', '상자', '간사', '감수', '산수', '강자', '남자'].filter(w => W[w]).flatMap(w => W[w]);
  q('.frieze').innerHTML = renderer.renderWord(syls, {scale: 0.9}) + renderer.renderWord(syls, {scale: 0.9});
  const stage = q('.stage');

  function drawSteps() {
    const idx = PH.findIndex(p => p.id === st.phase);
    q('.steps').innerHTML = PH.map((p, i) => {
      const cls = i === idx ? 'on' : i < idx || st.phase === 'done' ? 'done' : '';
      const filled = i < idx || st.phase === 'done' ? p.n : i === idx ? st.i + (st.solved ? 1 : 0) : 0;
      const pips = Array.from({length: p.n}, (_, j) => `<i class="pip${j < filled ? ' f' : ''}"></i>`).join('');
      return `<span class="step ${cls}">${T.phases[p.id]}<span class="pips">${pips}</span></span>`;
    }).join('');
  }
  function drawNote() {
    q('.cnt').textContent = fill(T.note.count, {n: progress.known.length, total: S.notebookOrder.length});
    q('.ngrid').innerHTML = S.notebookOrder.map(id => {
      if (!progress.known.includes(id)) return `<div class="ncell lock"><div class="g">?</div>${T.note.locked}</div>`;
      return `<div class="ncell${st.fresh.has(id) ? ' new' : ''}"><div class="g">${glyph(id)}</div>${LT[id].hangul} /${LT[id].ipa}/</div>`;
    }).join('');
    st.fresh.clear();
    q('.rules').innerHTML = '';
    for (const r of progress.rules.length ? progress.rules : [T.note.empty]) q('.rules').appendChild(make('li', '', r));
  }
  function learn(ids, rule) { cb.learn(ids, rule).forEach(id => st.fresh.add(id)); drawNote(); }
  function go(phase, i = 0) {
    st.phase = phase; st.i = i; st.solved = false;
    drawSteps();
    ({intro, compare, read, write, done})[phase]();
    sheet.scrollTop = 0;
  }
  function next() {
    const p = PH.find(x => x.id === st.phase);
    if (st.i + 1 < p.n) return go(st.phase, st.i + 1);
    const idx = PH.indexOf(p);
    go(idx + 1 < PH.length ? PH[idx + 1].id : 'done');
  }
  const btn = (label, cls = 'btn') => `<button type="button" class="${cls}">${label}</button>`;

  // ---------- 교과서 한 과 ----------
  function intro() {
    const I = T.intro;
    const known = progress.known.map(id => `<tr><td class="kg">${glyph(id, 0.9)}</td><td>${LT[id].hangul}</td><td>/${LT[id].ipa}/</td><td>${isVowel(id) ? I.vowel : I.consonant}</td></tr>`).join('');
    stage.innerHTML = `<article class="s0book">
      <div class="rh"><span>${I.running[0]}</span><span>${I.running[1]}</span></div>
      <p class="kick">${I.kicker}</p><h2 class="lesson">${I.title}</h2><p class="lead">${I.lead}</p>
      <div class="goal"><b>${I.goal_title}</b><ul>${I.goals.map(g => `<li>${g}</li>`).join('')}</ul></div>
      <h3>${I.s1}</h3><p>${I.s1_text}</p><p class="caution"><b>${I.caution_label}</b>${I.caution}</p>
      <h3>${I.s2}</h3><p>${I.s2_text}</p>
      <figure class="f0"><div class="f0box"></div><figcaption>${I.figure_caption}</figcaption></figure>
      <h3>${I.s3}</h3><p>${I.s3_text}</p>
      <table class="known"><caption>${I.table_caption}</caption><thead><tr>${I.table_head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${known}</tbody></table>
      <div class="end">${btn(I.start)}<span class="small">${fill(I.counts, {compare: S.compare.length, read: S.read.length, write: S.write.length})}</span></div>
    </article>`;
    drawFigure();
    q('.end .btn').addEventListener('click', () => go('compare'));
  }
  // 그림 0-1: 렌더러가 배치한 실제 좌표를 읽어 이름표를 단다(글자 모양이 바뀌어도 따라간다)
  function drawFigure() {
    const I = T.intro, L = I.figure_labels, S2 = 2, OX = 70, OY = 96, VW = 700, fw0 = W[I.figure_word];
    const wl = renderer.layoutWord(fw0), base = OX + (560 - wl.width * S2) / 2, box = q('.f0box');
    box.innerHTML = `<svg viewBox="0 0 ${VW} 300" role="img" aria-label="${I.figure_caption}"><g transform="translate(${base} ${OY}) scale(${S2})" class="fw">${wl.svg}</g><g class="ann"></g></svg>`;
    const pos = p => {
      const sx = +(p.parentNode.getAttribute('transform').match(/translate\(([-\d.]+)/)?.[1] || 0);
      const m = p.getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\)(?: scale\(([\d.]+)\))?/);
      const x = sx + +m[1], y = +m[2], s = +(m[3] || 1);
      return {cx: base + S2 * (x + 25 * s), bot: OY + S2 * (y + 48 * s), l: base + S2 * x, r: base + S2 * (x + 50 * s)};
    };
    const parts = [...box.querySelectorAll('.fw .part')];
    const get = (syl, slot) => pos(parts.find(p => p.dataset.syl == syl && p.dataset.slot === slot));
    const callout = (p, [name, desc]) => `<line x1="${p.cx}" y1="${p.bot + 6}" x2="${p.cx}" y2="230" class="ld"/><text x="${p.cx}" y="250" class="an">${name}</text><text x="${p.cx}" y="270" class="ad">${desc}</text>`;
    const bracket = (a, b, t) => `<path d="M${a} 52V44H${b}V52" class="br"/><text x="${(a + b) / 2}" y="34" class="an">${t}</text>`;
    const s0 = [get(0, 'onset0'), get(0, 'nucleus'), get(0, 'coda0')], s1 = [get(1, 'onset0'), get(1, 'nucleus')];
    const chars = [...I.figure_word];
    box.querySelector('.ann').innerHTML =
      bracket(s0[0].l, s0[2].r, `${fill(T.syllable, {n: 1})} · ${chars[0]}`) + bracket(s1[0].l, s1[1].r, `${fill(T.syllable, {n: 2})} · ${chars[1]}`) +
      `<text x="${(s0[2].r + s1[0].l) / 2}" y="78" class="ad">${L.gap}</text>` +
      callout(s0[0], L.onset0) + callout(s0[1], L.nucleus) + callout(s0[2], L.coda0);
  }

  // ---------- 비교: 달라진 글자 찾기 ----------
  function compare() {
    const r = S.compare[st.i], C = T.compare;
    stage.innerHTML = `<div class="pair">${[r.a, r.b].map(w => `<div class="wcard"><div class="kr">${w}</div><div class="glyphs clickable">${word(w)}</div></div>`).join('')}</div>
      <p class="fb"></p><div class="rv"></div>`;
    const pick = (g, box) => {
      if (st.solved) return;
      const k = keyOf(g), fb = q('.fb');
      if (logic.compareResult(S, r, k) === 'found') {
        st.solved = true;
        // 한쪽만 눌러도 두 단어의 달라진 글자가 함께 선택되고, 한글 이름표가 붙는다
        const diff = logic.diffKeys(W[r.a], W[r.b]);
        qa('.stage .part').filter(p => diff.includes(keyOf(p))).forEach(p => {
          p.classList.add('hl');
          const s = +((p.getAttribute('transform') || '').match(/scale\(([\d.]+)\)/)?.[1] || 1);
          const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          t.setAttribute('class', 'lbl'); t.setAttribute('x', 25); t.setAttribute('y', 50 + 20 / s);
          t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', 17 / s);
          t.textContent = LT[p.dataset.ph]?.hangul || '';
          p.appendChild(t);
        });
        fb.className = 'fb'; fb.textContent = '';
        const rv = r.reveal.map(id => `<div class="rg"><div class="g">${glyph(id, 1)}</div><div><b>${LT[id].hangul}</b><span>/${LT[id].ipa}/${LT[id].hint ? ' · ' + LT[id].hint : ''}</span></div></div>`).join('');
        q('.rv').innerHTML = `<div class="reveal"><div class="rgl">${rv}</div><p>${fill(C.where, {ord: T.ordinals[+k.split(':')[0]], slot: slotName(k)})}</p></div>${btn(st.i + 1 < S.compare.length ? C.next : C.to_read)}`;
        learn(r.reveal, T.rules[st.i]);
        drawSteps();
        const nx = q('.rv .btn'); nx.addEventListener('click', next); nx.focus();
      } else {
        g.classList.add('bad'); box.classList.add('shake');
        setTimeout(() => { g.classList.remove('bad'); box.classList.remove('shake'); }, 600);
        fb.className = 'fb no'; fb.textContent = fill(C.same, {syl: sylName(k), slot: slotName(k)});
      }
    };
    qa('.clickable').forEach(box => {
      // 키보드로도 고를 수 있게: 글자마다 탭 이동, Enter/Space로 고른다(이름표에는 자리만 적는다)
      box.querySelectorAll('.part').forEach(g => { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', `${sylName(keyOf(g))} ${slotName(keyOf(g))}`); });
      box.addEventListener('click', e => { const g = e.target.closest('.part'); if (g) pick(g, box); });
      box.addEventListener('keydown', e => { const g = e.target.closest('.part'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(g, box); } });
    });
  }

  // ---------- 읽기: 기록 보고 단어 고르기 ----------
  function read() {
    const r = S.read[st.i], R = T.read;
    stage.innerHTML = `<p class="task">${R.task}</p><p class="sub">${R.sub}</p>
      <div class="wcard solo"><div class="glyphs shown">${word(r.word, 1.8)}</div></div>
      <div class="opts"></div><p class="fb"></p><div class="nxw"></div>`;
    for (const o of r.options) {
      const b = make('button', 'opt', o); b.type = 'button';
      b.addEventListener('click', () => {
        if (st.solved) return;
        const res = logic.readResult(S, r, o), fb = q('.fb');
        qa('.shown .part').forEach(p => p.classList.remove('bad'));
        if (res.ok) {
          st.solved = true; b.classList.add('yes');
          fb.className = 'fb ok'; fb.textContent = fill(R.ok, {word: r.word});
          q('.nxw').innerHTML = btn(st.i + 1 < S.read.length ? R.next : R.to_write);
          drawSteps();
          const nx = q('.nxw .btn'); nx.addEventListener('click', next); nx.focus();
        } else {
          b.classList.add('no'); b.disabled = true;
          qa('.shown .part').forEach(p => res.diff.includes(keyOf(p)) && p.classList.add('bad'));
          fb.className = 'fb no'; fb.textContent = fill(R.wrong, {word: o, where: res.diff.map(k => `${sylName(k)} ${slotName(k)}`).join(', ')});
        }
      });
      q('.opts').appendChild(b);
    }
  }

  // ---------- 쓰기: 칸마다 글자 고르기 (팔레트는 모양만, 한글·발음 표기 없음) ----------
  function write() {
    const target = S.write[st.i], R = T.write;
    st.comp = W[target].map(() => ({onset0: null, nucleus: null, coda0: null}));
    st.sel = {s: 0, k: 'onset0'};
    stage.innerHTML = `<p class="task">${fill(R.task, {word: target})}</p><p class="sub">${R.sub}</p>
      <div class="compose"></div><div class="palette"></div>
      <div class="wcard preview"><div class="kr">${R.preview}</div><div class="glyphs pv"></div></div>
      ${btn(R.check)}<p class="fb"></p>`;
    drawCompose(); drawPalette(); drawPreview();
    const chk = q('.stage > .btn');
    chk.addEventListener('click', () => {
      if (st.solved) return next();
      const wrong = logic.writeWrong(S, target, st.comp), fb = q('.fb');
      qa('.slot').forEach(el => el.classList.toggle('bad', wrong.includes(`${el.dataset.s}:${el.dataset.k}`)));
      if (!wrong.length) {
        st.solved = true;
        fb.className = 'fb ok'; fb.textContent = fill(R.ok, {word: target});
        chk.textContent = st.i + 1 < S.write.length ? R.next : R.finish;
        drawSteps();
      } else { fb.className = 'fb no'; fb.textContent = R.wrong; }
    });
  }
  function drawCompose() {
    const R = T.write;
    q('.compose').innerHTML = st.comp.map((c, si) => `<div class="syl"><h3>${fill(T.syllable, {n: si + 1})}</h3><div class="slots">${
      logic.SLOTS.map(k => {
        const v = c[k], inner = v === null ? T.slots[k] : v === '' ? R.none : `<span class="gg">${glyph(v)}</span>`;
        const sel = st.sel && st.sel.s === si && st.sel.k === k ? ' sel' : '';
        return `<button type="button" class="slot${sel}" data-s="${si}" data-k="${k}" aria-label="${fill(T.syllable, {n: si + 1})} ${T.slots[k]}">${inner}</button>`;
      }).join('')}</div></div>`).join('');
    qa('.slot').forEach(b => b.addEventListener('click', () => { st.sel = {s: +b.dataset.s, k: b.dataset.k}; drawCompose(); drawPalette(); }));
  }
  function drawPalette() {
    const ids = logic.paletteFor(S, st.sel.k, progress.known, isVowel);
    q('.palette').innerHTML = ids.map(id => `<button type="button" class="chip" data-id="${id}" aria-label="${T.write.pick}">${id === '' ? T.write.none : glyph(id)}</button>`).join('');
    qa('.chip').forEach(b => b.addEventListener('click', () => {
      if (st.solved) return;
      st.comp[st.sel.s][st.sel.k] = b.dataset.id;
      // 글자를 넣으면 다음 빈 칸으로 옮겨 간다
      const order = st.comp.flatMap((_, si) => logic.SLOTS.map(k => ({s: si, k})));
      const cur = order.findIndex(o => o.s === st.sel.s && o.k === st.sel.k);
      const nxt = order.slice(cur + 1).find(o => st.comp[o.s][o.k] === null);
      if (nxt) st.sel = nxt;
      drawCompose(); drawPalette(); drawPreview();
    }));
  }
  function drawPreview() {
    const syls = st.comp.filter(c => c.nucleus || c.onset0).map(c => ({onset: c.onset0 ? [c.onset0] : [], nucleus: c.nucleus || undefined, coda: c.coda0 ? [c.coda0] : []}));
    q('.pv').innerHTML = syls.length ? renderer.renderWord(syls, {scale: 1.5}) : `<span class="small">${T.write.empty}</span>`;
  }

  // ---------- 끝 ----------
  function done() {
    const D = T.done;
    drawSteps();
    stage.innerHTML = `<p class="task">${D.task}</p><p class="sub">${fill(D.sub, {known: progress.known.length, rules: progress.rules.length})}</p>
      <div class="lex">${Object.keys(W).map(w => `<div class="wcard"><div class="kr">${w}</div><div class="glyphs">${word(w, 0.9)}</div></div>`).join('')}</div>
      <div class="end">${btn(D.finish)}${btn(D.again, 'btn ghost')}</div>`;
    const [fin, again] = qa('.end .btn');
    fin.addEventListener('click', cb.finish);
    again.addEventListener('click', () => { cb.reset(); drawNote(); go('intro'); });
    fin.focus();
  }

  drawNote();
  go('intro');
}

/* ---------- 퍼즐: 연구 보고서 ---------- */
// surface가 없으면(기록 사진이 없는 보고서) 그림 없이 적는다
export function openReport(puzzle, surface, art, txt, onSend, onLater) {
  const sheet = $('reportsheet'); sheet.textContent = '';
  const head = make('div', 'shead'); head.append(make('span', '', txt.head[0]), make('span', '', txt.head[1]));
  const dl = make('dl', 'meta'); for (const [k, v] of txt.fields) dl.append(make('dt', '', k), make('dd', '', v));
  const fig = make('div'); fig.id = 'repfig';
  if (surface) { const c = art.mk(surface.w, surface.h); c.getContext('2d').drawImage(surface.img, 0, 0); c.style.width = surface.w * 3 + 'px'; c.style.maxWidth = '100%'; fig.appendChild(c); }
  for (const p of txt.paragraphs || []) fig.appendChild(make('p', '', p));
  const ta = make('textarea'); ta.id = 'reptext'; ta.maxLength = puzzle.max_length; ta.spellcheck = false; ta.setAttribute('aria-label', txt.answer);
  const foot = make('div', 'sfoot'), later = make('button', 'act later', txt.later), send = make('button', 'act', txt.send);
  later.type = send.type = 'button'; send.disabled = true;
  ta.addEventListener('input', () => { send.disabled = !ta.value.trim(); });
  later.addEventListener('click', onLater); send.addEventListener('click', () => onSend(ta.value));
  foot.append(later, send);
  sheet.append(head, make('h1', '', txt.title), dl, fig, make('h2', '', txt.answer), ta, foot);
  setTimeout(() => ta.focus(), 0);
}

/* ---------- 단계 끝, 시작 화면, 단계 카드, 알림 ---------- */
export function renderChapterEnd(txt, answer, onRestart) {
  const sheet = $('endsheet'); sheet.textContent = '';
  const head = make('div', 'shead'); head.append(make('span', '', txt.head[0]), make('span', '', txt.head[1]));
  const foot = make('div', 'sfoot'), btn = make('button', 'act', txt.button); btn.type = 'button'; btn.addEventListener('click', onRestart);
  foot.append(make('span'), btn);
  sheet.append(head, make('h1', '', txt.title), make('p', '', txt.quote + '"' + (answer || '') + '"'), make('p', '', txt.next), foot);
}
export function renderTitle(txt, hasSave, onContinue, onNew) {
  const sheet = $('titlesheet'); sheet.textContent = '';
  sheet.appendChild(make('h1', 'gametitle', txt.name));
  const row = make('div', 'titlebtns');
  if (hasSave) { const c = make('button', 'act', txt.continue); c.type = 'button'; c.addEventListener('click', onContinue); row.appendChild(c); }
  const n = make('button', 'act' + (hasSave ? ' later' : ''), txt.new); n.type = 'button';
  let armed = !hasSave;
  const note = make('p', 'note', '');
  n.addEventListener('click', () => { if (armed) return onNew(); armed = true; note.textContent = txt.confirm_new; });
  row.appendChild(n); sheet.append(row, note);
  setTimeout(() => row.firstChild.focus(), 0);
}
// 개발용 테스트 메뉴: 시작 지점을 골라 바로 시작한다 (data/dev.json, 주소 끝 #test)
export function renderTestMenu(txt, starts, onPick) {
  const sheet = $('titlesheet'); sheet.textContent = '';
  sheet.append(make('h1', 'gametitle', txt.title), make('p', 'note', txt.sub));
  const list = make('div', 'teststarts');
  for (const s of starts) { const b = make('button', '', s.label); b.type = 'button'; b.addEventListener('click', () => onPick(s)); list.appendChild(b); }
  sheet.appendChild(list);
  setTimeout(() => list.firstChild && list.firstChild.focus(), 0);
}
export function showCard(card, alpha) {
  const el = $('card'); el.hidden = !card || alpha <= 0;
  if (card) { $('cardt').textContent = card.title; $('cards').textContent = card.sub || ''; el.style.opacity = alpha; }
}
let toastTimer = 0;
export function toast(text) {
  const el = $('toast'); el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}
