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

export function renderDoc(sheet, doc, art, lang, closeLabel, onClose, txt) {
  if (doc.style === 'diary') return renderDiary(sheet, doc, txt.diary, closeLabel, onClose);
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
export function renderNotebook(nb, art, lang, actions, forwardText, guesses, sel, txt) {
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

/* ---------- 퍼즐: 연구 보고서 ---------- */
export function openReport(puzzle, surface, art, txt, onSend, onLater) {
  const sheet = $('reportsheet'); sheet.textContent = '';
  const head = make('div', 'shead'); head.append(make('span', '', txt.head[0]), make('span', '', txt.head[1]));
  const dl = make('dl', 'meta'); for (const [k, v] of txt.fields) dl.append(make('dt', '', k), make('dd', '', v));
  const fig = make('div'); fig.id = 'repfig';
  const c = art.mk(surface.w, surface.h); c.getContext('2d').drawImage(surface.img, 0, 0); c.style.width = surface.w * 3 + 'px'; c.style.maxWidth = '100%'; fig.appendChild(c);
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
