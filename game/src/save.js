// 저장과 불러오기. 저장소(storage)는 getItem/setItem/removeItem만 있으면 된다(브라우저 localStorage, 테스트용 가짜 등).
// 나중에 엔진이나 Steam Cloud로 옮겨도 이 파일의 형식(save_version, 변환, 검증)은 그대로 쓴다.
import {newState, PAGES, CELLS, MEMO_MAX, GUESS_MAX} from './state.js';

export const SAVE_VERSION = 2;
export const KEY = 'ultima.save';
const TMP = 'ultima.save.tmp';

// 이전 형식 → 다음 형식. v0은 저장 기능이 생기기 전 시안의 상태 모양({flags, book, map, px, py}).
const MIGRATIONS = {
  0: (old) => {
    const f = old.flags || {}, s = newState({map: old.map || 'myroom'});
    if (f.family) s.events.family_goodbye = true;
    if (f.friends) s.events.friends_goodbye = true;
    if (f.permit) s.events.kit_given = true;
    if (f.practiced) s.solved.practice = true;
    if (f.arrived) s.events.arrived_earth = true;
    if (f.table) s.events.table_found = true;
    if (f.forward) s.events.forward_note = true;
    if (f.reported) s.events.report1_sent = true;
    Object.assign(s.seen, f.seen || {});
    if (old.book && Array.isArray(old.book.pages)) s.notebook = {cur: old.book.cur || 0, pages: old.book.pages};
    if (typeof old.px === 'number') s.pos = {x: old.px, y: old.py, dir: 'down'};
    s.chapter = f.permit && f.arrived ? 1 : 0;
    return {save_version: 1, state: s};
  },
  // v1 → v2: 글자마다 적는 추측(guesses)이 생겼다
  1: (s) => ({save_version: 2, state: {...s, guesses: {}}}),
};

export function serialize(state, gameVersion) {
  return JSON.stringify({save_version: SAVE_VERSION, game_version: gameVersion, saved_at: new Date().toISOString(), state});
}

// 문자열 → {ok, state, error}. 오래된 형식은 차례로 변환하고, 모양이 틀리면 거부한다.
export function parse(raw) {
  let doc;
  try { doc = JSON.parse(raw); } catch (e) { return {ok: false, error: '저장 파일을 읽을 수 없음'}; }
  if (!doc || typeof doc !== 'object') return {ok: false, error: '저장 파일 형식이 아님'};
  let v = typeof doc.save_version === 'number' ? doc.save_version : 0;
  if (v > SAVE_VERSION) return {ok: false, error: '더 새로운 버전의 저장 파일'};
  while (v < SAVE_VERSION) {
    if (!MIGRATIONS[v]) return {ok: false, error: '변환할 수 없는 저장 버전 ' + v};
    doc = MIGRATIONS[v](v === 0 && !doc.state ? doc : doc.state);
    v = doc.save_version;
  }
  const err = validateState(doc.state);
  return err ? {ok: false, error: err} : {ok: true, state: doc.state};
}

export function validateState(s) {
  if (!s || typeof s !== 'object') return '상태 없음';
  if (typeof s.chapter !== 'number' || typeof s.map !== 'string') return '단계나 장소가 없음';
  for (const f of ['events', 'read', 'seen', 'solved', 'visited', 'discovered', 'answers', 'guesses']) {
    if (!s[f] || typeof s[f] !== 'object' || Array.isArray(s[f])) return f + ' 형식이 틀림';
  }
  for (const [k, v] of Object.entries(s.guesses)) if (typeof v !== 'string' || v.length > GUESS_MAX || !/^[ms]:/.test(k)) return '추측 형식이 틀림';
  if (s.pos !== null && (typeof s.pos !== 'object' || typeof s.pos.x !== 'number' || typeof s.pos.y !== 'number')) return '위치 형식이 틀림';
  const nb = s.notebook;
  if (!nb || !Array.isArray(nb.pages) || nb.pages.length !== PAGES) return '노트 장수가 틀림';
  if (typeof nb.cur !== 'number' || nb.cur < 0 || nb.cur >= PAGES) return '노트 쪽 번호가 틀림';
  for (const p of nb.pages) {
    if (!Array.isArray(p.g) || p.g.length > CELLS || typeof p.t !== 'string' || p.t.length > MEMO_MAX) return '노트 쪽 형식이 틀림';
    for (const q of p.g) if (!q || (q.k !== 'm' && q.k !== 's') || typeof q.id !== 'string') return '노트 글자 형식이 틀림';
  }
  return null;
}

// 쓰는 도중 끊겨도 앞 저장이 남도록: 임시 키에 먼저 쓰고, 본 키로 옮긴 뒤 임시 키를 지운다.
export function writeSave(storage, state, gameVersion) {
  try {
    const raw = serialize(state, gameVersion);
    storage.setItem(TMP, raw);
    storage.setItem(KEY, raw);
    storage.removeItem(TMP);
    return true;
  } catch (e) { return false; }
}

// 본 키가 망가졌으면 임시 키를 쓴다. 둘 다 없으면 {ok:false, empty:true}.
export function readSave(storage) {
  let main = null, tmp = null;
  try { main = storage.getItem(KEY); tmp = storage.getItem(TMP); } catch (e) { return {ok: false, error: '저장소에 접근할 수 없음'}; }
  if (!main && !tmp) return {ok: false, empty: true};
  const a = main ? parse(main) : {ok: false};
  if (a.ok) return a;
  const b = tmp ? parse(tmp) : {ok: false};
  return b.ok ? b : (main ? a : b);
}

export function clearSave(storage) {
  try { storage.removeItem(KEY); storage.removeItem(TMP); return true; } catch (e) { return false; }
}
