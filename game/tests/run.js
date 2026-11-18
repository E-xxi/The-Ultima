// 자동 점검 (Node 18 이상): node tests/run.js
// 화면 없이 데이터, 상태, 저장, 퍼즐, 진행 순서, 맵 도달 가능성을 확인한다.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {DATA_FILES, validateData, validateDevStarts} from '../src/data.js';
import {createLanguage} from '../src/language.js';
import {newState, check, mark, addGlyph, setGuess, CELLS, GUESS_MAX} from '../src/state.js';
import {pickVariant, runEffects} from '../src/story.js';
import {solve, PUZZLE_TYPES} from '../src/puzzles.js';
import {SAVE_VERSION, KEY, serialize, parse, writeSave, readSave} from '../src/save.js';
import {buildMap, blocked, nearest} from '../src/world.js';

const load = () => Object.fromEntries(DATA_FILES.map(n => [n, JSON.parse(readFileSync(new URL(`../data/${n}.json`, import.meta.url), 'utf8'))]));
const D = load(), lang = createLanguage(D.language);
const DEV = JSON.parse(readFileSync(new URL('../data/dev.json', import.meta.url), 'utf8'));
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e.message || e)); }
}
const memStorage = () => { const m = new Map(); return {m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k)}; };
// 화면 없이 효과를 받아 두는 가짜 host
const fakeHost = () => { const log = []; return {log, goto: (m, s) => log.push('goto:' + m + '/' + s), card: id => log.push('card:' + id), openRead: id => log.push('read:' + id), openPuzzle: id => log.push('puzzle:' + id), chapterEnd: n => log.push('end:' + n)}; };
const say = (state, id, host = fakeHost()) => { const v = pickVariant(D.story.dialogues[id], state); if (v) runEffects(v.effects, state, host); return host; };
const doorOpen = (state, id) => check(state, D.maps.doors[id].when);

console.log('데이터');
test('게임 데이터 검증 통과', () => assert.deepEqual(validateData(D), []));
test('중복 id, 없는 참조, 잘못된 조건을 잡아낸다', () => {
  const bad = load();
  bad.language.speaker.morphemes.push({...bad.language.speaker.morphemes[0]});
  bad.records.records[0].lines[0].words[0] = ['nothing'];
  bad.maps.doors.door1.when = ['flag:diary'];
  bad.maps.maps[0].objects.find(o => o.use).use = 'dialogue:no_such';
  const errs = validateData(bad).join('\n');
  for (const s of ["형태소: id 중복 'grass'", "없는 형태소 'nothing'", "잘못된 조건 'flag:diary'", "잘못된 use 'dialogue:no_such'"]) assert.ok(errs.includes(s), '못 잡음: ' + s);
});
test('일기 쪽에 날짜나 내용이 빠지면 잡아낸다', () => {
  const bad = load(); bad.story.reads.diary.pages[1].lines = [];
  assert.ok(validateData(bad).join('\n').includes("문서 'diary' 2쪽: 날짜나 내용이 없음"));
});
test('아이템: 잘못된 쓰임, 조건, 이름 빠짐을 잡아낸다', () => {
  const bad = load(); bad.story.items.push({id: 'x', icon: 'bookIcon', when: 'flag:y', use: 'read:nothing'});
  const errs = validateData(bad).join('\n');
  for (const s of ["잘못된 조건 'flag:y'", "잘못된 use 'read:nothing'", "아이템 'x': 이름(label)이 없음"]) assert.ok(errs.includes(s), '못 잡음: ' + s);
});
test('모든 소리가 기계 표기로 쓰이고 한글로 읽힌다', () => {
  for (const m of D.language.speaker.morphemes) for (const s of m.sound) assert.ok(lang.hangul(s).length === 1, s);
  assert.equal(['mi', 'u', 'ka'].map(lang.hangul).join(''), '미우카');
});

