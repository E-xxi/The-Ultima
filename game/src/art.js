// 픽셀 그림. 이미지 파일 없이 코드로 찍는다. 글자 모양은 language.js에서, 기록 내용은 records.json에서 받는다.
export function createArt(lang, records) {
const PAL = {
  ol:'#1e1a24',
  ceil:'#1b1922', ceil2:'#24212c',
  conc:'#5d5b69', concL:'#777583', concD:'#403e4b',
  tile:'#8b8894', tileL:'#a19eaa', tileD:'#716e7b',
  wood:'#8a5f3e', woodL:'#a3754f', woodD:'#6b4730', woodK:'#3a2a22',
  sand:'#d8b47a', sand2:'#c9a46c', sand3:'#e6c897', sandD:'#c49a62',
  dirt:'#bb9466', dirt2:'#a8845a',
  stone:'#b9a48b', stone2:'#9e8871', stoneL:'#d5c3a8', stoneD:'#7b6654',
  metal:'#6f7d88', metalL:'#8a99a4', metalD:'#4d5963', steel:'#c9cfd6',
  white:'#e3e8ec', panel:'#c9d1d9', panelD:'#a9b3bc', panelK:'#8e99a3', floorM:'#9aa5ae', floorML:'#b4bec6', floorMD:'#7f8a94',
  carpet:'#6a5a7a', carpetL:'#7b6b8b', space:'#0b0f24', padY:'#d8b23a', padK:'#5a5e66',
  screen:'#1b2026', cyan:'#5fd0c0',
  paper:'#e8dfc8', paperD:'#d2c6a8', folio:'#d9ccae', stain:'#c4b590', tape:'#efede4', tapeD:'#c8c4b8',
  card:'#efe6cf', print:'#3b5b8a', guide:'#b8ab8a',
  mInk:'#2f3340', sInk:'#3a2230', red:'#a8432e',
  skin:'#e8b796', skinD:'#c98d6e', hair:'#3b2a28',
  suit:'#d9dde2', suitD:'#a9b0b9', visor:'#3f7a7a', pack:'#6f7d88', boot:'#4a3226', accent:'#d89a3a',
  cloth:'#8a3a3a', clothY:'#c9a14a', blanket:'#5f7a8a', clay:'#b5764a', clayL:'#cf9465',
  leaf:'#6a9a48', leafD:'#4f7c36', trunk:'#7d5537', rust:'#c96a4f'
};

function drawBits(g, bits, x, y, col, s = 1) {
  g.fillStyle = col;
  bits.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') g.fillRect(x + i * s, y + j * s, s, s); });
}
function drawQ(g, q, col) { drawBits(g, lang.bits(q), q.x, q.y, col || q.col || (q.k === 'm' ? PAL.mInk : PAL.sInk)); }

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function hexRGB(h) { return [1,3,5].map(i => parseInt(h.slice(i, i + 2), 16)); }
function outline(c, col = PAL.ol) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  const d = g.getImageData(0, 0, w, h), a = d.data, src = new Uint8ClampedArray(a), [r, gg, b] = hexRGB(col);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (src[i + 3]) continue;
    if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 7]) || (y > 0 && src[i - w * 4 + 3]) || (y < h - 1 && src[i + w * 4 + 3])) {
      a[i] = r; a[i + 1] = gg; a[i + 2] = b; a[i + 3] = 255;
    }
  }
  g.putImageData(d, 0, 0);
}
function sprite(w, h, fn, ol = true) {
  const c = mk(w, h), g = c.getContext('2d');
  const R = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
  const P = (x, y, col) => R(x, y, 1, 1, col);
  fn(R, P, g);
  if (ol) outline(c);
  return c;
}
/* ================= tiles ================= */
const tiles = {};
// 도서관 (콘크리트)
tiles.ceil = sprite(16, 16, (R, P) => { R(0, 0, 16, 16, PAL.ceil); P(3, 4, PAL.ceil2); P(11, 9, PAL.ceil2); P(7, 13, PAL.ceil2); }, false);
tiles.faceHigh = sprite(16, 16, (R) => {
  R(0, 0, 16, 16, PAL.conc); R(0, 0, 16, 1, PAL.ol); R(0, 1, 16, 1, PAL.concL);
  R(0, 9, 16, 1, PAL.concD); R(7, 1, 1, 8, PAL.concD); R(13, 10, 1, 6, PAL.concD);
}, false);
tiles.faceLow = [0, 1].map(v => sprite(16, 16, (R, P) => {
  R(0, 0, 16, 16, PAL.conc); R(0, 6, 16, 1, PAL.concD); R(11, 0, 1, 6, PAL.concD); R(3, 7, 1, 6, PAL.concD);
  R(0, 13, 16, 3, PAL.concD); R(0, 13, 16, 1, PAL.ol);
  if (v) { R(6, 2, 1, 4, '#4a4655'); P(7, 5, '#4a4655'); R(9, 8, 2, 4, '#55535f'); }
}, false));
// 이주 행성 거주 구역 (흰 패널)
tiles.cCeil = sprite(16, 16, (R, P) => { R(0, 0, 16, 16, '#2a3140'); P(4, 4, '#353d4e'); P(12, 11, '#353d4e'); }, false);
tiles.cFaceHigh = sprite(16, 16, (R) => {
  R(0, 0, 16, 16, PAL.panel); R(0, 0, 16, 1, PAL.ol); R(0, 1, 16, 1, PAL.white); R(0, 9, 16, 1, PAL.panelD); R(4, 3, 8, 4, '#bcc5cd');
}, false);
tiles.cFaceLow = sprite(16, 16, (R) => {
  R(0, 0, 16, 16, PAL.panel); R(0, 5, 16, 1, PAL.panelD); R(2, 8, 12, 1, '#7fd8cc'); R(0, 12, 16, 4, PAL.panelK); R(0, 12, 16, 1, PAL.ol);
}, false);
tiles.tile = [0, 1].map(v => sprite(16, 16, (R, P) => {
  R(0, 0, 16, 16, PAL.tile); R(0, 0, 16, 1, PAL.tileD); R(0, 0, 1, 16, PAL.tileD); R(8, 0, 1, 16, PAL.tileD); R(0, 8, 16, 1, PAL.tileD);
  P(2, 2, PAL.tileL); P(10, 2, PAL.tileL); P(2, 10, PAL.tileL); P(10, 10, PAL.tileL);
  if (v) { P(4, 12, PAL.tileD); P(5, 13, PAL.tileD); P(6, 13, PAL.tileD); P(7, 14, PAL.tileD); }
}, false));
tiles.wood = [0, 1, 2].map(v => sprite(16, 16, (R, P) => {
  R(0, 0, 16, 16, PAL.wood);
  for (const y of [5, 10, 15]) R(0, y, 16, 1, PAL.woodD);
  R(v === 0 ? 4 : 11, 0, 1, 5, PAL.woodD); R(v === 1 ? 2 : 8, 6, 1, 4, PAL.woodD); R(v === 2 ? 5 : 13, 11, 1, 4, PAL.woodD);
  P(2, 2, PAL.woodL); P(9, 7, PAL.woodL); P(14, 12, PAL.woodL);
  if (v === 2) { P(7, 3, PAL.sand2); P(12, 8, PAL.sand2); }
}, false));
tiles.sand = [0, 1, 2, 3].map(v => sprite(16, 16, (R, P) => {
  R(0, 0, 16, 16, PAL.sand); const r = mulberry32(v * 977 + 11);
  for (let i = 0; i < 8; i++) P(Math.floor(r() * 16), Math.floor(r() * 16), r() < .5 ? PAL.sand2 : PAL.sand3);
  if (v % 2 === 0) { const y = 4 + Math.floor(r() * 8), x = Math.floor(r() * 5); R(x, y, 5, 1, PAL.sand2); R(x + 5, y - 1, 4, 1, PAL.sand2); }
}, false));
tiles.path = [0, 1].map(v => sprite(16, 16, (R, P) => {
  R(0, 0, 16, 16, PAL.dirt); const r = mulberry32(v * 31 + 7);
  for (let i = 0; i < 10; i++) P(Math.floor(r() * 16), Math.floor(r() * 16), r() < .6 ? PAL.dirt2 : PAL.sand2);
}, false));
tiles.stair = sprite(16, 16, (R, P) => {
  R(0, 0, 16, 16, '#6c6875');
  for (let i = 0; i < 4; i++) { R(0, i * 4, 16, 1, '#8a8694'); R(0, i * 4 + 3, 16, 1, '#4b4855'); }
  P(3, 6, PAL.sand); P(4, 6, PAL.sand); P(11, 10, PAL.sand); P(12, 14, PAL.sand2);
}, false);
tiles.metal = [0, 1].map(v => sprite(16, 16, (R, P) => {
  R(0, 0, 16, 16, PAL.floorM); R(0, 0, 16, 1, PAL.floorMD); R(0, 0, 1, 16, PAL.floorMD);
  P(2, 2, PAL.floorML); P(13, 2, PAL.floorML); P(2, 13, PAL.floorML); P(13, 13, PAL.floorML);
  if (v) R(4, 7, 8, 1, PAL.floorML);
}, false));
tiles.carpet = sprite(16, 16, (R, P) => { R(0, 0, 16, 16, PAL.carpet); for (let y = 2; y < 16; y += 4) for (let x = (y / 2) % 4; x < 16; x += 4) P(x, y, PAL.carpetL); }, false);
tiles.pad = sprite(16, 16, (R, P) => { R(0, 0, 16, 16, PAL.padK); P(4, 4, '#6a6e76'); P(11, 11, '#6a6e76'); R(0, 7, 16, 1, '#4a4e56'); }, false);
tiles.rock = [0, 1].map(v => sprite(16, 16, (R, P) => {
  R(0, 0, 16, 16, PAL.sandD); const r = mulberry32(v * 71 + 3);
  R(1, 2, 7, 6, PAL.stone2); R(8, 7, 7, 7, PAL.stone2); R(1, 2, 7, 1, PAL.stoneL); R(8, 7, 7, 1, PAL.stoneL);
  R(1, 7, 7, 1, PAL.stoneD); R(8, 13, 7, 1, PAL.stoneD);
  for (let i = 0; i < 4; i++) P(Math.floor(r() * 16), Math.floor(r() * 16), PAL.stoneD);
}, false));

