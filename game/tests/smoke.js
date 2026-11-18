// 화면 쪽 연기 점검: 가짜 DOM과 캔버스로 게임을 띄워, 그림 생성·데이터 검증(그림·사진 이름 포함)·새 게임 시작·그리기가 오류 없이 도는지 본다.
// 실제 브라우저에서 보이는 모습은 확인하지 못한다.
import {readFileSync} from 'node:fs';

const els = new Map();
function el(tag = 'div') {
  const e = {
    tagName: tag.toUpperCase(), hidden: false, textContent: '', className: '', value: '', disabled: false, style: {}, children: [], dataset: {},
    classList: {add() {}, remove() {}, toggle() {}},
    width: 0, height: 0,
    addEventListener() {}, setAttribute() {}, focus() {}, blur() {},
    appendChild(c) { this.children.push(c); return c; }, append(...c) { this.children.push(...c); },
    get firstChild() { return this.children[0] || el(); },
    getBoundingClientRect: () => ({top: 480, left: 0}),
  };
  e.getContext = () => new Proxy({}, {
    get: (t, k) => k === 'getImageData' ? (x, y, w, h) => ({data: new Uint8ClampedArray(w * h * 4)})
      : k === 'createRadialGradient' ? () => ({addColorStop() {}}) : k in t ? t[k] : () => {},
    set: (t, k, v) => { t[k] = v; return true; },
  });
  return e;
}
globalThis.document = {
  body: el('body'), activeElement: null,
  createElement: el,
  getElementById: id => { if (!els.has(id)) els.set(id, Object.assign(el(), {id, hidden: ['fatal', 'dlg', 'book', 'doc', 'practice', 'report', 'end', 'title', 'toast', 'card'].includes(id)})); return els.get(id); },
  querySelectorAll: () => [],
};
const store = new Map();
// node tests/smoke.js continue → 1단계 도서관에 저장이 있는 상태로 띄워, 시작 화면(이어하기)이 뜨는지 본다.
const CONTINUE = process.argv[2] === 'continue';
if (CONTINUE) {
  const {newState} = await import('../src/state.js');
  const s = newState({map: 'myroom'}); s.chapter = 1; s.map = 'library'; s.pos = {x: 56, y: 70, dir: 'down'}; s.events.kit_given = true;
  store.set('ultima.save', JSON.stringify({save_version: 1, game_version: 'test', state: s}));
}
const MODE = process.argv[2] || 'new';
globalThis.window = {innerWidth: 1280, innerHeight: 720, addEventListener() {}, location: {hash: MODE === 'test' ? '#test' : ''}, localStorage: {getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k)}};
globalThis.fetch = async url => {
  const path = new URL('../' + url, import.meta.url);
  try { const text = readFileSync(path, 'utf8'); return {ok: true, json: async () => JSON.parse(text)}; } catch (e) { return {ok: false, status: 404}; }
};
let frames = 0;
globalThis.requestAnimationFrame = f => { if (frames++ < 40) setTimeout(() => f(frames * 16), 0); };

await import('../src/main.js');
await new Promise(r => setTimeout(r, 300));
const fatal = document.getElementById('fatal');
if (!fatal.hidden) { console.log('FAIL 오류 화면이 떴어요:\n' + fatal.textContent); process.exit(1); }
if (MODE === 'test') {
  if (document.getElementById('title').hidden || document.getElementById('testbtn').hidden) { console.log('FAIL #test인데 테스트 메뉴가 안 떴어요'); process.exit(1); }
  if (store.size) { console.log('FAIL 테스트 모드가 진짜 저장소에 썼어요'); process.exit(1); }
  console.log(`  ok  #test로 열면 테스트 메뉴가 뜨고, 진짜 저장은 건드리지 않아요 (${frames}프레임)`);
  process.exit(0);
}
const saved = store.get('ultima.save');
if (!saved) { console.log('FAIL 새 게임이 저장되지 않았어요'); process.exit(1); }
const st = JSON.parse(saved);
if (CONTINUE) {
  if (document.getElementById('title').hidden) { console.log('FAIL 저장이 있는데 시작 화면이 안 떴어요'); process.exit(1); }
  console.log(`  ok  저장이 있으면 시작 화면(이어하기)이 뜨고, 뒤에는 ${st.state.map}가 그려져요 (${frames}프레임)`);
} else console.log(`  ok  새 게임이 떴고 ${frames}프레임 그렸어요. 시작 장소: ${st.state.map}, 저장 버전 ${st.save_version}`);
