// 자동 점검 (Node 18 이상): node tests/run.js
// 화면 없이 데이터, 상태, 저장, 퍼즐, 진행 순서, 맵 도달 가능성을 확인한다.
import {readFileSync, existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {DATA_FILES, validateData, validateDevStarts} from '../src/data.js';
import {createLanguage} from '../src/language.js';
import {createScript} from '../src/script.js';
import {createScript as createRenderer} from '../src/scriptRenderer.js';
import * as S0 from '../src/stage0.js';
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
const fakeHost = () => { const log = []; return {log, goto: (m, s) => log.push('goto:' + m + '/' + s), card: id => log.push('card:' + id), openRead: id => log.push('read:' + id), openPuzzle: id => log.push('puzzle:' + id), chapterEnd: n => log.push('end:' + n), say: id => log.push('say:' + id)}; };
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

console.log('범용 기록문자');
const SC = createScript(D.script, D.phonemes, D.graphemes), RD = createRenderer(D.graphemes, D.phonemes);
test('소리 표기를 소리 목록(phonemes.json)으로 읽고 음절 틀을 정한다', () => {
  assert.deepEqual(SC.tokens('kʼãː'), [{cls: 'C', id: 'kʼ'}, {cls: 'V', id: 'ãː'}]);
  assert.deepEqual(SC.tokens('ɡa'), SC.tokens('ga'), "id 'g'와 IPA 'ɡ' 둘 다 읽는다");
  assert.equal(SC.parseSyllable('kʷten').template, 'CCVC');
  assert.equal(SC.parseSyllable('ktkʼa').template, 'CCCV');
  assert.deepEqual(SC.toSpec(SC.parseSyllable('wʌn').segments), {onset: ['w'], nucleus: 'ʌ', coda: ['n']});
  for (const bad of ['x', 'kkkka', 'ʔa']) assert.equal(SC.parseSyllable(bad), null, bad);
});
test('LHS 표기로는 지구 기록의 잊힌 구별이 보이지 않는다 (가안)', () => {
  assert.deepEqual(SC.readable('earth', 'tkʼa'), {ok: true, template: 'CCV', templateKnown: true, unknownMarks: []});
  assert.deepEqual(SC.readable('lhs', 'tkʼa'), {ok: false, template: 'CCV', templateKnown: false, unknownMarks: ['ejective']});
  assert.deepEqual(SC.readable('lhs', 'ma').unknownMarks, [], '공명음 m은 유성이어도 회전 표시가 없다');
});
test('특수 발화 표기: 기호 목록으로 읽고, 해금 조건이 있다', () => {
  assert.deepEqual(SC.contour('↗—‖↘'), ['rise', 'sustain', 'break', 'fall']);
  assert.equal(SC.contour('↗x'), null);
  assert.ok(!check(newState(D.maps.start), D.script.utterance.unlock), '처음에는 쓸 수 없다');
});
test('렌더러: 견본 규칙(회전, 받침 크기, 글자마다 자리 표시)', () => {
  assert.match(RD.renderConsonant('g'), /rotate\(90 25 25\)/);
  assert.match(RD.renderConsonant('kʰ'), /rotate\(180 25 25\)/);
  const w = RD.renderWord(D.stage0.words['감자']);
  assert.match(w, /data-slot="coda0"[^>]*scale\(0\.6\)/, '받침은 60%');
  assert.equal((w.match(/class="part"/g) || []).length, 5, '감자 = 글자 5개');
  assert.throws(() => RD.renderConsonant('l'), '유음 등 미정 글자는 그리지 않는다');
});
// 원본(0-1_game_script)이 있으면, 게임에 복사한 렌더러와 데이터가 원본과 같은지 본다
const SRC = new URL('../../0-1_game_script/', import.meta.url);
test('원본 패키지와 복사본이 같다 (렌더러, 글자 규칙, 소리 목록, 0단계 데이터)', () => {
  if (!existsSync(SRC)) return console.log('       (원본 폴더가 없어 건너뜀)');
  for (const [mine, src] of [['src/scriptRenderer.js', 'src/scriptRenderer.mjs'], ['data/graphemes.json', 'data/graphemes.json'], ['data/phonemes.json', 'data/phonemes.sample.json'], ['data/stage0.json', 'data/stage0.json']])
    assert.equal(readFileSync(new URL('../' + mine, import.meta.url), 'utf8'), readFileSync(new URL(src, SRC), 'utf8'), mine + '가 원본과 다름');
});

console.log('0단계 출발 전 연습 (stage0-design.md 6절)');
const ST = D.stage0, isV = id => D.phonemes.vowels.some(v => v.id === id);
test('비교: 라운드마다 달라진 자리의 글자가 공개 글자와 맞다', () => {
  for (const r of ST.compare) {
    const keys = S0.diffKeys(ST.words[r.a], ST.words[r.b]);
    assert.ok(keys.length, r.a + '/' + r.b);
    for (const k of keys) assert.equal(S0.compareResult(ST, r, k), 'found');
  }
});
test('비교: 같은 글자를 누르면 진행하지 않는다', () => {
  const r = ST.compare[0], all = [...S0.partsOf(ST.words[r.a]).keys()];
  const same = all.filter(k => !S0.diffKeys(ST.words[r.a], ST.words[r.b]).includes(k));
  assert.ok(same.length);
  for (const k of same) assert.equal(S0.compareResult(ST, r, k), 'same');
});
test('읽기: 오답이면 차이 자리를 돌려주고, 정답이어야 넘어간다', () => {
  for (const q of ST.read) {
    assert.deepEqual(S0.readResult(ST, q, q.word), {ok: true, diff: []});
    for (const o of q.options.filter(o => o !== q.word)) { const r = S0.readResult(ST, q, o); assert.ok(!r.ok && r.diff.length, o); }
  }
});
test('쓰기: 칸 종류별 팔레트, 없음은 받침에만, 틀린 칸 표시', () => {
  const known = [...ST.notebookOrder];
  assert.ok(S0.paletteFor(ST, 'nucleus', known, isV).every(isV));
  assert.ok(S0.paletteFor(ST, 'onset0', known, isV).every(id => !isV(id) && id !== ''));
  assert.ok(S0.paletteFor(ST, 'coda0', known, isV).includes(''));
  assert.ok(!S0.paletteFor(ST, 'onset0', known, isV).includes(''));
  const target = ST.write[0], right = ST.words[target].map(w => ({onset0: w.onset[0], nucleus: w.nucleus, coda0: w.coda[0] ?? ''}));
  assert.deepEqual(S0.writeWrong(ST, target, right), []);
  const off = structuredClone(right); off[0].coda0 = '';
  assert.deepEqual(S0.writeWrong(ST, target, off), ['0:coda0']);
  assert.ok(S0.writeWrong(ST, target, right.map(() => ({onset0: null, nucleus: null, coda0: null}))).length === 6, '빈 칸은 모두 틀림');
});
test('끝까지 하면 글자 8개, 규칙 5개를 얻고 저장에 남는다', () => {
  const s = newState(D.maps.start);
  S0.resetProgress(s.decipher, ST);
  ST.compare.forEach((r, i) => S0.learn(s.decipher, r.reveal, D.story.ui.study0.rules[i]));
  assert.equal(s.decipher.known.length, 8);
  assert.equal(s.decipher.rules.length, 5);
  for (const w of ST.write) for (const syl of ST.words[w]) for (const id of [...syl.onset, syl.nucleus, ...syl.coda]) assert.ok(s.decipher.known.includes(id), '쓰기에 필요한 글자: ' + id);
  const st = memStorage(); assert.ok(writeSave(st, s, 'test'));
  assert.deepEqual(readSave(st).state.decipher, s.decipher);
  S0.resetProgress(s.decipher, ST);
  assert.deepEqual(s.decipher, {known: ['a'], rules: []}, '처음부터 다시');
});
test('0단계 데이터 검증: 공개 글자 불일치, 없는 단어, 정답과 같은 보기를 잡아낸다', () => {
  const bad = load();
  bad.stage0.compare[0].reveal = ['m'];
  bad.stage0.read[0].options.push('없는말');
  bad.stage0.words['강사2'] = bad.stage0.words['강사']; bad.stage0.read[0].options.push('강사2');
  const errs = validateData(bad).join('\n');
  for (const x of ["달라진 글자 'ŋ'를 공개하지 않음", "없는 단어 '없는말'", "보기 '강사2'가 정답과 같은 기록"]) assert.ok(errs.includes(x), '못 잡음: ' + x);
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
test('v3 저장(해독 진행 없음)을 v4로 변환해서 불러오고, 형식이 틀린 해독 진행은 거부한다', () => {
  const s = newState(D.maps.start); delete s.decipher; s.solved.study0 = true;
  const r = parse(JSON.stringify({save_version: 3, state: s})); assert.ok(r.ok, r.error);
  assert.deepEqual(r.state.decipher, {known: [], rules: []}); assert.ok(r.state.solved.study0);
  const bad = newState(D.maps.start); bad.decipher.known = [1];
  assert.equal(parse(serialize(bad, 't')).ok, false);
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
  const s = newState(D.maps.start); mark(s, 'event', 'approved');
  say(s, 'grandma'); assert.ok(s.events.family_goodbye);
  const v = pickVariant(D.story.dialogues.grandma, s); assert.equal(v.lines.length, 1);
  const h = fakeHost(); say(s, 'after_animals', h); say(s, 'after_animals', h); assert.ok(s.events.forward_note);
});

console.log('진행 순서');
const mats = ['mat_timeline', 'mat_sat', 'mat_catalog'];
test('0단계: 공부 → 신청 → 자료 → 승인 → 작별 순서로만 승강장 문이 열린다', () => {
  const s = newState(D.maps.start);
  assert.ok(!doorOpen(s, 'door1'));
  assert.deepEqual(say(s, D.story.reads.plan.after).log, [], '방을 둘러보기 전에 공부가 시작됨');
  for (const r of ['diary', 'earthmap', 'history', 'plan']) mark(s, 'read', r);
  assert.deepEqual(say(s, D.story.reads.plan.after).log, ['puzzle:study0']);
  let h = fakeHost(); runEffects(solve(D.puzzles.puzzles.find(p => p.id === 'study0'), s), s, h);
  assert.ok(doorOpen(s, 'door1')); assert.deepEqual(h.log, ['card:study_days', 'read:study_cert']);
  assert.ok(!s.events.approved, '공부만으로 승인됨');
  assert.deepEqual(say(s, 'apply').log, ['read:application']); say(s, D.story.reads.application.after); assert.ok(s.events.applied);
  for (const m of mats.slice(0, 2)) mark(s, 'read', m);
  assert.deepEqual(say(s, 'apply').log, [], '자료 2건으로 가설 제출이 열림');
  mark(s, 'read', mats[2]); assert.deepEqual(say(s, 'apply').log, ['puzzle:hypothesis0']);
  h = fakeHost(); runEffects(solve(D.puzzles.puzzles.find(p => p.id === 'hypothesis0'), s, '도서관까지 걸어서'), s, h);
  assert.ok(s.events.approved); assert.deepEqual(h.log, ['card:weeks_later', 'read:approval']);
  assert.ok(!doorOpen(s, 'door4'));
  say(s, 'friendA'); assert.ok(!doorOpen(s, 'door4')); say(s, 'grandma'); assert.ok(!doorOpen(s, 'door4'));
  assert.ok(say(s, 'prof').log.includes('read:brief')); assert.ok(doorOpen(s, 'door4'));
});
test('0 → 1단계(장치 점검 → 성간선)와 1단계 → 2단계', () => {
  const s = newState(D.maps.start); for (const e of ['approved', 'family_goodbye', 'friends_goodbye', 'kit_given']) mark(s, 'event', e);
  let h = say(s, 'gate'); assert.equal(s.chapter, 0, '장치 점검 없이 탐'); assert.deepEqual(h.log, []);
  h = say(s, 'relaydesk'); assert.deepEqual(h.log, ['puzzle:relay_read']);
  const p = D.puzzles.puzzles.find(x => x.id === 'relay_read');
  runEffects(solve(p, s), s, fakeHost()); say(s, p.after); assert.ok(s.events.relay_understood);
  h = say(s, 'gate'); assert.equal(s.chapter, 1); assert.deepEqual(h.log, ['goto:base/arrive', 'card:stage1']);
  say(s, 'arrive_base'); assert.equal(pickVariant(D.story.dialogues.arrive_base, s), null, '도착 혼잣말이 또 나옴');
  assert.deepEqual(say(s, 'rover_base').log, [], '1단계 중에 탐사 차량이 출발함');
  mark(s, 'seen', 'rec7'); say(s, 'after_table'); assert.deepEqual(say(s, 'comm').log, ['puzzle:report1']);
  h = fakeHost(); runEffects(solve(D.puzzles.puzzles.find(p => p.id === 'report1'), s, '지구는 죽었다'), s, h);
  assert.equal(s.chapter, 2); assert.deepEqual(h.log, ['say:after_report1']);
  assert.deepEqual(say(s, 'comm').log, [], '보고서를 두 번 보냄');
  assert.deepEqual(say(s, 'rover_base').log, ['goto:ruins/arrive', 'card:stage2']);
});
test('2 → 3 → 4 → 5단계, 엔딩까지 (언어 게임 자리는 완료 처리)', () => {
  const s = newState(D.maps.start); s.chapter = 2; for (const e of ['report1_sent']) mark(s, 'event', e); mark(s, 'visited', 'ruins');
  const ph = id => { const eff = solve(D.puzzles.puzzles.find(p => p.id === id), s); assert.ok(eff, id + '가 풀리지 않음'); const h = fakeHost(); runEffects(eff, s, h); return h; };
  assert.deepEqual(say(s, 'rover_ruins').log, ['goto:base/fromRover'], '다 보기 전에 2단계가 끝남');
  for (const r of ['spot_meadow', 'spot_doorstep', 'spot_meal']) mark(s, 'read', r);
  say(s, 'launch_trace'); assert.deepEqual(say(s, 'inscription2').log, ['puzzle:p2_reverse']); ph('p2_reverse');
  assert.deepEqual(say(s, 'rover_ruins').log, ['goto:base/fromRover', 'card:stage3']); assert.equal(s.chapter, 3);
  assert.deepEqual(say(s, 'bench').log, ['puzzle:p3_order']); ph('p3_order');
  assert.deepEqual(say(s, 'bench').log, ['puzzle:p3_evidence']); ph('p3_evidence');
  assert.deepEqual(say(s, 'bench').log, [], '회신을 보기 전에 보고서 수정이 열림');
  assert.deepEqual(say(s, 'inbox').log, ['read:reply_carbon']); mark(s, 'read', 'reply_carbon');
  assert.deepEqual(say(s, 'bench').log, ['puzzle:report2']); solve(D.puzzles.puzzles.find(p => p.id === 'report2'), s, '지구가 죽었다고 들었다');
  say(s, 'bench'); assert.ok(s.events.stage3_done); assert.equal(s.chapter, 4);
  assert.deepEqual(say(s, 'rover_base').log, ['goto:dwelling/arrive', 'card:stage4']); mark(s, 'visited', 'dwelling');
  assert.deepEqual(say(s, 'rover_dwell').log, ['goto:base/fromRover'], '마지막 기록 없이 4단계가 끝남');
  for (const [o, id] of [['doorframe', 'p4_frame'], ['seenrecord', 'p4_seen'], ['lastrecord', 'p4_last']]) { assert.deepEqual(say(s, o).log, ['puzzle:' + id]); ph(id); }
  assert.deepEqual(say(s, 'rover_dwell').log, ['goto:base/fromRover', 'card:stage5']); assert.equal(s.chapter, 5);
  assert.deepEqual(say(s, 'bench').log, ['puzzle:p5_final']); ph('p5_final');
  assert.deepEqual(say(s, 'bench').log, ['puzzle:report_final']);
  const h = fakeHost(); runEffects(solve(D.puzzles.puzzles.find(p => p.id === 'report_final'), s, '우리라고 불렀다'), s, h);
  assert.deepEqual(h.log, ['say:ending']); assert.deepEqual(say(s, 'ending').log, ['end:5']);
});

console.log('개발용 테스트 시작 지점');
test('테스트 시작 지점 데이터 검증 통과', () => assert.deepEqual(validateDevStarts(D, DEV), []));
test('테스트 시작 지점: 잘못된 장소와 상태를 잡아낸다', () => {
  const bad = {starts: [{id: 'x', map: 'nowhere', spawn: 'entry', chapter: 0, set: ['flag:x']}]};
  const errs = validateDevStarts(D, bad).join('\n'); assert.ok(errs.includes('없는 장소') && errs.includes("잘못된 상태 'flag:x'"));
});
test('테스트 시작 지점마다 그 장소의 다음 할 일 바로 앞에서 시작한다', () => {
  const make = id => { const p = DEV.starts.find(x => x.id === id), s = newState(D.maps.start); s.chapter = p.chapter; for (const c of p.set) { const [k, v] = c.split(':'); mark(s, k, v); } return s; };
  assert.deepEqual(say(make('s0_lab_apply'), 'apply').log, ['read:application']);
  assert.deepEqual(say(make('s0_lab_wait'), 'apply').log, ['puzzle:hypothesis0']);
  assert.ok(say(make('s0_home_bye'), 'grandma').log.length === 0 && !doorOpen(make('s0_home_bye'), 'door4'));
  assert.ok(doorOpen(make('s0_dock'), 'door4')); assert.deepEqual(say(make('s0_dock'), 'relaydesk').log, ['puzzle:relay_read']);
  assert.deepEqual(say(make('s1_report'), 'comm').log, ['puzzle:report1']);
  assert.deepEqual(say(make('s2_ruins'), 'inscription2').log, ['puzzle:p2_reverse']);
  assert.deepEqual(say(make('s3_inside'), 'bench').log, ['puzzle:p3_order']);
  assert.deepEqual(say(make('s4_dwelling'), 'lastrecord').log, ['puzzle:p4_last']);
  assert.deepEqual(say(make('s5_inside'), 'bench').log, ['puzzle:p5_final']);
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