/* ================= people ================= */
// 지구: 탐사복과 헬멧. 등에는 중계기가 달린 호흡 팩.
function suitPerson(dir, frame) {
  return sprite(16, 22, (R, P) => {
    const side = dir === 'left' || dir === 'right';
    if (!side) {
      R(5, 16, 2, frame === 1 ? 2 : 3, PAL.suitD); R(9, 16, 2, frame === 2 ? 2 : 3, PAL.suitD);
      R(5, frame === 1 ? 18 : 19, 2, 1, PAL.boot); R(9, frame === 2 ? 18 : 19, 2, 1, PAL.boot);
    } else {
      const a = frame === 0 ? 0 : frame === 1 ? -2 : 2;
      R(7 - a, 16, 2, 3, PAL.suitD); R(7 - a, 19, 2, 1, PAL.boot);
      R(7 + a, 16, 2, 3, PAL.suitD); R(7 + a, 19, 2, 1, PAL.boot);
    }
    if (dir === 'up') { R(4, 10, 8, 7, PAL.suit); R(5, 10, 6, 5, PAL.pack); R(6, 11, 4, 1, PAL.accent); P(10, 13, PAL.cyan); }
    else {
      R(4, 10, 8, 7, PAL.suit);
      if (dir === 'right') R(4, 10, 2, 7, PAL.suitD); else R(10, 10, 2, 7, PAL.suitD);
      if (dir === 'down') { R(7, 11, 2, 2, PAL.accent); P(8, 14, PAL.cyan); }
      else R(dir === 'left' ? 10 : 3, 11, 3, 5, PAL.pack);
    }
    R(4, 16, 8, 1, PAL.suitD);
    if (!side) { R(3, 11, 1, 5, PAL.suitD); R(12, 11, 1, 5, PAL.suitD); }
    else { const s = frame === 0 ? 0 : frame === 1 ? -1 : 1; R(7 + s, 11, 2, 5, PAL.suitD); }
    R(3, 2, 10, 9, PAL.suit); R(3, 9, 10, 1, PAL.suitD);
    if (dir === 'down') { R(5, 4, 6, 4, PAL.skin); R(5, 4, 6, 1, PAL.hair); P(6, 6, PAL.ol); P(9, 6, PAL.ol); R(4, 3, 8, 1, PAL.visor); }
    else if (dir === 'left') { R(3, 4, 5, 4, PAL.skin); R(3, 4, 5, 1, PAL.hair); P(4, 6, PAL.ol); R(3, 3, 6, 1, PAL.visor); }
    else if (dir === 'right') { R(8, 4, 5, 4, PAL.skin); R(8, 4, 5, 1, PAL.hair); P(11, 6, PAL.ol); R(7, 3, 6, 1, PAL.visor); }
    else R(5, 3, 6, 5, PAL.suitD);
    P(dir === 'left' ? 11 : 4, 2, PAL.cyan);
  });
}
// 이주 행성: 평상복에 호흡기. 호흡기 옆 푸른 점이 중계기.
const LOOKS = {
  me:{coat:'#3f7a7a', coatD:'#2c5759', pants:'#4f4a5a', hair:PAL.hair, skin:PAL.skin},
  grandma:{coat:'#8a5a6a', coatD:'#6e4555', pants:'#5a4a52', hair:'#d8d0c2', skin:'#e2b090', bun:true},
  sibling:{coat:'#d89a3a', coatD:'#b0742a', pants:'#4f4a5a', hair:'#4a3228', skin:PAL.skin, small:true},
  friendA:{coat:'#5f7a8a', coatD:'#4a6070', pants:'#3e3a48', hair:'#2a2228', skin:'#c98d6e'},
  friendB:{coat:'#7a8a4a', coatD:'#5f6e38', pants:'#3e3a48', hair:'#8a5a3a', skin:PAL.skin},
  prof:{coat:'#c9cfd6', coatD:'#9aa3ad', pants:'#4d5963', hair:'#7a7480', skin:'#d9a882', glasses:true},
};
function colonist(look, dir, frame) {
  return sprite(16, 22, (R, P) => {
    const o = look.small ? 3 : 0, Q = (x, y, w, h, c) => R(x, y + o, w, h, c), side = dir === 'left' || dir === 'right';
    if (!side) {
      R(5, 16, 2, frame === 1 ? 2 : 3, look.pants); R(9, 16, 2, frame === 2 ? 2 : 3, look.pants);
      R(5, frame === 1 ? 18 : 19, 2, 1, PAL.boot); R(9, frame === 2 ? 18 : 19, 2, 1, PAL.boot);
    } else {
      const a = frame === 0 ? 0 : frame === 1 ? -2 : 2;
      R(7 - a, 16, 2, 3, look.pants); R(7 - a, 19, 2, 1, PAL.boot); R(7 + a, 16, 2, 3, look.pants); R(7 + a, 19, 2, 1, PAL.boot);
    }
    Q(4, 10, 8, 6 - o, look.coat);
    if (dir === 'right') Q(4, 10, 2, 6 - o, look.coatD); else Q(10, 10, 2, 6 - o, look.coatD);
    if (!side) { Q(3, 11, 1, 4, look.coatD); Q(12, 11, 1, 4, look.coatD); }
    else { const s = frame === 0 ? 0 : frame === 1 ? -1 : 1; Q(7 + s, 11, 2, 4, look.coatD); }
    Q(4, 3, 8, 7, look.skin); Q(4, 9, 8, 1, PAL.skinD);
    if (dir === 'down') { Q(4, 3, 8, 2, look.hair); Q(4, 5, 1, 3, look.hair); Q(11, 5, 1, 3, look.hair); Q(6, 6, 1, 1, PAL.ol); Q(9, 6, 1, 1, PAL.ol); }
    else if (dir === 'up') Q(4, 3, 8, 7, look.hair);
    else if (dir === 'left') { Q(4, 3, 8, 2, look.hair); Q(9, 3, 3, 6, look.hair); Q(5, 6, 1, 1, PAL.ol); }
    else { Q(4, 3, 8, 2, look.hair); Q(4, 3, 3, 6, look.hair); Q(10, 6, 1, 1, PAL.ol); }
    if (look.bun) Q(6, 1, 4, 2, look.hair);
    if (look.glasses && dir !== 'up') { if (dir === 'down') { Q(5, 6, 2, 1, PAL.metalD); Q(9, 6, 2, 1, PAL.metalD); } else Q(dir === 'left' ? 4 : 10, 6, 2, 1, PAL.metalD); }
    // 호흡기와 중계기
    if (dir === 'down') { Q(5, 8, 6, 2, PAL.metalL); Q(10, 8, 1, 1, PAL.cyan); }
    else if (dir === 'left') { Q(4, 8, 3, 2, PAL.metalL); Q(7, 8, 1, 1, PAL.cyan); }
    else if (dir === 'right') { Q(9, 8, 3, 2, PAL.metalL); Q(8, 8, 1, 1, PAL.cyan); }
    else Q(4, 7, 8, 1, PAL.metalD);
  });
}
const DIRS = ['down', 'up', 'left', 'right'];
const peopleCache = {};
function personImg(key, dir, frame) {
  const id = key + dir + frame;
  if (!peopleCache[id]) peopleCache[id] = key === 'suit' ? suitPerson(dir, frame) : colonist(LOOKS[key], dir, frame);
  return peopleCache[id];
}

