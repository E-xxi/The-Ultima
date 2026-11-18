// 화면 그리기: 지형, 물건, 사람, 조명, 확대 화면. 상태를 바꾸지 않는다.
import {TS, T, DV, tileAt, nearest} from './world.js';

const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0);

function drawTile(ctx, art, m, tx, ty, sx, sy) {
  const {tiles, PAL} = art, t = tileAt(m, tx, ty), h = hash(tx, ty), isWall = (x, y) => tileAt(m, x, y) === T.WALL;
  const R = (x, y, w, hh, c) => { ctx.fillStyle = c; ctx.fillRect(sx + x, sy + y, w, hh); };
  switch (t) {
    case T.WALL: {
      const col = m.wall === 'colony';
      if (!isWall(tx, ty + 1)) ctx.drawImage(col ? tiles.cFaceLow : tiles.faceLow[h % 5 === 0 ? 1 : 0], sx, sy);
      else if (!isWall(tx, ty + 2)) ctx.drawImage(col ? tiles.cFaceHigh : tiles.faceHigh, sx, sy);
      else ctx.drawImage(col ? tiles.cCeil : tiles.ceil, sx, sy);
      break;
    }
    case T.ROCK: ctx.drawImage(tiles.rock[h % 2], sx, sy); break;
    case T.TILE: ctx.drawImage(tiles.tile[h % 6 === 0 ? 1 : 0], sx, sy); break;
    case T.WOOD: ctx.drawImage(tiles.wood[h % 3], sx, sy); break;
    case T.SAND: ctx.drawImage(tiles.sand[h % 4], sx, sy); break;
    case T.PATH: ctx.drawImage(tiles.path[h % 2], sx, sy);
      if (tileAt(m, tx, ty - 1) === T.SAND) R(0, 0, 16, 1, PAL.sand2);
      if (tileAt(m, tx, ty + 1) === T.SAND) R(0, 15, 16, 1, PAL.sand2);
      break;
    case T.METAL: ctx.drawImage(tiles.metal[h % 4 === 0 ? 1 : 0], sx, sy); break;
    case T.CARPET: ctx.drawImage(tiles.carpet, sx, sy); break;
    case T.PAD: ctx.drawImage(tiles.pad, sx, sy);
      ctx.fillStyle = PAL.padY;
      if (tileAt(m, tx, ty - 1) !== T.PAD) for (let x = 0; x < 16; x += 4) ctx.fillRect(sx + x, sy, 2, 2);
      if (tileAt(m, tx, ty + 1) !== T.PAD) for (let x = 2; x < 16; x += 4) ctx.fillRect(sx + x, sy + 14, 2, 2);
      if (tileAt(m, tx - 1, ty) !== T.PAD) for (let y = 0; y < 16; y += 4) ctx.fillRect(sx, sy + y, 2, 2);
      if (tileAt(m, tx + 1, ty) !== T.PAD) for (let y = 2; y < 16; y += 4) ctx.fillRect(sx + 14, sy + y, 2, 2);
      break;
    default: ctx.drawImage(tiles.stair, sx, sy);
  }
  if (t !== T.WALL && t !== T.ROCK && isWall(tx, ty - 1)) { ctx.fillStyle = 'rgba(10,8,16,.3)'; ctx.fillRect(sx, sy, 16, 3); }
}

const camAxis = (p, view, world) => world <= view ? Math.round((world - view) / 2) : Math.round(Math.max(0, Math.min(world - view, p - view / 2)));

function drawPerson(ctx, img, x, y, cx, cy) {
  ctx.fillStyle = 'rgba(20,14,24,.3)';
  ctx.fillRect(Math.round(x - 5 - cx), Math.round(y - 1 - cy), 10, 2);
  ctx.drawImage(img, Math.round(x - 8 - cx), Math.round(y - 20 - cy));
}

