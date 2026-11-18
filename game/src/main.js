// 게임을 잇는 곳: 데이터 불러오기·검증 → 저장 읽기 → 입력·이동·효과 실행·자동 저장 → 그리기.
import {loadData, validateData, validateDevStarts} from './data.js';
import {createLanguage} from './language.js';
import {createArt} from './art.js';
import {buildMap, nearest, step} from './world.js';
import {renderWorld, renderInspect, glyphAt} from './render.js';
import {newState, check, mark, addGlyph, removeGlyph, setMemo, setGuess, glyphKey, goToPage} from './state.js';
import {pickVariant, runEffects} from './story.js';
import {PUZZLE_TYPES, canStart, solve} from './puzzles.js';
import {readSave, writeSave, clearSave, serialize, parse} from './save.js';
import * as ui from './ui.js';

export const GAME_VERSION = '0.1.0';

const $ = ui.$, cv = $('game'), ctx = cv.getContext('2d');
let D, lang, art, maps, state, M, storage, dialogue;
const player = {x: 0, y: 0, dir: 'down', frame: 0, walk: 0};
const held = new Set();
let insp = null, frame = null, bookOpen = false, overlay = null, fade = null, time = 0, last = 0;
let VW = 384, VH = 216, SCALE = 3;

/* ---------- 저장 ---------- */
// 브라우저 저장소가 막혀 있으면 메모리에만 둔다(새로고침하면 사라짐).
function getStorage() {
  try { const s = window.localStorage; s.getItem(''); return s; }
  catch (e) { const m = new Map(); return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k)}; }
}
let saveTimer = 0, saveWarned = false;
function syncPos() { state.map = M.id; state.pos = {x: player.x, y: player.y, dir: player.dir}; }
function saveNow() {
  clearTimeout(saveTimer); syncPos();
  if (!writeSave(storage, state, GAME_VERSION) && !saveWarned) { saveWarned = true; ui.toast(D.story.ui.save_failed); }
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }

/* ---------- 효과 실행 (story.js가 부르는 화면 쪽 일) ---------- */
const host = {
  goto: (map, spawn) => travel(map, spawn),
  card: id => {
    const card = D.story.cards[id];
    if (fade) { fade.card = card; fade.dur = 3.2; } else fade = {t: 0, dur: 3.2, mid: () => {}, card};
  },
  openRead: id => openDoc(id),
  openPuzzle: id => openPuzzle(id),
  chapterEnd: n => {
    const txt = D.story.ui.chapter_end[n];
    setOverlay('end'); ui.renderChapterEnd(txt, state.answers[txt.answer_of], newGame);
  },
};
function run(effects) { runEffects(effects, state, host); refreshHud(); saveSoon(); }

/* ---------- 장소 ---------- */
function enterMap(id, spawn, pos) {
  M = maps[id];
  const [x, y, dir] = pos ? [pos.x, pos.y, pos.dir] : M.spawns[spawn];
  player.x = x; player.y = y; player.dir = dir || 'down'; player.frame = 0;
  for (const o of M.objs) if (o.npc) o.dir = o.base_dir;
  mark(state, 'visited', id);
}
function travel(map, spawn) {
  held.clear();
  fade = {t: 0, dur: 1.1, card: null, mid: () => { enterMap(map, spawn); saveNow(); }, after: () => { if (M.on_enter) talk(M.on_enter.split(':')[1]); }};
}