/* ================= props ================= */
const S = {};
S.cabinet = sprite(16, 30, (R) => {
  R(1, 2, 14, 27, PAL.metal); R(1, 2, 14, 2, PAL.metalL);
  for (let i = 0; i < 4; i++) { const y = 6 + i * 6; R(2, y, 12, 5, '#7a8893'); R(2, y + 4, 12, 1, PAL.metalD); R(7, y + 2, 2, 1, PAL.steel); }
  R(1, 28, 14, 1, PAL.metalD);
});
S.vault = sprite(64, 34, (R, P) => {
  R(4, 2, 56, 31, PAL.metalD); R(6, 4, 52, 27, PAL.metal);
  R(14, 5, 36, 5, '#c9b690');
  for (let i = 0; i < 8; i++) R(16 + i * 4, 7, 2, 1, PAL.metalD);
  R(48, 6, 2, 3, '#9a8c70');
  for (let y = 0; y < 34; y++) for (let x = 0; x < 64; x++) { const d = Math.hypot(x - 32, y - 21); if (d > 6 && d < 8.5) P(x, y, PAL.metalL); }
  R(31, 14, 2, 14, PAL.metalL); R(25, 20, 14, 2, PAL.metalL); R(30, 19, 4, 4, PAL.steel);
  for (const [x, y] of [[8, 6], [55, 6], [8, 28], [55, 28]]) P(x, y, PAL.steel);
});
S.terminal = sprite(16, 24, (R, P) => {
  R(5, 13, 6, 10, PAL.metalD); R(3, 21, 10, 2, PAL.metalD);
  R(1, 1, 14, 11, '#3e4650'); R(3, 3, 10, 7, PAL.screen); P(4, 4, '#2a3038');
  R(2, 12, 12, 2, PAL.metal);
});
S.terminalOn = sprite(16, 24, (R, P) => {
  R(5, 13, 6, 10, PAL.metalD); R(3, 21, 10, 2, PAL.metalD);
  R(1, 1, 14, 11, '#3e4650'); R(3, 3, 10, 7, '#173a3a'); R(4, 4, 5, 1, PAL.cyan); R(4, 6, 7, 1, PAL.cyan); R(4, 8, 3, 1, PAL.cyan);
  R(2, 12, 12, 2, PAL.metal);
});
S.rubble = sprite(18, 12, (R) => {
  R(2, 5, 7, 5, PAL.conc); R(2, 5, 7, 1, PAL.concL); R(9, 7, 6, 4, PAL.concD); R(11, 3, 4, 4, PAL.conc);
  R(6, 2, 1, 4, '#8a4a2a'); R(7, 1, 3, 1, '#8a4a2a');
});
S.cloth = sprite(24, 22, (R) => {
  R(1, 0, 22, 1, PAL.trunk); R(3, 1, 18, 17, PAL.cloth);
  for (let y = 4; y < 17; y += 5) R(3, y, 18, 1, PAL.clothY);
  for (let x = 5; x < 20; x += 4) R(x, 7, 2, 2, PAL.clothY);
  for (let x = 3; x < 21; x += 2) R(x, 18, 1, 2, PAL.clothY);
});
S.shelf = sprite(32, 30, (R) => {
  R(1, 3, 30, 26, PAL.wood); R(1, 3, 30, 1, PAL.woodL);
  for (const [x, y] of [[3, 6], [17, 6], [3, 17], [17, 17]]) R(x, y, 12, 9, PAL.woodK);
  R(4, 10, 2, 5, '#5f7a8a'); R(6, 9, 2, 6, PAL.clay); R(9, 11, 3, 4, PAL.steel);
  R(18, 12, 4, 3, PAL.paper); R(23, 11, 2, 4, PAL.cloth);
  R(5, 21, 5, 3, PAL.clay); R(19, 20, 2, 5, '#5f7a8a'); R(22, 22, 5, 2, PAL.paperD);
});
S.record = sprite(14, 14, (R) => {   // 새긴 석판
  R(1, 2, 12, 11, '#b9a48b'); R(1, 2, 12, 1, '#d5c3a8'); R(11, 3, 2, 10, '#9e8871');
  R(3, 4, 7, 4, '#9e8871'); R(3, 9, 6, 1, '#7b6654'); R(3, 11, 7, 1, '#7b6654');
});
S.booklet = sprite(16, 12, (R) => { R(1, 2, 14, 9, '#b9a48b'); R(1, 2, 14, 1, '#d5c3a8'); R(8, 2, 1, 9, '#9e8871'); for (const [x, y] of [[3, 4], [10, 4], [3, 7], [10, 7]]) R(x, y, 3, 2, '#7b6654'); });   // 단어 석판
S.sheetSmall = sprite(14, 11, (R) => { R(1, 1, 12, 9, '#9aa3ad'); R(1, 1, 12, 1, '#c9cfd6'); R(3, 4, 4, 1, '#6f7a86'); R(3, 6, 4, 1, '#6f7a86'); R(9, 4, 2, 4, '#4d5560'); R(0, 7, 6, 4, '#b8a888'); });   // 섬유에 싸인 금속판
S.desk = sprite(48, 26, (R) => {
  R(3, 14, 3, 11, PAL.woodD); R(42, 14, 3, 11, PAL.woodD);
  R(1, 8, 46, 6, PAL.wood); R(1, 8, 46, 1, PAL.woodL); R(8, 14, 32, 7, PAL.woodD); R(23, 14, 1, 7, PAL.woodK); R(14, 17, 4, 1, PAL.woodL); R(30, 17, 4, 1, PAL.woodL);
  R(41, 4, 4, 5, PAL.steel); R(4, 3, 4, 6, PAL.metalD); R(3, 2, 6, 1, PAL.metal);
});
S.chair = sprite(16, 22, (R) => {
  R(3, 1, 10, 10, PAL.woodD); R(4, 2, 8, 1, PAL.wood);
  R(2, 11, 12, 4, PAL.wood); R(3, 15, 2, 6, PAL.woodD); R(11, 15, 2, 6, PAL.woodD);
  R(3, 8, 10, 5, PAL.blanket); R(3, 10, 10, 1, PAL.clothY);
});
S.cot = sprite(48, 24, (R) => {
  R(2, 18, 2, 5, PAL.metalD); R(44, 18, 2, 5, PAL.metalD);
  R(1, 8, 46, 11, PAL.metal); R(3, 6, 42, 10, '#cbbf9f'); R(4, 5, 10, 6, PAL.paper);
  R(18, 6, 27, 10, PAL.blanket); R(18, 10, 27, 1, PAL.clothY);
});
S.bed = sprite(48, 24, (R) => {
  R(1, 8, 46, 12, PAL.panelD); R(3, 6, 42, 10, PAL.white); R(4, 5, 10, 6, '#f4f6f8'); R(18, 6, 27, 10, '#5f7a8a'); R(18, 9, 27, 1, PAL.cyan);
});
S.box = sprite(16, 14, (R) => { R(1, 3, 14, 10, PAL.wood); R(1, 3, 14, 1, PAL.woodL); R(1, 8, 14, 1, PAL.woodD); R(7, 3, 1, 10, PAL.woodD); });
S.crate = sprite(16, 14, (R) => { R(1, 3, 14, 10, PAL.metal); R(1, 3, 14, 1, PAL.metalL); R(1, 8, 14, 1, PAL.metalD); R(3, 5, 4, 2, PAL.accent); });
S.plant = sprite(14, 18, (R, P) => {
  R(3, 9, 8, 8, PAL.clay); R(2, 8, 10, 2, PAL.clayL); R(4, 9, 6, 1, '#5a3a2a');
  R(6, 2, 1, 7, '#8a7a50'); R(8, 4, 1, 5, '#8a7a50'); P(5, 3, '#8a7a50'); P(9, 3, '#8a7a50'); P(4, 5, '#a3955a');
});
S.bowl = sprite(10, 6, (R) => { R(1, 2, 8, 3, PAL.steel); R(2, 1, 6, 1, '#eef2f5'); });
S.rug = sprite(64, 40, (R, P) => {
  R(0, 0, 64, 40, '#6e3530'); R(2, 2, 60, 36, PAL.clothY); R(4, 4, 56, 32, '#6e3530');
  for (let i = 0; i < 6; i++) { const cx = 10 + i * 9, cy = 20; for (let d = 0; d < 4; d++) { P(cx - d, cy - 3 + d, PAL.clothY); P(cx + d, cy - 3 + d, PAL.clothY); P(cx - d, cy + 3 - d, PAL.clothY); P(cx + d, cy + 3 - d, PAL.clothY); } }
}, false);
S.sandpile = sprite(44, 26, (R, P) => {
  for (let y = 0; y < 26; y++) for (let x = 0; x < 44; x++) {
    const d = ((x - 22) / 21) ** 2 + ((y - 14) / 11) ** 2;
    if (d < 1) P(x, y, d < .3 ? PAL.sand3 : d < .7 ? PAL.sand : PAL.sand2);
  }
}, false);
// 거주 구역
S.window = sprite(32, 14, (R, P) => {
  R(0, 0, 32, 14, PAL.panelD); R(2, 2, 28, 10, PAL.space);
  for (const [x, y] of [[5, 4], [11, 8], [17, 3], [25, 6], [8, 10], [21, 9]]) P(x, y, '#e8f1f2');
  R(22, 7, 6, 5, '#7a4a6a'); R(23, 6, 4, 1, '#7a4a6a'); R(24, 8, 2, 1, '#9a6a8a');
}, false);
S.gate = sprite(32, 30, (R, P) => {
  R(0, 0, 32, 30, PAL.panelD); R(3, 4, 26, 26, '#5d6670'); R(15, 4, 2, 26, '#3e4650');
  for (let x = 4; x < 28; x += 4) R(x, 1, 2, 2, PAL.padY);
  P(8, 16, PAL.cyan); P(23, 16, PAL.cyan);
}, false);
S.memorial = sprite(32, 32, (R) => {
  R(2, 20, 28, 10, PAL.panelD); R(2, 20, 28, 1, PAL.white); R(11, 2, 10, 19, PAL.white); R(13, 2, 6, 1, '#f4f6f8'); R(19, 3, 2, 18, PAL.panel);
  R(6, 22, 20, 5, PAL.padY); for (let x = 8; x < 24; x += 3) R(x, 24, 2, 1, '#8a6a1a');
});
S.planter = sprite(16, 16, (R) => { R(1, 9, 14, 6, PAL.panelD); R(1, 9, 14, 1, PAL.white); for (let i = 0; i < 4; i++) { R(2 + i * 3, 4, 2, 5, PAL.leaf); R(2 + i * 3, 4, 2, 1, '#8db552'); } });
S.ctable = sprite(24, 18, (R) => { R(2, 4, 20, 6, PAL.floorML); R(2, 4, 20, 1, PAL.white); R(11, 10, 2, 7, PAL.panelK); R(6, 2, 3, 3, PAL.white); R(15, 2, 3, 3, PAL.accent); });
// 방과 방을 잇는 문: 위 불빛이 빨강이면 잠김, 초록이면 열림
S.door = [false, true].map(open => sprite(18, 30, (R) => {
  R(0, 0, 18, 30, PAL.panelD); R(2, 4, 14, 26, PAL.panelK); R(8, 4, 2, 26, '#7a858f'); R(4, 16, 2, 3, PAL.white);
  R(6, 1, 6, 2, open ? '#6fd08a' : '#d0584a');
}, false));
S.bookshelf = sprite(32, 30, (R) => {
  R(1, 2, 30, 27, PAL.white); R(1, 2, 30, 1, '#f4f6f8'); R(3, 5, 26, 10, PAL.panelK); R(3, 17, 26, 10, PAL.panelK);
  const cols = ['#8a5a6a', '#5f7a8a', '#d89a3a', '#6a9a48', '#3b5b8a', '#a8432e'];
  for (let i = 0; i < 9; i++) R(4 + i * 3, 7 + (i % 3), 2, 8 - (i % 3), cols[i % 6]);
  for (let i = 0; i < 6; i++) R(5 + i * 4, 19 + (i % 2), 3, 8 - (i % 2), cols[(i + 2) % 6]);
  R(17, 7, 4, 8, '#2e5a8a'); R(18, 9, 2, 1, PAL.padY);
});
S.mat = sprite(32, 10, (R) => { R(0, 0, 32, 10, '#7a6a8a'); R(2, 2, 28, 6, '#8a7a9a'); }, false);
S.board = sprite(32, 16, (R) => {
  R(0, 0, 32, 16, '#2a3140'); R(2, 2, 28, 12, '#11161f'); R(4, 4, 12, 1, PAL.cyan); R(4, 7, 18, 1, PAL.cyan); R(4, 10, 9, 1, '#6fd08a'); R(24, 10, 4, 1, '#6fd08a');
}, false);
// 지구 기지
S.rocket = sprite(48, 82, (R, P) => {
  R(12, 66, 4, 14, PAL.metalD); R(32, 66, 4, 14, PAL.metalD); R(9, 78, 10, 3, PAL.metalD); R(29, 78, 10, 3, PAL.metalD);
  R(8, 50, 8, 18, PAL.rust); R(32, 50, 8, 18, PAL.rust);
  R(16, 10, 16, 58, PAL.white); R(18, 5, 12, 5, PAL.white); R(21, 1, 6, 4, PAL.white); R(23, 0, 2, 1, PAL.white);
  R(28, 10, 4, 58, PAL.panelD); R(21, 16, 6, 6, PAL.visor); R(22, 17, 2, 2, '#a8e2dd');
  R(16, 34, 16, 3, PAL.accent); R(20, 52, 8, 13, PAL.panelK); R(23, 58, 1, 1, PAL.cyan);
});
S.bunker = sprite(64, 48, (R) => {
  R(2, 10, 60, 36, PAL.conc); R(0, 6, 64, 6, PAL.concL); R(0, 11, 64, 1, PAL.concD);
  R(20, 22, 24, 24, '#14121a'); for (let i = 0; i < 4; i++) R(22, 30 + i * 4, 20, 1, '#3e3c49');
  R(24, 14, 16, 5, '#c9b690'); R(26, 16, 12, 1, '#9a8c70');
  R(0, 40, 14, 7, PAL.sand); R(50, 37, 14, 10, PAL.sand); R(4, 38, 6, 2, PAL.sand3);
});
S.comm = sprite(16, 28, (R, P) => {
  R(7, 8, 2, 19, PAL.metalD); R(2, 1, 12, 6, PAL.steel); R(3, 6, 10, 1, PAL.metalL); R(4, 15, 8, 8, '#3e4650'); R(5, 16, 6, 3, '#173a3a'); P(6, 17, PAL.cyan); P(8, 17, PAL.cyan);
});
S.solar = sprite(34, 18, (R) => {
  R(1, 2, 32, 10, '#2d4a6a'); for (let x = 1; x < 33; x += 8) R(x, 2, 1, 10, '#6f8aa8'); R(1, 7, 32, 1, '#6f8aa8');
  R(6, 12, 2, 5, PAL.metalD); R(26, 12, 2, 5, PAL.metalD); R(4, 9, 6, 2, PAL.sand);
});
// UI
S.bang = sprite(9, 11, (R) => { R(1, 1, 7, 9, '#f4ead8'); R(4, 2, 1, 4, PAL.ol); R(4, 7, 1, 1, PAL.ol); });
S.bookIcon = sprite(20, 20, (R) => {
  R(3, 2, 14, 16, '#5a4a63'); R(5, 2, 12, 15, PAL.paper); R(5, 2, 1, 15, PAL.paperD);
  for (let y = 5; y < 16; y += 3) R(7, y, 8, 1, PAL.paperD);
  R(3, 2, 2, 16, '#3e3346'); R(12, 1, 3, 6, PAL.red); R(13, 7, 1, 1, PAL.red);
});
S.briefIcon = sprite(20, 20, (R) => {
  R(3, 3, 14, 16, '#ece6d6'); R(3, 3, 14, 3, PAL.print); R(7, 1, 6, 3, PAL.metalD);
  R(5, 8, 7, 1, PAL.print); for (let y = 11; y < 18; y += 3) R(5, y, 10, 1, PAL.guide);
  R(12, 14, 3, 3, PAL.red);
});
S.closeIcon = sprite(16, 16, (R) => {
  R(2, 2, 12, 12, '#2e2840');
  for (let i = 0; i < 6; i++) { R(5 + i, 5 + i, 1, 1, PAL.paper); R(10 - i, 5 + i, 1, 1, PAL.paper); }
});