console.log('저장');
test('저장 → 불러오기 하면 진행도가 그대로 돌아온다', () => {
  const st = memStorage(), s = newState(D.maps.start);
  mark(s, 'event', 'kit_given'); mark(s, 'read', 'diary'); s.solved.practice = true; s.chapter = 1; s.map = 'library'; s.pos = {x: 50, y: 70, dir: 'up'};
  addGlyph(s, {k: 's', id: 'tree'}); s.notebook.pages[0].t = '나무?';
  assert.ok(writeSave(st, s, 'test'));
  const r = readSave(st); assert.ok(r.ok, r.error); assert.deepEqual(r.state, s);
  assert.equal(JSON.parse(st.m.get(KEY)).save_version, SAVE_VERSION);
});
test('이전 버전(v0) 저장을 변환해서 불러온다', () => {
  const v0 = JSON.stringify({map: 'base', px: 104, py: 138, flags: {permit: true, practiced: true, family: true, friends: true, arrived: true, seen: {rec1: true}}, book: {cur: 1, pages: Array.from({length: 5}, () => ({g: [], t: ''}))}});
  const r = parse(v0); assert.ok(r.ok, r.error);
  assert.ok(r.state.events.kit_given && r.state.solved.practice && r.state.seen.rec1);
  assert.equal(r.state.chapter, 1); assert.equal(r.state.notebook.cur, 1); assert.equal(r.state.pos.x, 104);
});
test('본 저장이 망가지면 임시 저장을 쓰고, 둘 다 망가지면 거부한다', () => {
  const st = memStorage(), good = serialize(newState(D.maps.start), 't');
  st.setItem(KEY, '{망가짐'); st.setItem(KEY + '.tmp', good);
  assert.ok(readSave(st).ok);
  st.setItem(KEY + '.tmp', '{"save_version":1,"state":{"chapter":"x"}}');
  assert.equal(readSave(st).ok, false);
});
test('더 새로운 버전의 저장은 덮어쓰지 않고 거부한다', () => {
  assert.equal(parse(JSON.stringify({save_version: SAVE_VERSION + 1, state: {}})).ok, false);
});
test('저장 도중 실패해도 앞 저장은 남는다', () => {
  const st = memStorage(), s = newState(D.maps.start);
  writeSave(st, s, 't'); const before = st.m.get(KEY);
  const broken = {...st, setItem: () => { throw new Error('공간 없음'); }};
  assert.equal(writeSave(broken, s, 't'), false); assert.equal(st.m.get(KEY), before);
});
test('노트 칸 수, 쪽 수 제한을 넘는 저장은 거부한다', () => {
  const s = newState(D.maps.start); s.notebook.pages[0].g = Array.from({length: CELLS + 1}, () => ({k: 's', id: 'tree'}));
  assert.equal(parse(serialize(s, 't')).ok, false);
});

test('v1 저장(추측 칸 없음)을 v2로 변환해서 불러온다', () => {
  const s = newState(D.maps.start); delete s.guesses; s.events.kit_given = true;
  const r = parse(JSON.stringify({save_version: 1, state: s})); assert.ok(r.ok, r.error);
  assert.deepEqual(r.state.guesses, {}); assert.ok(r.state.events.kit_given);
});
test('추측은 10글자까지, 비우면 지워지고, 형식이 틀린 추측 저장은 거부한다', () => {
  const s = newState(D.maps.start);
  setGuess(s, 's:tree', '  나무인것같다아마도요  '); assert.equal(s.guesses['s:tree'].length, GUESS_MAX);
  setGuess(s, 's:tree', ''); assert.equal('s:tree' in s.guesses, false);
  s.guesses['s:tree'] = '가'.repeat(GUESS_MAX + 1); assert.equal(parse(serialize(s, 't')).ok, false);
});