/* ---------- 조사 ---------- */
const faceToward = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y; return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); };
function talk(id, face) {
  const v = pickVariant(D.story.dialogues[id], state);
  if (!v) return;
  held.clear();
  if (face) face.dir = faceToward(face, player);
  dialogue.open(v.lines, () => { if (face) face.dir = face.base_dir; run(v.effects); });
}
function use(o) {
  const [kind, ref] = o.use.split(':');
  if (kind === 'dialogue') return talk(ref, o.npc ? o : null);
  if (kind === 'read') return openDoc(ref);
  if (kind === 'inspect') return openInspect(ref);
  if (kind === 'door') {
    const d = D.maps.doors[ref];
    if (check(state, d.when)) { const [m, s] = d.to.split('/'); return travel(m, s); }
    return talk(d.locked);
  }
}
const afterOf = id => ([...D.records.records, ...D.records.tables].find(x => x.id === id) || {}).after;
function openInspect(id) {
  const s = art.surfaces[id];
  insp = {id, s, sel: 0, flash: null}; held.clear();
  mark(state, 'seen', id);
  for (const q of s.glyphs) mark(state, 'discovered', q.k + ':' + q.id);
  $('closeinsp').hidden = false; saveSoon();
}
function closeInspect() {
  const id = insp.id; insp = null; frame = null;
  $('closeinsp').hidden = true; cv.classList.remove('pick');
  if (afterOf(id)) talk(afterOf(id));
}
function copySelected() {
  const q = insp.s.glyphs[insp.sel];
  if (!q) return;
  if (!addGlyph(state, q)) return ui.shake($('cells'));
  insp.flash = {i: insp.sel, t: time}; refreshBook(); saveSoon();
}

/* ---------- 서류와 퍼즐 화면 ---------- */
const OVERLAYS = ['doc', 'practice', 'report', 'end', 'title'];
function setOverlay(name) {
  overlay = name; held.clear();
  if (name !== 'doc') docCtl = null;
  for (const id of OVERLAYS) $(id).hidden = id !== name;
  layout();
}
let docCtl = null;   // 장을 넘기는 문서(일기장)일 때만 있다
let docClose = () => setOverlay(null);
function openDoc(id) {
  mark(state, 'read', id); saveSoon();
  // 문서를 덮은 뒤 이어지는 혼잣말이 있으면(after) 덮을 때 꺼낸다
  const doc = D.story.reads[id], close = () => { setOverlay(null); if (doc.after) talk(doc.after); };
  setOverlay('doc'); docCtl = ui.renderDoc($('docsheet'), doc, art, lang, D.story.ui.close, close, D.story.ui);
  docClose = close;
}
function openPuzzle(id) {
  const p = D.puzzles.puzzles.find(x => x.id === id), done = !!state.solved[id];
  if (!done && !canStart(p, state)) return;
  if (p.type === 'compose_syllables') {
    setOverlay('practice');
    ui.openPractice(p, art, lang, D.story.ui[p.id], done,
      (w, b, pick) => PUZZLE_TYPES.compose_syllables.checkStep(p, lang, w, b, pick),
      () => { const eff = solve(p, state); if (eff) run(eff); },
      // 닫을 때, 풀었으면 뒤이어 나오는 대사(after)를 꺼낸다
      () => { setOverlay(null); if (p.after && state.solved[p.id]) talk(p.after); });
  } else if (p.type === 'free_text_report' && !done) {
    setOverlay('report');
    ui.openReport(p, art.surfaces[p.record], art, D.story.ui[p.id],
      text => { const eff = solve(p, state, text); if (eff) { setOverlay(null); run(eff); } },
      () => setOverlay(null));
  }
}

/* ---------- 노트 ---------- */
let nbSel = -1;   // 노트에서 고른 칸 (추측을 적을 글자)
const nbActions = {
  select: i => { nbSel = nbSel === i ? -1 : i; refreshBook(); if (nbSel >= 0) $('guess').focus(); },
  page: n => { goToPage(state, n); nbSel = -1; $('memo').blur(); refreshBook(); saveSoon(); },
};
const selectedGlyph = () => state.notebook.pages[state.notebook.cur].g[nbSel];
function refreshBook() {
  if (!bookOpen) return;
  if (!selectedGlyph()) nbSel = -1;
  ui.renderNotebook(state.notebook, art, lang, nbActions, state.events.forward_note ? D.story.ui.forward_note : '', state.guesses, nbSel, D.story.ui.notebook);
}
function setBook(open) {
  if (!state.events.kit_given) return;
  bookOpen = open; $('book').hidden = !open; held.clear();
  if (open) refreshBook(); else $('memo').blur();
  layout();
}
function layout() {
  document.body.classList.toggle('docked', bookOpen);
  for (const id of ['doc', 'practice']) $(id).classList.toggle('withbook', bookOpen);
}
// 노트 버튼은 기록지·노트를 받은 뒤에 보인다. 받은 아이템은 조건이 맞는 것만 왼쪽 위에 놓인다.
const itemsHeld = () => (D.story.items || []).filter(it => check(state, it.when));
function useItem(it) {
  const [kind, ref] = it.use.split(':');
  if (kind === 'read') { if (overlay === 'doc') docClose(); else if (!overlay) openDoc(ref); }
}
let shownItems = '';
function refreshHud() {
  $('bookbtn').hidden = !state.events.kit_given;
  const held = itemsHeld(), key = held.map(it => it.id).join(',');
  if (key === shownItems) return;
  shownItems = key;
  const box = $('items'); box.textContent = '';
  for (const it of held) {
    const b = document.createElement('button'), img = art.S[it.icon], c = art.mk(img.width, img.height);
    b.type = 'button'; b.className = 'iconbtn'; b.setAttribute('aria-label', it.label); b.title = it.label;
    c.getContext('2d').drawImage(img, 0, 0); b.appendChild(c);
    b.addEventListener('click', () => useItem(it));
    box.appendChild(b);
  }
}