/* ================= 사진: 화자의 젊은 시절 ================= */
const PHOTOS = ['meadow', 'cat', 'meal', 'sunwater', 'launch'];
function photo(kind) {
  const c = sprite(60, 36, (R, P) => {
    if (kind === 'meadow') {
      R(0, 0, 60, 16, '#9cc7d8'); R(6, 3, 10, 2, '#e8f1f2'); R(9, 2, 5, 1, '#e8f1f2');
      R(0, 16, 60, 20, PAL.leaf);
      for (let i = 0; i < 40; i++) { const x = (i * 37) % 60, y = 17 + (i * 13) % 18; R(x, y, 1, 2, PAL.leafD); }
      for (const [x, y, c2] of [[8, 24, '#f2d35a'], [15, 29, '#f4f0e6'], [27, 22, '#f2d35a'], [33, 31, '#f4f0e6'], [21, 33, '#e07a6a']]) P(x, y, c2);
      R(45, 8, 3, 14, PAL.trunk); R(39, 2, 16, 8, PAL.leafD); R(41, 0, 12, 3, PAL.leafD); R(42, 3, 8, 3, PAL.leaf);
      for (const [x, y] of [[12, 6], [19, 9], [25, 5]]) { P(x, y, '#2a2a30'); P(x + 1, y + 1, '#2a2a30'); P(x + 2, y, '#2a2a30'); }
    } else if (kind === 'cat') {
      R(0, 0, 60, 27, '#cfb89a'); for (let y = 3; y < 27; y += 4) R(0, y, 60, 1, '#bfa688');
      R(38, 4, 14, 23, '#7a5236'); R(39, 5, 12, 21, '#8e6440'); P(48, 16, '#e0c070');
      R(30, 27, 26, 3, '#9e8871'); R(0, 30, 60, 6, '#b9a48b');
      R(22, 20, 7, 7, '#3b2f2f'); R(23, 15, 6, 5, '#3b2f2f'); P(23, 14, '#3b2f2f'); P(28, 14, '#3b2f2f'); R(29, 25, 5, 1, '#3b2f2f');
      P(24, 17, '#9fd06a'); P(27, 17, '#9fd06a');
      R(8, 21, 6, 6, PAL.clay); R(9, 15, 4, 6, PAL.leaf); P(8, 17, PAL.leaf); P(13, 16, PAL.leaf);
    } else if (kind === 'meal') {
      R(0, 0, 60, 36, '#d9b98a'); R(24, 2, 12, 8, '#f2e2b0'); R(29, 2, 1, 8, '#c9a46c'); R(24, 6, 12, 1, '#c9a46c');
      const cols = ['#5f7a8a', PAL.cloth, '#6a9a48', PAL.accent];
      [8, 20, 36, 48].forEach((x, i) => { R(x, 10, 5, 5, i === 2 ? PAL.skinD : PAL.skin); R(x, 10, 5, 1, PAL.hair); R(x - 1, 15, 7, 8, cols[i]); });
      R(4, 22, 52, 4, PAL.wood); R(4, 22, 52, 1, PAL.woodL); R(8, 26, 2, 10, PAL.woodD); R(50, 26, 2, 10, PAL.woodD);
      for (const x of [10, 22, 30, 38, 50]) R(x, 20, 4, 2, '#f4f0e6');
      R(28, 19, 5, 3, PAL.clay);
    } else if (kind === 'sunwater') {
      R(0, 0, 60, 18, '#a8cfe0'); R(44, 3, 7, 7, '#f6e08a'); R(45, 2, 5, 9, '#f6e08a'); R(43, 4, 9, 5, '#f6e08a');
      R(0, 14, 60, 4, '#7aa060'); R(0, 18, 60, 12, '#4f8fb0'); for (let i = 0; i < 9; i++) R((i * 13) % 56, 20 + (i * 5) % 9, 4, 1, '#a8d8e8');
      R(46, 19, 4, 1, '#f6e08a'); R(44, 22, 6, 1, '#f6e08a');
      R(0, 30, 60, 6, '#7aa060'); for (let x = 2; x < 60; x += 5) R(x, 27, 1, 4, PAL.leafD);
    } else if (kind === 'launch') {
      R(0, 0, 60, 8, '#4a3a5a'); R(0, 8, 60, 8, '#7a5a6a'); R(0, 16, 60, 6, '#c98a6a');
      R(38, 2, 2, 4, '#e8eef2'); R(38, 6, 2, 3, '#ffd27a'); for (let y = 9; y < 24; y++) R(38 - Math.floor((y - 9) / 4), y, 2 + Math.floor((y - 9) / 3), 1, y < 14 ? '#f2e2c0' : '#d8c8b8');
      R(0, 22, 60, 14, '#6a5a4a');
      for (let i = 0; i < 9; i++) { const x = 3 + i * 6 + (i % 2); R(x, 25 - (i % 3), 4, 4, '#2e2630'); R(x - 1, 29 - (i % 3), 6, 8, '#2e2630'); }
    }
  }, false);
  const g = c.getContext('2d'), r = mulberry32(kind.length * 977);
  g.fillStyle = 'rgba(190,160,115,.2)'; g.fillRect(0, 0, 60, 36);
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(240,230,210,.55)'; g.fillRect(Math.floor(r() * 58), Math.floor(r() * 34), 1 + Math.floor(r() * 3), 1); }
  return c;
}

