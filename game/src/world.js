// 맵 모델: 타일, 막힌 칸, 물건, 충돌, 조사 대상 찾기. 그림과 화면은 render.js가 맡는다.
export const TS = 16;
export const T = {WALL: 0, TILE: 1, WOOD: 2, SAND: 3, STAIR: 4, METAL: 5, CARPET: 6, PAD: 7, PATH: 8, ROCK: 9};
const CODES = {W: T.WALL, T: T.TILE, O: T.WOOD, S: T.SAND, A: T.STAIR, M: T.METAL, C: T.CARPET, P: T.PAD, D: T.PATH, R: T.ROCK};
export const DV = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]};

export function buildMap(def) {
  const [W, H] = def.size, terr = new Uint8Array(W * H), solid = new Uint8Array(W * H);
  def.tiles.forEach((row, y) => [...row].forEach((ch, x) => {
    const t = CODES[ch]; terr[y * W + x] = t;
    if (t === T.WALL || t === T.ROCK) solid[y * W + x] = 1;
  }));
  for (const [x, y] of def.solid_cells || []) solid[y * W + x] = 1;
  const objs = def.objects.map(o => ({...o}));
  for (const o of objs) for (const [x, y, w, h] of o.solid || []) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) solid[j * W + i] = 1;
  return {...def, W, H, terr, solid, objs, boxes: def.boxes || [], lights: def.lights || []};
}

export const inMap = (m, x, y) => x >= 0 && y >= 0 && x < m.W && y < m.H;
export const tileAt = (m, x, y) => inMap(m, x, y) ? m.terr[y * m.W + x] : (m.wall === 'rock' ? T.ROCK : T.WALL);
const solidAt = (m, px, py) => { const tx = Math.floor(px / TS), ty = Math.floor(py / TS); return !inMap(m, tx, ty) || m.solid[ty * m.W + tx]; };
const boxHit = (m, x, y) => m.boxes.some(([bx, by, bw, bh]) => x + 4 > bx && x - 4 < bx + bw && y > by && y - 4 < by + bh);
// 플레이어 발 상자(8x4px)가 막히는지
export const blocked = (m, x, y) => solidAt(m, x - 4, y - 4) || solidAt(m, x + 4, y - 4) || solidAt(m, x - 4, y) || solidAt(m, x + 4, y) || boxHit(m, x, y);

// 바라보는 방향 10px 앞에서 8px 안에 있는 조사 대상
export function nearest(m, player) {
  const [dx, dy] = DV[player.dir], px = player.x + dx * 10, py = player.y - 3 + dy * 10;
  let best = null, bd = 1e9;
  for (const o of m.objs) {
    if (!o.use || !o.hit) continue;
    const [x, y, w, h] = o.hit;
    const cx = Math.max(x, Math.min(px, x + w)), cy = Math.max(y, Math.min(py, y + h)), d = Math.hypot(px - cx, py - cy);
    if (d < 8 && d < bd) { bd = d; best = o; }
  }
  return best;
}

// 이동 한 걸음
export function step(m, player, held, dt) {
  let mx = 0, my = 0;
  for (const k of held) { mx += DV[k][0]; my += DV[k][1]; }
  if (!mx && !my) { player.walk = 0; player.frame = 0; return false; }
  player.dir = mx && (!my || Math.abs(mx) >= Math.abs(my)) ? (mx < 0 ? 'left' : 'right') : (my < 0 ? 'up' : 'down');
  const sp = 60 * dt / (mx && my ? Math.SQRT2 : 1);
  if (!blocked(m, player.x + mx * sp, player.y)) player.x += mx * sp;
  if (!blocked(m, player.x, player.y + my * sp)) player.y += my * sp;
  player.walk += dt; player.frame = [1, 0, 2, 0][Math.floor(player.walk * 8) % 4];
  return true;
}