// view: {VW, VH, viewW, viewH(노트에 가려지지 않은 영역), time, showBang}, spriteOf(o): 물건의 지금 그림(조건에 따라 바뀌는 것 포함)
export function renderWorld(ctx, art, m, player, view, spriteOf) {
  const {VW, VH, viewW, viewH, time} = view;
  const cx = camAxis(player.x, viewW, m.W * TS), cy = camAxis(player.y - 10, viewH, m.H * TS);
  const x0 = Math.floor(cx / TS), y0 = Math.floor(cy / TS), x1 = Math.ceil((cx + VW) / TS), y1 = Math.ceil((cy + VH) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) drawTile(ctx, art, m, tx, ty, tx * TS - cx, ty * TS - cy);
  for (const o of m.objs) if (o.flat) ctx.drawImage(spriteOf(o), o.x - cx, o.y - cy);

  const ents = m.objs.filter(o => !o.flat && (o.sprite || o.door || o.npc));
  ents.push({base: player.y, isPlayer: true});
  ents.sort((a, b) => a.base - b.base);
  for (const e of ents) {
    if (e.isPlayer) drawPerson(ctx, art.personImg(m.player_look, player.dir, player.frame), player.x, player.y, cx, cy);
    else if (e.npc) drawPerson(ctx, art.personImg(e.npc, e.dir, 0), e.x, e.y, cx, cy);
    else ctx.drawImage(spriteOf(e), e.x - cx, e.y - cy);
  }

  if (m.tint) { ctx.fillStyle = m.tint; ctx.fillRect(0, 0, VW, VH); }
  if (m.wind) {
    ctx.fillStyle = 'rgba(240,215,160,.55)';
    for (let i = 0; i < 40; i++) { const x = ((time * (60 + i * 3) + i * 97) % (VW + 40)) - 20, y = (i * 53 + Math.sin(time + i) * 6) % VH; ctx.fillRect(Math.floor(x), Math.floor(y), 2, 1); }
  }
  if (m.dark) {
    ctx.fillStyle = 'rgba(12,10,26,' + m.dark + ')'; ctx.fillRect(0, 0, VW, VH);
    ctx.globalCompositeOperation = 'lighter';
    const [dx, dy] = DV[player.dir];
    for (const [lx, ly, r0, c] of m.lights.concat([[player.x + dx * 18, player.y - 10 + dy * 18, 52, 'rgba(255,244,220,.26)']])) {
      const r = r0 * (1 + Math.sin(time * 3 + lx) * .02), x = lx - cx, y = ly - cy;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (m.dust) {
    ctx.fillStyle = 'rgba(240,215,160,.6)';
    for (let i = 0; i < 6; i++) { const y = ((time * 22 + i * 17) % 60); ctx.fillRect(m.dust[0] + (i * 5) % 14 - 6 - cx, m.dust[1] + y - cy, 1, 1); }
  }
  if (view.showBang) {
    const o = nearest(m, player);
    if (o) {
      const [x, y, w] = o.hit, bob = Math.floor(time * 3) % 2;
      const top = o.npc ? o.y - 32 : (o.sprite || o.door) ? Math.min(o.y, y) - 4 : y - 4;
      ctx.drawImage(art.S.bang, Math.round(x + w / 2 - 5 - cx), Math.round(top - 12 - bob - cy));
    }
  }
}

// 확대 화면. 돌려주는 {k, ox, oy}로 눌린 글자를 찾는다.
// cmp: 대조 모드 {on, pairs, key(고른 화자 기호 '줄:순서'), a(고른 첫 소리), verified}
const PAIR_COLORS = ['#ffd36b', '#5fd0c0', '#f08a7a', '#a8b8ff', '#b6e07a', '#f0a8e0'];
export function renderInspect(ctx, art, lang, s, view, sel, flash, cmp) {
  const {VW, VH, viewW, viewH, time} = view;
  ctx.fillStyle = '#16121b'; ctx.fillRect(0, 0, VW, VH);
  const k = Math.max(1, Math.floor(Math.min(viewW * .9 / s.w, viewH * .88 / s.h)));
  const ox = Math.round((viewW - s.w * k) / 2), oy = Math.round((viewH - s.h * k) / 2);
  const g = ctx.createRadialGradient(ox + s.w * k / 2, oy + s.h * k / 2, 0, ox + s.w * k / 2, oy + s.h * k / 2, Math.max(s.w, s.h) * k * .8);
  g.addColorStop(0, 'rgba(255,240,210,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(ox + k * 2, oy + k * 2, s.w * k, s.h * k);
  ctx.drawImage(s.img, ox, oy, s.w * k, s.h * k);
  const box = q => [ox + (q.x - 1) * k, oy + (q.y - 1) * k, (lang.width(q) + 2) * k, 9 * k];
  if (sel >= 0 && s.glyphs[sel]) {
    const [x, y, w, h] = box(s.glyphs[sel]), t = Math.max(1, Math.round(k / 5));
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(x, y, w, t); ctx.fillRect(x, y + h - t, w, t); ctx.fillRect(x, y, t, h); ctx.fillRect(x + w - t, y, t, h);
  }
  if (flash && time - flash.t < .25 && s.glyphs[flash.i]) { ctx.fillStyle = 'rgba(255,224,138,.35)'; ctx.fillRect(...box(s.glyphs[flash.i])); }
  const frameBox = (q, col, t) => { const [x, y, w, h] = box(q); ctx.fillStyle = col; ctx.fillRect(x, y, w, t); ctx.fillRect(x, y + h - t, w, t); ctx.fillRect(x, y, t, h); ctx.fillRect(x + w - t, y, t, h); };
  if (cmp && cmp.on) {
    const t = Math.max(1, Math.round(k / 4)), machine = s.glyphs.filter(q => q.k === 'm');
    let ci = 0;
    for (const q of s.glyphs) {
      if (q.k !== 's' || q.n === undefined) continue;
      const key = q.line + ':' + q.n, r = cmp.pairs[key];
      if (!r) continue;
      const col = PAIR_COLORS[ci++ % PAIR_COLORS.length];
      frameBox(q, col, t);
      // 짝지은 소리들 아래에 같은 색 밑줄
      const ms = machine.filter(m => m.line === q.line && m.i >= r[0] && m.i <= r[1]);
      if (ms.length) {
        const [x0, y0, , h0] = box(ms[0]), [x1, , w1] = box(ms[ms.length - 1]);
        ctx.fillStyle = col; ctx.fillRect(x0, y0 + h0 + t, x1 + w1 - x0, t * 2);
      }
    }
    if (cmp.key) {
      const q = s.glyphs.find(g => g.k === 's' && g.n !== undefined && g.line + ':' + g.n === cmp.key);
      if (q && Math.floor(time * 4) % 2) frameBox(q, '#ffffff', t);
      const m = cmp.a !== null && machine.find(g => g.line === +cmp.key.split(':')[0] && g.i === cmp.a);
      if (m) frameBox(m, '#ffffff', t);
    }
  }
  // 대조를 마친 기록: 오른쪽 위에 도장(동그라미 안 체크)
  if (cmp && cmp.verified) {
    const r = 6 * k, cx = ox + s.w * k - r - 2 * k, cy = oy + r + 2 * k;
    ctx.strokeStyle = 'rgba(168,67,46,.85)'; ctx.lineWidth = Math.max(2, k * .8);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * .45, cy); ctx.lineTo(cx - r * .1, cy + r * .4); ctx.lineTo(cx + r * .5, cy - r * .4); ctx.stroke();
  }
  return {k, ox, oy};
}

export function glyphAt(lang, s, frame, px, py) {
  const {k, ox, oy} = frame;
  return s.glyphs.findIndex(q => px >= ox + (q.x - 1) * k && px < ox + (q.x + lang.width(q) + 1) * k && py >= oy + (q.y - 1) * k && py < oy + (q.y + 8) * k);
}