function icon(R, P, kind, x, y) {
  if (kind === 'tree') { R(x + 6, y + 6, 3, 7, PAL.trunk); R(x + 2, y, 11, 7, PAL.leafD); R(x + 4, y + 1, 6, 3, PAL.leaf); }
  else if (kind === 'bird') { R(x + 3, y + 5, 7, 4, '#5f7a8a'); R(x + 9, y + 3, 4, 4, '#5f7a8a'); P(x + 13, y + 5, PAL.accent); P(x + 11, y + 4, PAL.ol); R(x + 1, y + 6, 2, 1, '#5f7a8a'); R(x + 5, y + 9, 1, 3, PAL.ol); R(x + 8, y + 9, 1, 3, PAL.ol); }
  else if (kind === 'cat') { R(x + 2, y + 6, 8, 6, '#3b2f2f'); R(x + 8, y + 2, 5, 5, '#3b2f2f'); P(x + 8, y + 1, '#3b2f2f'); P(x + 12, y + 1, '#3b2f2f'); P(x + 11, y + 4, '#9fd06a'); R(x, y + 7, 2, 1, '#3b2f2f'); }
  else if (kind === 'water') { for (let i = 0; i < 3; i++) for (let k = 0; k < 14; k += 4) { R(x + k, y + 3 + i * 4, 2, 1, '#4f8fb0'); R(x + k + 2, y + 4 + i * 4, 2, 1, '#4f8fb0'); } }
  else if (kind === 'sun') { R(x + 4, y + 3, 7, 7, '#e0b030'); R(x + 5, y + 2, 5, 9, '#e0b030'); for (const [a, b] of [[7, 0], [7, 12], [1, 6], [13, 6]]) P(x + a, y + b, '#e0b030'); }
  else if (kind === 'house') { for (let i = 0; i < 5; i++) R(x + 7 - i, y + i, 1 + i * 2, 1, PAL.rust); R(x + 3, y + 5, 9, 7, '#cfb89a'); R(x + 6, y + 8, 3, 4, '#7a5236'); }
}
// 내 방: 책상 위 허가서·전공서적·일기장, 벽의 졸업장
S.studydesk = sprite(48, 24, (R) => {
  R(3, 12, 2, 11, PAL.panelK); R(43, 12, 2, 11, PAL.panelK); R(1, 7, 46, 6, PAL.white); R(1, 7, 46, 1, '#f4f6f8'); R(18, 13, 12, 6, PAL.panelD);
});
S.permitDoc = sprite(14, 12, (R) => { R(1, 3, 11, 8, '#f4f6f8'); R(1, 3, 11, 2, PAL.print); R(3, 7, 6, 1, PAL.guide); R(8, 8, 3, 3, PAL.red); });
S.textbook = sprite(14, 14, (R) => { R(1, 3, 12, 10, '#2e5a8a'); R(2, 2, 11, 2, '#f4f6f8'); R(1, 11, 12, 2, '#f4f6f8'); R(4, 6, 6, 2, PAL.padY); });
S.diaryBook = sprite(12, 12, (R) => { R(1, 3, 10, 8, '#7a4f33'); R(2, 3, 9, 7, PAL.paper); R(6, 3, 1, 7, PAL.paperD); R(9, 1, 2, 4, PAL.red); });
// 승강장 중계기 점검대: 마이크와 작은 화면
S.relaydesk = sprite(16, 24, (R, P) => {
  R(5, 13, 6, 10, PAL.panelK); R(3, 21, 10, 2, PAL.panelK);
  R(1, 2, 14, 11, PAL.panelD); R(3, 4, 10, 6, '#11161f'); R(4, 5, 6, 1, PAL.cyan); R(4, 7, 4, 1, PAL.cyan);
  R(12, 0, 1, 4, PAL.metalD); R(11, 0, 3, 2, PAL.metalL); P(12, 1, PAL.red);
});
// 0-1 내 방: 벽의 지구 사진·지도, 책상 위 미완료 연구계획서
S.earthmap = sprite(30, 14, (R, P) => {
  R(0, 0, 30, 14, '#b98a52'); R(1, 1, 13, 12, '#9cc7d8'); R(3, 7, 9, 5, PAL.leaf); R(7, 4, 4, 4, PAL.leafD); R(4, 3, 3, 2, '#e8f1f2');
  R(16, 1, 13, 12, '#e8dfc8'); R(18, 3, 6, 4, '#7aa060'); R(22, 6, 5, 4, '#4f8fb0'); R(18, 9, 3, 2, '#7aa060'); P(24, 4, PAL.red);
}, false);
S.planDoc = sprite(14, 12, (R) => { R(1, 3, 11, 8, '#f4f6f8'); R(1, 3, 11, 1, PAL.print); R(3, 5, 7, 1, PAL.guide); R(3, 7, 4, 1, PAL.guide); R(9, 8, 2, 2, '#d89a3a'); });
// 2단계 유적지
S.ruinhouse = sprite(48, 40, (R, P) => {
  R(4, 14, 40, 24, '#b9a48b'); R(4, 14, 40, 2, '#d5c3a8'); R(4, 34, 40, 4, '#9e8871');
  for (let i = 0; i < 6; i++) R(4 + i * 7, 10 - (i % 3) * 2, 7, 6 + (i % 3) * 2, '#a08870');
  R(19, 22, 10, 16, '#2a2228'); R(8, 20, 7, 6, '#2a2228'); R(34, 20, 7, 6, '#2a2228'); R(35, 21, 2, 2, PAL.sand);
  R(0, 34, 12, 6, PAL.sand); R(38, 32, 10, 8, PAL.sand); R(14, 36, 6, 4, PAL.sand3);
});
S.shrub = sprite(16, 14, (R) => {
  for (const [x, h, c] of [[4, 6, '#a3955a'], [6, 9, '#7d7440'], [8, 7, '#a3955a'], [10, 10, '#7d7440'], [12, 5, '#a3955a'], [7, 4, '#c2b16c']]) R(x, 13 - h, 1, h, c);
  R(3, 12, 11, 1, '#7d7440');
}, false);
S.stump = sprite(16, 16, (R) => { R(4, 8, 8, 6, '#5a4030'); R(4, 7, 8, 2, '#7d5f3e'); R(6, 8, 4, 1, '#9a7a56'); R(2, 13, 4, 2, '#5a4030'); R(10, 13, 4, 2, '#5a4030'); });
S.bike = sprite(26, 16, (R, P) => {
  for (const cx of [6, 19]) for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; P(Math.round(cx + Math.cos(t) * 4), Math.round(10 + Math.sin(t) * 4), '#8a4a2a'); }
  R(6, 9, 13, 1, '#a0583a'); R(11, 5, 1, 5, '#a0583a'); R(9, 4, 5, 1, '#5a3a2a'); R(18, 4, 1, 6, '#a0583a'); R(17, 3, 4, 1, '#5a3a2a');
});
S.rover = sprite(48, 32, (R, P) => {
  R(4, 8, 40, 14, PAL.white); R(6, 4, 22, 6, PAL.panel); R(8, 5, 8, 4, PAL.visor); R(18, 5, 8, 4, PAL.visor);
  R(4, 18, 40, 4, PAL.panelD); R(30, 10, 12, 3, PAL.accent);
  for (const x of [8, 22, 36]) { R(x - 3, 20, 10, 10, '#2a2228'); R(x, 23, 4, 4, PAL.metalD); }
  R(40, 2, 1, 7, PAL.metalD); P(40, 1, PAL.red);
});
S.ruinwall = sprite(32, 28, (R, P) => {
  R(1, 4, 30, 22, '#a08870'); R(1, 4, 30, 2, '#c4ad92'); R(4, 1, 8, 4, '#a08870'); R(20, 2, 9, 3, '#a08870');
  for (let i = 0; i < 5; i++) { R(5 + i * 5, 11, 3, 3, '#5a4a3a'); R(5 + i * 5, 17, 3, 2, '#5a4a3a'); }
  R(1, 24, 30, 2, '#7d6650'); R(0, 25, 8, 3, PAL.sand);
});
S.inscr = sprite(14, 14, (R) => { R(1, 1, 12, 12, '#9e8871'); R(3, 3, 3, 3, '#4a3a2a'); R(8, 3, 3, 3, '#4a3a2a'); R(3, 8, 8, 2, '#4a3a2a'); }, false);
S.diploma = sprite(14, 12, (R) => { R(0, 0, 14, 12, '#b98a52'); R(2, 2, 10, 8, '#f4f0e6'); R(4, 4, 6, 1, PAL.guide); R(4, 6, 4, 1, PAL.guide); R(9, 7, 2, 2, PAL.red); }, false);