console.log('퍼즐과 사건');
test('퍼즐은 조건 전에는 안 풀리고, 한 번만 풀린다', () => {
  const s = newState(D.maps.start), p = D.puzzles.puzzles.find(x => x.id === 'relay_read');
  assert.equal(solve(p, s), null);
  mark(s, 'event', 'relay_spoken');
  assert.deepEqual(solve(p, s), p.on_solve); assert.equal(solve(p, s), null);
});
test('중계기 점검 읽기: 맞는 조각만 통과하고, 다 읽으면 타네오루케요 (다녀올게요를 어설프게 받아 적음)', () => {
  const p = D.puzzles.puzzles.find(x => x.id === 'relay_read'), t = PUZZLE_TYPES.compose_syllables;
  assert.ok(t.checkStep(p, lang, 0, 0, {c: 't', v: 'a'}));
  assert.ok(!t.checkStep(p, lang, 0, 0, {c: 'n', v: 'a'}));
  assert.equal(p.words[0].map(lang.hangul).join(''), '타네오루케요');
  assert.equal(p.intro_text, 'daneoallgaeyo');
});
test('보고서: 빈 해석은 받지 않는다', () => {
  const s = newState(D.maps.start), p = D.puzzles.puzzles.find(x => x.id === 'report1');
  mark(s, 'event', 'table_found'); mark(s, 'seen', 'rec7');
  assert.equal(solve(p, s, '   '), null);
  assert.deepEqual(solve(p, s, '지구는 죽었다'), p.on_solve); assert.equal(s.answers.report1, '지구는 죽었다');
});
test('같은 사건은 두 번 일어나지 않는다 (대사가 바뀐다)', () => {
  const s = newState(D.maps.start);
  say(s, 'grandma'); assert.ok(s.events.family_goodbye);
  const v = pickVariant(D.story.dialogues.grandma, s); assert.equal(v.lines.length, 1);
  const h = fakeHost(); say(s, 'after_animals', h); say(s, 'after_animals', h); assert.ok(s.events.forward_note);
});

console.log('진행 순서');
test('0단계: 문은 정해진 순서로만 열린다', () => {
  const s = newState(D.maps.start);
  assert.ok(!doorOpen(s, 'door1'));
  mark(s, 'read', 'diary'); mark(s, 'read', 'history'); assert.ok(!doorOpen(s, 'door1'), '허가서 없이 열림');
  mark(s, 'read', 'permit'); assert.ok(doorOpen(s, 'door1'));
  assert.ok(!doorOpen(s, 'door2')); say(s, 'sibling'); assert.ok(!doorOpen(s, 'door2')); say(s, 'grandma'); assert.ok(doorOpen(s, 'door2'));
  assert.ok(!doorOpen(s, 'door3')); say(s, 'friendB'); assert.ok(doorOpen(s, 'door3'));
  assert.ok(!doorOpen(s, 'door4'));
  const h = say(s, 'prof'); assert.ok(h.log.includes('read:brief')); assert.ok(doorOpen(s, 'door4'), '기록지를 받았는데 승강장 문이 안 열림');
  assert.deepEqual(say(s, 'terminalP').log, [], '연구실 단말기가 아직 퍼즐을 연다');
});
test('0 → 1단계 전환(중계기 점검 → 셔틀)과 1단계 끝까지', () => {
  const s = newState(D.maps.start); mark(s, 'event', 'kit_given');
  let h = say(s, 'gate'); assert.equal(s.chapter, 0, '중계기 점검 없이 셔틀에 탐'); assert.deepEqual(h.log, []);
  h = say(s, 'relaydesk'); assert.deepEqual(h.log, ['puzzle:relay_read']); assert.ok(s.events.relay_spoken);
  h = say(s, 'relaydesk'); assert.deepEqual(h.log, ['puzzle:relay_read'], '읽기를 끝내지 않고 닫으면 다시 열려야 함');
  assert.deepEqual(say(s, 'gate').log, [], '읽기 전에 셔틀에 탐');
  const p = D.puzzles.puzzles.find(x => x.id === 'relay_read');
  runEffects(solve(p, s), s, fakeHost()); assert.ok(s.events.relay_checked);
  say(s, p.after); assert.ok(s.events.relay_understood);
  assert.equal(pickVariant(D.story.dialogues[p.after], s), null, '뜻이 밝혀지는 혼잣말이 또 나옴');
  assert.deepEqual(say(s, 'relaydesk').log, [], '점검 화면이 또 열림');
  h = say(s, 'gate'); assert.equal(s.chapter, 1); assert.deepEqual(h.log, ['goto:base/arrive', 'card:stage1']);
  say(s, 'arrive_base'); assert.ok(s.events.arrived_earth); assert.equal(pickVariant(D.story.dialogues.arrive_base, s), null, '도착 혼잣말이 또 나옴');
  h = say(s, 'comm'); assert.deepEqual(h.log, [], '표 없이 보고서가 열림');
  mark(s, 'seen', 'rec7'); say(s, 'after_table'); h = say(s, 'comm'); assert.deepEqual(h.log, ['puzzle:report1']);
  const eff = solve(D.puzzles.puzzles.find(p => p.id === 'report1'), s, '지구는 죽었다');
  h = fakeHost(); runEffects(eff, s, h); assert.deepEqual(h.log, ['end:1']);
  h = say(s, 'comm'); assert.deepEqual(h.log, [], '보고서를 두 번 보냄');
});