/* ---------- 입력 ---------- */
const KEYMAP = {ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'};
function action() {
  if (fade || overlay) return;
  if (dialogue.active) return dialogue.advance();
  if (insp) return bookOpen ? copySelected() : closeInspect();
  const o = nearest(M, player);
  if (o) use(o);
}
function moveSel(dir) { const n = insp.s.glyphs.length; if (n) insp.sel = (insp.sel + (dir === 'left' || dir === 'up' ? n - 1 : 1)) % n; }
function onKey(e) {
  const tag = e.target.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') { if (e.key === 'Escape' || (tag === 'INPUT' && e.key === 'Enter')) e.target.blur(); return; }
  if (overlay === 'practice') { if (e.code === 'Escape') { const b = document.querySelector('#practicesheet .sfoot .act'); if (b) b.click(); else setOverlay(null); } return; }
  if (overlay === 'doc') {
    if (docCtl && tag !== 'BUTTON' && ['ArrowRight', 'KeyD', 'ArrowLeft', 'KeyA', 'Enter', 'Space', 'KeyE'].includes(e.code)) {
      e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') docCtl.turn(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') docCtl.turn(1);
      else if (docCtl.atEnd()) docClose(); else docCtl.turn(1);   // E·Space: 다음 장, 마지막 장이면 덮기
      return;
    }
    if (e.code === 'KeyQ') { e.preventDefault(); setBook(!bookOpen); }
    else if (e.code === 'Escape') { if (bookOpen) setBook(false); else docClose(); }
    else if (e.code === 'KeyR' || (tag !== 'BUTTON' && ['Enter', 'Space', 'KeyE'].includes(e.code))) { e.preventDefault(); docClose(); }
    return;
  }
  if (overlay) return;
  const hot = itemsHeld().find(it => it.key === e.code);
  if (hot) { useItem(hot); return; }
  if (e.code === 'KeyQ') { e.preventDefault(); setBook(!bookOpen); return; }
  if (e.code === 'Escape') { if (bookOpen) setBook(false); else if (insp) closeInspect(); return; }
  if (KEYMAP[e.code]) {
    e.preventDefault();
    if (insp) { if (!e.repeat && bookOpen) moveSel(KEYMAP[e.code]); }
    else if (!dialogue.active) held.add(KEYMAP[e.code]);
    return;
  }
  if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
    if (tag === 'BUTTON' && e.code !== 'KeyE') return;
    e.preventDefault(); if (!e.repeat) action();
  }
}
function wireInput() {
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', e => { if (KEYMAP[e.code]) held.delete(KEYMAP[e.code]); });
  window.addEventListener('blur', () => held.clear());   // 창이 포커스를 잃으면 눌린 키를 놓는다
  const toCanvas = e => [e.clientX / SCALE, e.clientY / SCALE];
  cv.addEventListener('pointermove', e => {
    if (!insp || !bookOpen || !frame) return;
    const i = glyphAt(lang, insp.s, frame, ...toCanvas(e)); if (i >= 0) insp.sel = i;
    cv.classList.toggle('pick', i >= 0);
  });
  cv.addEventListener('pointerdown', e => {
    $('memo').blur();
    if (insp && frame) {
      const [px, py] = toCanvas(e), {k, ox, oy} = frame, s = insp.s;
      if (!(px >= ox && px < ox + s.w * k && py >= oy && py < oy + s.h * k)) return closeInspect();
      if (bookOpen) { const i = glyphAt(lang, s, frame, px, py); if (i >= 0) { insp.sel = i; copySelected(); } }
    } else if (dialogue.active) dialogue.advance();
  });
  document.querySelectorAll('.pad [data-k]').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); if (insp) { if (bookOpen) moveSel(k); } else if (!dialogue.active && !overlay) held.add(k); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => held.delete(k));
  });
  $('padA').addEventListener('pointerdown', e => { e.preventDefault(); action(); });
  $('bookbtn').addEventListener('click', () => setBook(!bookOpen));
  $('closeinsp').addEventListener('click', closeInspect);
  $('closebook').addEventListener('click', () => setBook(false));
  $('guess').addEventListener('input', e => { const q = selectedGlyph(); if (q) { setGuess(state, glyphKey(q), e.target.value); refreshBook(); saveSoon(); } });
  $('guessdel').addEventListener('click', () => { if (selectedGlyph()) { removeGlyph(state, nbSel); nbSel = -1; refreshBook(); saveSoon(); } });
  $('memo').addEventListener('input', e => { setMemo(state, e.target.value); saveSoon(); });
  $('doc').addEventListener('pointerdown', e => { if (e.target === $('doc')) docClose(); });
  window.addEventListener('resize', resize);
}