/* ================= 해독 대상 면 (records.json에서 그린다) ================= */
// 글자를 그리면서 위치를 기억해 두고, 확대 화면에서 눌러 노트로 옮겨 적는다.
const STONE = ['#5a4a3a', '#7b6654', '#9e8871', '#b9a48b', '#d2c0a6'];
const METAL = ['#3e4650', '#5d6670', '#7f8a94', '#a3adb7', '#c9cfd6'];
function carve(g, w, h, tones) {
  const d = g.getImageData(0, 0, w, h), a = d.data, rgb = tones.map(hexRGB);
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3]) continue;
    const l = .3 * a[i] + .59 * a[i + 1] + .11 * a[i + 2];
    const [r, gg, b] = rgb[l > 205 ? 4 : l > 165 ? 3 : l > 115 ? 2 : l > 65 ? 1 : 0];
    a[i] = r; a[i + 1] = gg; a[i + 2] = b;
  }
  g.putImageData(d, 0, 0);
}
const INCISE_M = '#4a3a2e', INCISE_S = '#2e2018';   // 기계 전사(얕은 새김) / 화자 문자(깊은 새김)
function surface(w, h, draw, glyphs, ol = false) {
  const img = sprite(w, h, (R, P, g) => { draw(R, P, g); for (const q of glyphs) drawQ(g, q); }, ol);
  return {img, w, h, glyphs};
}
function folio(rec, seed) {
  const W = 100, H = 48 + rec.lines.length * 28, gl = [], pic = photo(rec.photo), names = [], tapes = [];
  rec.lines.forEach((ln, li) => {
    const y0 = 46 + li * 28;
    if (ln.redacted_name) { tapes.push([y0, ln.redacted_name, true]); names.push([10, y0]); return; }
    const sounds = ln.words.flatMap(w => lang.sounds(w));
    tapes.push([y0, sounds.length, false]);
    // 대조용 표시: 기계 표기는 i(몇 번째 소리), 화자 문자는 n(몇 번째 기호), 표지는 sep
    sounds.forEach((sy, i) => gl.push({k: 'm', id: sy, x: 10 + i * 8, y: y0 + 2, line: li, i, col: INCISE_M}));
    let x = 10, n = 0;
    ln.words.forEach((w, wi) => {
      if (wi > 0) { gl.push({k: 's', id: 'sep', x, y: y0 + 15, line: li, sep: true, col: INCISE_S}); x += 5; }
      for (const id of w) { gl.push({k: 's', id, x, y: y0 + 15, line: li, n: n++, col: INCISE_S}); x += 8; }
    });
  });
  return surface(W, H, (R, P, g) => {
    R(0, 0, W, H, PAL.folio); R(0, H - 2, W, 2, PAL.stain); R(W - 2, 0, 2, H, PAL.stain);
    const r = mulberry32(seed);
    for (let i = 0; i < 4; i++) { const x = Math.floor(r() * (W - 10)), y = Math.floor(r() * (H - 8)); R(x, y, 6 + Math.floor(r() * 6), 3 + Math.floor(r() * 3), PAL.stain); }
    R(18, 2, 64, 40, '#f2ece0'); g.drawImage(pic, 20, 4); R(18, 41, 64, 1, PAL.paperD);
    for (const [y0, n, damaged] of tapes) {
      const tw = n * 8 + 4;
      R(7, y0, tw, 11, PAL.tape); R(7, y0 + 10, tw, 1, PAL.tapeD);
      if (damaged) for (let i = 0; i < n; i++) for (let k = 0; k < 8; k++) R(10 + i * 8 + (k % 3) * 2, y0 + 2 + Math.floor(k / 2) * 2, 2, 1, PAL.tapeD);
    }
    // 이름 테두리: 안쪽이 긁혀 지워져 있다
    for (const [xs, y0] of names) {
      R(xs - 2, y0 + 13, 11, 1, PAL.sInk); R(xs - 2, y0 + 23, 11, 1, PAL.sInk); R(xs - 2, y0 + 13, 1, 11, PAL.sInk); R(xs + 8, y0 + 13, 1, 11, PAL.sInk);
      for (let k = 0; k < 7; k++) { P(xs + k, y0 + 15 + k, '#6b5a5a'); P(xs + 6 - k, y0 + 15 + k, '#6b5a5a'); P(xs + k, y0 + 18, '#6b5a5a'); }
    }
    if (rec.tear === 'tr') for (let i = 0; i < 12; i++) g.clearRect(W - 12 + i, i, 12 - i, 1);
    if (rec.tear === 'tl') for (let i = 0; i < 10; i++) g.clearRect(0, i, 10 - i, 1);
    if (rec.tear === 'br') for (let i = 0; i < 10; i++) g.clearRect(W - i - 1, H - 10 + i, i + 1, 1);
    if (rec.tear === 'bl') for (let i = 0; i < 10; i++) g.clearRect(0, H - 10 + i, i + 1, 1);
    carve(g, W, H, STONE);   // 석판: 부조와 새긴 띠
  }, gl, true);
}
// 단어 모음집: 화자가 그림 옆에 자기 문자를 적어 둔 손 공책 (2쪽 x 4칸)
function booklet(def) {
  const pos = i => [i < 4 ? 8 + (i % 2) * 24 : 62 + (i % 2) * 24, 8 + (Math.floor(i / 2) % 2) * 30];
  const gl = [];
  def.entries.forEach((e, i) => { if (e.morpheme) { const [x, y] = pos(i); gl.push({k: 's', id: e.morpheme, x: x + 4, y: y + 17, col: INCISE_S}); } });
  return surface(112, 68, (R, P, g) => {
    R(0, 0, 112, 68, '#7a4f33'); R(3, 3, 52, 62, '#f2e8d2'); R(57, 3, 52, 62, '#f2e8d2'); R(55, 3, 2, 62, '#c9b690');
    for (let y = 6; y < 64; y += 6) P(56, y, '#7a4f33');
    def.entries.forEach((e, i) => {
      const [x, y] = pos(i);
      R(x - 1, y - 1, 17, 26, '#e6dbc0');
      if (e.picture) icon(R, P, e.picture, x, y);
      if (e.damage === 'blot') for (let k = 0; k < 40; k++) P(x + (k * 7) % 15, y + 2 + (k * 5) % 22, k % 2 ? '#6a6a8a' : '#8a8aa8');
      if (e.damage === 'torn') for (let k = 0; k < 26; k++) R(x - 1 + Math.max(0, 16 - k), y - 1 + k, 17, 1, '#7a4f33');
    });
    carve(g, 112, 68, STONE);   // 단어 석판
  }, gl, true);
}
// 읽을 수 없는 표: 인쇄된 칸은 처음 보는 글자, 옆 칸은 화자의 손글씨. 물에 젖어 번졌다.
function table(def) {
  const gl = [];
  def.rows.forEach((row, i) => { if (row.handwritten) gl.push({k: 's', id: row.handwritten, x: 58, y: 15 + i * 10, col: '#2a2f36'}); });
  return surface(80, 76, (R, P, g) => {
    const r = mulberry32(77);
    R(2, 2, 76, 72, PAL.card); R(2, 2, 76, 8, '#9fb0c8');
    for (let x = 6; x < 70; x += 5) R(x, 5, 3, 2, '#d8e0ea');
    def.rows.forEach((row, i) => {
      const y = 13 + i * 10;
      R(4, y + 9, 72, 1, PAL.guide); R(52, y - 1, 1, 10, PAL.guide);
      for (let k = 0; k < 3; k++) for (let j = 0; j < 12; j++) if (r() < .45) P(8 + k * 12 + (j % 4), y + 1 + Math.floor(j / 4) * 2, '#7a8db0');
    });
    for (const [x, y, w, h] of [[40, 30, 30, 18], [10, 50, 24, 20], [60, 56, 16, 14]]) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const d = ((i - w / 2) / (w / 2)) ** 2 + ((j - h / 2) / (h / 2)) ** 2; if (d < 1 && r() < .8) P(x + i, y + j, d > .7 ? '#b8a888' : '#d8ccb0');
    }
    carve(g, 80, 76, METAL);   // 금속판
  }, gl, true);
}
const surfaces = {};
records.records.forEach((rec, i) => { surfaces[rec.id] = folio(rec, i * 131 + 7); });
for (const b of records.booklets) surfaces[b.id] = booklet(b);
for (const t of records.tables) surfaces[t.id] = table(t);

return {PAL, S, tiles, personImg, surfaces, mk, sprite, drawBits, drawQ, PHOTOS, SPRITE_NAMES: Object.keys(S).filter(k => !Array.isArray(S[k]))};
}