console.log('개발용 테스트 시작 지점');
test('테스트 시작 지점 데이터 검증 통과', () => assert.deepEqual(validateDevStarts(D, DEV), []));
test('테스트 시작 지점: 잘못된 장소와 상태를 잡아낸다', () => {
  const bad = {starts: [{id: 'x', map: 'nowhere', spawn: 'entry', chapter: 0, set: ['flag:x']}]};
  const errs = validateDevStarts(D, bad).join('\n'); assert.ok(errs.includes('없는 장소') && errs.includes("잘못된 상태 'flag:x'"));
});
test('테스트 시작 지점마다 그 장소의 다음 할 일 바로 앞에서 시작한다', () => {
  const make = id => { const p = DEV.starts.find(x => x.id === id), s = newState(D.maps.start); s.chapter = p.chapter; for (const c of p.set) { const [k, v] = c.split(':'); mark(s, k, v); } return s; };
  assert.ok(doorOpen(make('s0_home'), 'door1') && !doorOpen(make('s0_home'), 'door2'));
  assert.ok(doorOpen(make('s0_plaza'), 'door2') && !doorOpen(make('s0_plaza'), 'door3'));
  assert.ok(doorOpen(make('s0_lab'), 'door3') && !doorOpen(make('s0_lab'), 'door4'));
  assert.ok(doorOpen(make('s0_dock'), 'door4'));
  assert.deepEqual(say(make('s1_report'), 'comm').log, ['puzzle:report1']);
  assert.deepEqual(say(make('s1_library'), 'comm').log, []);
});

console.log('맵');
test('모든 장소: 시작점에서 걸어서 모든 조사 대상에 닿는다', () => {
  for (const def of D.maps.maps) {
    const m = buildMap(def);
    for (const [name, [sx, sy]] of Object.entries(def.spawns)) {
      assert.ok(!blocked(m, sx, sy), `${def.id}/${name} 시작점이 막혀 있음`);
      const seen = new Set([sx + ',' + sy]), q = [[sx, sy]], found = new Set(), p = {x: 0, y: 0, dir: 'down'};
      while (q.length) {
        const [x, y] = q.shift(); p.x = x; p.y = y;
        for (const d of ['up', 'down', 'left', 'right']) { p.dir = d; const o = nearest(m, p); if (o) found.add(o.id); }
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
          const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
          if (!seen.has(k) && !blocked(m, nx, ny)) { seen.add(k); q.push([nx, ny]); }
        }
      }
      const miss = m.objs.filter(o => o.use && !found.has(o.id)).map(o => o.id);
      assert.deepEqual(miss, [], `${def.id}/${name}에서 닿지 않음`);
    }
  }
});

console.log(failed ? `\n${failed}개 실패` : '\n모두 통과');
process.exit(failed ? 1 : 0);