/* ---------- 화면 ---------- */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  SCALE = Math.max(2, Math.round(Math.max(w, h) / 480));
  VW = Math.ceil(w / SCALE); VH = Math.ceil(h / SCALE);
  cv.width = VW; cv.height = VH; cv.style.width = VW * SCALE + 'px'; cv.style.height = VH * SCALE + 'px';
  ctx.imageSmoothingEnabled = false;
}
// 노트를 펼치면 가려지지 않은 영역: 오른쪽 판이면 왼쪽 너비만, 아래 판(좁은 화면)이면 위쪽 높이만 쓴다
function viewArea() {
  if (!bookOpen) return {w: VW, h: VH};
  const r = $('book').getBoundingClientRect();
  return r.top > window.innerHeight * .4 ? {w: VW, h: Math.max(40, (r.top - 10) / SCALE)} : {w: Math.max(60, (r.left - 10) / SCALE), h: VH};
}
function spriteOf(o) {
  if (o.door) return art.S.door[check(state, D.maps.doors[o.door].when) ? 1 : 0];
  for (const si of o.sprite_if || []) if (check(state, si.when)) return art.S[si.sprite];
  return art.S[o.sprite];
}
function update(dt) {
  dialogue.tick(dt);
  if (fade) {
    fade.t += dt;
    if (!fade.done && fade.t >= fade.dur / 2) { fade.done = true; fade.mid(); }
    if (fade.t >= fade.dur) { const after = fade.after; fade = null; ui.showCard(null); if (after) after(); }
    return;
  }
  if (overlay || dialogue.active || insp) { player.frame = 0; return; }
  step(M, player, held, dt);
}
function render() {
  const area = viewArea(), view = {VW, VH, viewW: area.w, viewH: area.h, time, showBang: !dialogue.active && !fade && !overlay};
  if (insp) frame = renderInspect(ctx, art, lang, insp.s, view, bookOpen ? insp.sel : -1, insp.flash);
  else renderWorld(ctx, art, M, player, view, spriteOf);
  if (fade) {
    const p = fade.t / fade.dur, edge = fade.card ? .18 : .5;
    const al = p < edge ? p / edge : p > 1 - edge ? (1 - p) / edge : 1;
    ctx.fillStyle = 'rgba(8,6,14,' + Math.min(1, al).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH);
    ui.showCard(fade.card, fade.card ? Math.max(0, Math.min(1, (al - .6) / .4)) : 0);
  }
}
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt;
  if (state) { update(dt); render(); }
  requestAnimationFrame(loop);
}

/* ---------- 시작 ---------- */
function resetView() { insp = null; frame = null; $('closeinsp').hidden = true; dialogue.reset(); if (bookOpen) setBook(false); setOverlay(null); }
function startFrom(s, wantSpawn) {
  state = s; resetView(); nbSel = -1;
  if (!maps[s.map]) { s.map = D.maps.start.map; s.pos = null; }   // 저장된 장소가 없어졌으면 처음 장소로
  const spawns = maps[s.map].spawns;
  const spawn = spawns[wantSpawn] ? wantSpawn : spawns[D.maps.start.spawn] ? D.maps.start.spawn : Object.keys(spawns)[0];
  enterMap(s.map, spawn, s.pos);
  refreshHud();
}
function newGame() {
  clearSave(storage);
  startFrom(newState(D.maps.start));
  const card = D.story.cards[D.maps.start.card];
  fade = {t: 1.5, dur: 3, mid: () => {}, card, done: true};
  saveNow();
}
// 개발용 테스트 모드: 주소 끝이 #test면 시작 지점을 골라 시작한다. 진짜 저장은 건드리지 않는다(메모리 저장소).
const TEST = (() => { try { return window.location.hash === '#test'; } catch (e) { return false; } })();
let dev = null;
function memoryStorage() { const m = new Map(); return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k)}; }
function showTestMenu() { setOverlay('title'); ui.renderTestMenu(dev.ui, dev.starts, startTest); }
function startTest(preset) {
  const s = newState(D.maps.start);
  s.chapter = preset.chapter; s.map = preset.map;
  for (const c of preset.set || []) { const [kind, id] = c.split(':'); mark(s, kind, id); }
  startFrom(s, preset.spawn); saveNow();
  if (M.on_enter) talk(M.on_enter.split(':')[1]);
}

function fatal(msg) { const el = $('fatal'); el.hidden = false; el.textContent = (D && D.story ? D.story.ui.data_error : '게임 데이터를 불러오지 못했어요.') + '\n' + msg; }

async function boot(hot) {
  try { D = await loadData(); } catch (e) { fatal(e.message); return; }
  lang = createLanguage(D.language);
  art = createArt(lang, D.records);
  const errs = validateData(D, {sprites: art.SPRITE_NAMES, photos: art.PHOTOS});
  if (errs.length) { console.error(errs); fatal(errs.join('\n')); return; }
  maps = Object.fromEntries(D.maps.maps.map(m => [m.id, buildMap(m)]));
  dialogue = ui.createDialogue(D.story);
  if (TEST) {
    try { dev = await (await fetch('data/dev.json')).json(); } catch (e) { fatal('data/dev.json을 불러오지 못함'); return; }
    const devErrs = validateDevStarts(D, dev);
    if (devErrs.length) { fatal(devErrs.join('\n')); return; }
  }
  storage = TEST ? memoryStorage() : getStorage();
  for (const [id, icon] of [['bookbtn', 'bookIcon'], ['closeinsp', 'closeIcon']]) {
    const c = art.mk(art.S[icon].width, art.S[icon].height); c.getContext('2d').drawImage(art.S[icon], 0, 0); $(id).appendChild(c);
  }
  wireInput(); resize();
  ui.fitMemoWidth();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ui.fitMemoWidth);
  requestAnimationFrame(t => { last = t; loop(t); });

  if (TEST) {
    $('testbtn').hidden = false; $('testbtn').textContent = dev.ui.badge;
    $('testbtn').addEventListener('click', showTestMenu);
    startFrom(newState(D.maps.start)); return showTestMenu();
  }
  const hotSave = hot && hot.save ? parse(hot.save) : null;
  if (hotSave && hotSave.ok) return startFrom(hotSave.state);
  const saved = readSave(storage);
  if (!saved.ok && !saved.empty) console.warn('저장 파일을 쓸 수 없어 새로 시작해요:', saved.error);
  if (!saved.ok) return newGame();
  // 저장이 있으면 시작 화면에서 이어하기/처음부터를 고른다. 고르기 전에도 뒤 화면이 보이게 이어할 장소를 깔아 둔다.
  startFrom(saved.state); setOverlay('title');
  ui.renderTitle(D.story.ui.title, true, () => setOverlay(null), newGame);
}

window.claude?.hot?.snapshot?.(() => state ? (syncPos(), {save: serialize(state, GAME_VERSION)}) : {});
window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? null);
