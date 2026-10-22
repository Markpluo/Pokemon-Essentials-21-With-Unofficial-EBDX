// Room themes and furniture (MapDef.theme and MapDef.decor): floors, walls, furniture and wall decorations
// for the interiors, all plain canvas drawing like art.ts so Mark's own art can replace it piece by piece.
// The decor legend is in packs/hafnia/src/world.ts.
type G2 = CanvasRenderingContext2D;
type At = (x: number, y: number) => string | null;

const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

type FloorStyle = 'wood' | 'tile' | 'check' | 'brick' | 'concrete' | 'stone' | 'plate' | 'parquet' | 'planks';
type WallStyle = 'stripes' | 'plain' | 'tile' | 'brick' | 'panel' | 'stone' | 'glass';
interface Theme {
  floor: FloorStyle; f1: string; f2: string;
  wall: WallStyle; w1: string; w2: string; skirt: string; back: string;
  /** Rug and upholstery colours. */
  rug: string; rug2: string; cloth: string;
  /** Counter tops. */
  top: string;
}

const T = (t: Theme) => t;
export const THEMES: Record<string, Theme> = {
  home: T({ floor: 'wood', f1: '#c99a63', f2: '#b3854f', wall: 'stripes', w1: '#ece2c8', w2: '#dccfae', skirt: '#8a6a48', back: '#4a3b33', rug: '#b8433a', rug2: '#e8c35a', cloth: '#5f8fb0', top: '#e8e2d6' }),
  flat2: T({ floor: 'wood', f1: '#a8794a', f2: '#946a40', wall: 'stripes', w1: '#bcd3e6', w2: '#a9c3da', skirt: '#4a5f78', back: '#2f3a4a', rug: '#3a6fa8', rug2: '#f2efe6', cloth: '#e9823a', top: '#d8d2c4' }),
  center: T({ floor: 'tile', f1: '#f4f1ea', f2: '#e3dccd', wall: 'plain', w1: '#f7f3ec', w2: '#d9473a', skirt: '#c9c3b6', back: '#8e3a34', rug: '#d9473a', rug2: '#f2efe6', cloth: '#d9473a', top: '#f2efe6' }),
  cafe: T({ floor: 'wood', f1: '#7a5233', f2: '#66432a', wall: 'panel', w1: '#2f5e4a', w2: '#244a3a', skirt: '#1f3a2e', back: '#1a2a24', rug: '#8e5bb5', rug2: '#e8c35a', cloth: '#b8433a', top: '#c9a87a' }),
  cafevb: T({ floor: 'concrete', f1: '#9a9890', f2: '#8a8880', wall: 'brick', w1: '#9b4a36', w2: '#86402f', skirt: '#4a3b33', back: '#3a2a24', rug: '#4f8a5b', rug2: '#e8e2d6', cloth: '#2f5e4a', top: '#3b3f4a' }),
  kitchen: T({ floor: 'tile', f1: '#e8e6df', f2: '#cfccc3', wall: 'tile', w1: '#f4f4f0', w2: '#d8d8d2', skirt: '#9aa0a6', back: '#5a6068', rug: '#5f8fb0', rug2: '#f2efe6', cloth: '#5f8fb0', top: '#c9ccd2' }),
  cold: T({ floor: 'tile', f1: '#dfe9ee', f2: '#c3d6df', wall: 'tile', w1: '#e8f1f5', w2: '#c8dbe4', skirt: '#8fb0c0', back: '#4a6a7a', rug: '#5f8fb0', rug2: '#f2efe6', cloth: '#5f8fb0', top: '#c9ccd2' }),
  bakery: T({ floor: 'tile', f1: '#c4704a', f2: '#a85d3c', wall: 'stripes', w1: '#f6e3b4', w2: '#ecd39a', skirt: '#8a5a3a', back: '#5a3a24', rug: '#b8433a', rug2: '#f6e3b4', cloth: '#d9473a', top: '#e8e2d6' }),
  tower: T({ floor: 'brick', f1: '#a65a42', f2: '#8a4a36', wall: 'plain', w1: '#efebe2', w2: '#d8d2c4', skirt: '#a89f8c', back: '#6b665e', rug: '#8e3a34', rug2: '#e8c35a', cloth: '#8e3a34', top: '#8a5a36' }),
  library: T({ floor: 'parquet', f1: '#8a5a36', f2: '#74482a', wall: 'panel', w1: '#7a2e2a', w2: '#5e2220', skirt: '#3b2a22', back: '#2a1c16', rug: '#2f5e4a', rug2: '#c9a24a', cloth: '#2f5e4a', top: '#6b4526' }),
  loft: T({ floor: 'planks', f1: '#6b5338', f2: '#5a4430', wall: 'panel', w1: '#4f4438', w2: '#3f362c', skirt: '#2e2720', back: '#1e1a16', rug: '#5a4430', rug2: '#6b5338', cloth: '#5a4430', top: '#6b5338' }),
  metal: T({ floor: 'plate', f1: '#6f757d', f2: '#858b93', wall: 'panel', w1: '#4a5058', w2: '#3f454c', skirt: '#e8c35a', back: '#2a2e34', rug: '#3b3f4a', rug2: '#e8c35a', cloth: '#1d6fb8', top: '#8a8d93' }),
  boat: T({ floor: 'planks', f1: '#a57e50', f2: '#8e6a42', wall: 'panel', w1: '#2e5f6e', w2: '#244c58', skirt: '#1f4450', back: '#16323a', rug: '#b8433a', rug2: '#f2efe6', cloth: '#7d7f86', top: '#8e6a42' }),
  stone: T({ floor: 'stone', f1: '#8f877b', f2: '#7a7368', wall: 'stone', w1: '#9b958a', w2: '#7f796f', skirt: '#6b665e', back: '#3d3936', rug: '#6b4526', rug2: '#a67646', cloth: '#6b4526', top: '#6b4526' }),
  borsen: T({ floor: 'check', f1: '#e8e2d6', f2: '#3b3f4a', wall: 'panel', w1: '#3f6b5a', w2: '#2f5446', skirt: '#c9a24a', back: '#1f3a30', rug: '#8e3a34', rug2: '#c9a24a', cloth: '#8e3a34', top: '#6b4526' }),
  palace: T({ floor: 'wood', f1: '#b07a45', f2: '#9a6a3a', wall: 'panel', w1: '#8e2f34', w2: '#76262b', skirt: '#c9a24a', back: '#3a1a1c', rug: '#8e2f34', rug2: '#c9a24a', cloth: '#8e2f34', top: '#c9a24a' }),
  vault: T({ floor: 'check', f1: '#d8c08a', f2: '#6b5a3a', wall: 'stone', w1: '#7a6a52', w2: '#665842', skirt: '#c9a24a', back: '#3a3024', rug: '#8e3a34', rug2: '#c9a24a', cloth: '#8e3a34', top: '#c9a24a' }),
  palm: T({ floor: 'stone', f1: '#cfc6b4', f2: '#bdb3a0', wall: 'glass', w1: '#a9dce0', w2: '#f3f1e8', skirt: '#9b958a', back: '#4b5a6b', rug: '#4e9a55', rug2: '#cfc6b4', cloth: '#4e9a55', top: '#cfc6b4' })
};

const box = (g: G2, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

export function themedFloor(g: G2, th: Theme, dx: number, dy: number, x: number, y: number) {
  switch (th.floor) {
    case 'wood': case 'planks': {
      box(g, dx, dy, 32, 32, th.f1);
      g.fillStyle = th.f2;
      const n = th.floor === 'planks' ? 3 : 4, h = 32 / n;
      for (let j = 0; j < n; j++) {
        g.fillRect(dx, dy + Math.round(j * h + h - 1), 32, 1);
        const off = ((y * n + j) * 13 + x * 7) % 32;
        g.fillRect(dx + off, dy + Math.round(j * h), 1, Math.round(h));
        if (th.floor === 'planks' && hash(x * 3 + j, y) % 5 === 0) g.fillRect(dx + (off + 11) % 28, dy + Math.round(j * h + h / 2), 2, 2); // knots and nail heads
      }
      return;
    }
    case 'parquet':
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const along = (i + j + x + y) % 2 === 0;
        box(g, dx + i * 16, dy + j * 16, 16, 16, along ? th.f1 : th.f2);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let k = 4; k < 16; k += 4) along ? g.fillRect(dx + i * 16, dy + j * 16 + k, 16, 1) : g.fillRect(dx + i * 16 + k, dy + j * 16, 1, 16);
      }
      return;
    case 'tile':
      box(g, dx, dy, 32, 32, th.f1);
      g.fillStyle = th.f2;
      g.fillRect(dx, dy + 15, 32, 1); g.fillRect(dx, dy + 31, 32, 1); g.fillRect(dx + 15, dy, 1, 32); g.fillRect(dx + 31, dy, 1, 32);
      return;
    case 'check':
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) box(g, dx + i * 16, dy + j * 16, 16, 16, (i + j) % 2 ? th.f2 : th.f1);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(dx + 2, dy + 2, 6, 1); g.fillRect(dx + 18, dy + 18, 6, 1);
      return;
    case 'brick':
      box(g, dx, dy, 32, 32, th.f1);
      g.fillStyle = th.f2;
      for (let j = 0; j < 4; j++) {
        g.fillRect(dx, dy + j * 8 + 7, 32, 1);
        const o = (j + y * 4) % 2 ? 8 : 0;
        for (let i = o; i < 32; i += 16) g.fillRect(dx + i, dy + j * 8, 1, 8);
      }
      return;
    case 'concrete':
      box(g, dx, dy, 32, 32, th.f1);
      g.fillStyle = th.f2;
      for (let i = 0; i < 6; i++) { const h = hash(x * 31 + i, y * 17 - i); g.fillRect(dx + h % 30, dy + (h >>> 6) % 30, 2, 2); }
      if (x % 3 === 0) g.fillRect(dx, dy, 1, 32);
      if (y % 3 === 0) g.fillRect(dx, dy, 32, 1);
      return;
    case 'stone':
      box(g, dx, dy, 32, 32, th.f2);
      for (const [sx, sy, w, h] of [[1, 1, 14, 9], [16, 1, 15, 13], [1, 11, 10, 20], [12, 11, 3, 3], [12, 15, 19, 16]]) {
        const v = hash(x * 5 + sx, y * 7 + sy) % 3;
        box(g, dx + sx, dy + sy, w, h, v ? th.f1 : th.f2 === th.f1 ? th.f1 : mix(th.f1, th.f2));
      }
      return;
    case 'plate':
      box(g, dx, dy, 32, 32, th.f1);
      g.fillStyle = th.f2;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) g.fillRect(dx + i * 8 + (j % 2) * 4 + 1, dy + j * 8 + 3, 3, 1);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(dx, dy + 31, 32, 1); g.fillRect(dx + 31, dy, 1, 32);
      return;
  }
}

const mixCache: Record<string, string> = {};
function mix(a: string, b: string) {
  const k = a + b;
  if (mixCache[k]) return mixCache[k];
  const p = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  return (mixCache[k] = '#' + [0, 1, 2].map(i => Math.round((p(a, i) + p(b, i)) / 2).toString(16).padStart(2, '0')).join(''));
}

/** A wall tile: the face you see where the room's floor starts below it, otherwise the dark top of the wall. */
export function themedWall(g: G2, th: Theme, dx: number, dy: number, x: number, y: number, below: string | null) {
  if (below === null || below === 'w') { box(g, dx, dy, 32, 32, th.back); return; }
  box(g, dx, dy, 32, 32, th.w1);
  switch (th.wall) {
    case 'stripes': g.fillStyle = th.w2; for (let i = 0; i < 32; i += 8) g.fillRect(dx + i, dy, 2, 22); break;
    case 'plain': box(g, dx, dy + 12, 32, 3, th.w2); break;
    case 'tile':
      g.fillStyle = th.w2;
      for (let j = 0; j < 22; j += 8) g.fillRect(dx, dy + j + 7, 32, 1);
      for (let i = 0; i < 32; i += 8) g.fillRect(dx + i, dy, 1, 22);
      break;
    case 'brick':
      g.fillStyle = th.w2;
      for (let j = 0; j < 3; j++) { g.fillRect(dx, dy + j * 7 + 6, 32, 1); for (let i = (j + y) % 2 ? 0 : 8; i < 32; i += 16) g.fillRect(dx + i, dy + j * 7, 1, 7); }
      break;
    case 'panel': box(g, dx, dy + 10, 32, 12, th.w2); box(g, dx + 3, dy + 12, 26, 8, mix(th.w1, th.w2)); break;
    case 'stone':
      g.fillStyle = th.w2;
      g.fillRect(dx, dy + 10, 32, 1); g.fillRect(dx + ((x % 2) ? 6 : 20), dy, 1, 10); g.fillRect(dx + ((x % 2) ? 18 : 4), dy + 11, 1, 11);
      break;
    case 'glass':
      g.fillStyle = th.w2; for (let i = 0; i < 32; i += 10) g.fillRect(dx + i, dy, 2, 22); g.fillRect(dx, dy + 10, 32, 2);
      break;
  }
  box(g, dx, dy + 22, 32, 10, th.skirt);
  box(g, dx, dy + 22, 32, 2, mix(th.skirt, '#000000'));
}

/** Draws a decor char on its tile. `onWall` pieces hang on a wall face; the rest stand on the floor. */
export function drawDecor(g: G2, ch: string, th: Theme, x: number, y: number, dx: number, dy: number, decorAt: At, time: number, night: boolean, onWall: boolean) {
  const b = (bx: number, by: number, w: number, h: number, c: string) => box(g, dx + bx, dy + by, w, h, c);
  const same = (ox: number, oy: number) => decorAt(x + ox, y + oy) === ch;
  const shadow = () => b(1, 28, 30, 3, 'rgba(0,0,0,0.18)');
  if (onWall) {
    switch (ch) {
      case 'W': { // window: sky by time of day
        const sky = night ? '#1d2b55' : '#9fd0ec';
        b(5, 2, 22, 18, '#f2efe6'); b(7, 4, 18, 14, sky);
        if (night) { b(19, 6, 2, 2, '#fff3cc'); b(10, 12, 1, 1, '#c9d2e3'); } else b(8, 5, 6, 3, 'rgba(255,255,255,0.6)');
        b(15, 4, 2, 14, '#f2efe6'); b(7, 10, 18, 2, '#f2efe6'); b(4, 19, 24, 3, '#d8d2c4');
        return;
      }
      case 'P': b(7, 3, 18, 14, '#6b4526'); b(9, 5, 14, 10, '#9fd0ec'); b(9, 11, 14, 4, '#4e9a55'); b(16, 7, 3, 3, '#f2c33b'); return;
      case 'Q':
        g.fillStyle = '#6b4526'; g.beginPath(); g.arc(dx + 16, dy + 10, 8, 0, 7); g.fill();
        g.fillStyle = '#f2efe6'; g.beginPath(); g.arc(dx + 16, dy + 10, 6, 0, 7); g.fill();
        b(15, 5, 1, 5, '#26272c'); b(16, 10, 4, 1, '#26272c');
        return;
      case 'U': b(9, 3, 14, 17, '#f2efe6'); b(9, 3, 14, 4, '#d9473a'); for (let i = 9; i < 18; i += 3) b(11, i, 10, 1, '#8a8d93'); b(15, 2, 2, 2, '#c9302c'); return;
      case 'I': b(4, 3, 24, 17, '#e8dcb5'); b(6, 6, 9, 6, '#7fb0c8'); b(17, 9, 8, 8, '#a9c98a'); g.strokeStyle = '#b8433a'; g.lineWidth = 1; g.beginPath(); g.moveTo(dx + 8, dy + 16); g.lineTo(dx + 14, dy + 11); g.lineTo(dx + 22, dy + 14); g.stroke(); return;
      case '0':
        g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(dx + 16, dy + 11, 9, 0, 7); g.fill();
        g.fillStyle = night ? '#16233a' : '#5b8fb0'; g.beginPath(); g.arc(dx + 16, dy + 11, 6, 0, 7); g.fill();
        b(12, 8, 3, 2, 'rgba(255,255,255,0.5)');
        return;
      case '1':
        g.lineWidth = 5; g.strokeStyle = '#f2efe6'; g.beginPath(); g.arc(dx + 16, dy + 11, 7, 0, 7); g.stroke();
        g.strokeStyle = '#d9473a'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(dx + 16, dy + 11, 7, k * Math.PI / 2, k * Math.PI / 2 + 0.6); g.stroke(); }
        return;
      case 'J':
        b(2, 14, 28, 3, '#6b4526');
        for (let i = 0; i < 5; i++) b(4 + i * 5, 6 + (i % 2) * 2, 4, 8 - (i % 2) * 2, ['#d9473a', '#f2c33b', '#3a7bd5', '#4fae5b', '#e8e2d6'][(i + x) % 5]);
        return;
      case 'L': {
        b(14, 4, 4, 3, '#3b3f4a'); b(12, 7, 8, 6, '#e8c35a');
        const gr = g.createRadialGradient(dx + 16, dy + 10, 1, dx + 16, dy + 10, 14);
        gr.addColorStop(0, 'rgba(255,230,160,0.55)'); gr.addColorStop(1, 'rgba(255,230,160,0)');
        g.fillStyle = gr; g.fillRect(dx, dy, 32, 24);
        return;
      }
      case 'H': // the Center's healing machine on the back wall: a screen and six ball slots
        b(2, 1, 28, 20, '#c9ccd2'); b(4, 3, 24, 7, '#26323a'); b(5, 4, 8, 5, (time >> 4) % 2 ? '#4fae5b' : '#3a8a4a');
        for (let i = 0; i < 6; i++) { g.fillStyle = '#d9473a'; g.beginPath(); g.arc(dx + 7 + (i % 3) * 9, dy + 13 + Math.floor(i / 3) * 5, 2, 0, 7); g.fill(); }
        return;
    }
    return;
  }
  switch (ch) {
    case 'r': { // rug: a border round the whole run
      const up = same(0, -1), dn = same(0, 1), lf = same(-1, 0), rt = same(1, 0);
      b(lf ? 0 : 3, up ? 0 : 3, 32 - (lf ? 0 : 3) - (rt ? 0 : 3), 32 - (up ? 0 : 3) - (dn ? 0 : 3), th.rug);
      g.fillStyle = th.rug2;
      if (!up) b(lf ? 0 : 5, 5, 32 - (lf ? 0 : 5) - (rt ? 0 : 5), 1, th.rug2);
      if (!dn) b(lf ? 0 : 5, 26, 32 - (lf ? 0 : 5) - (rt ? 0 : 5), 1, th.rug2);
      if (!lf) b(5, up ? 0 : 5, 1, 32 - (up ? 0 : 5) - (dn ? 0 : 5), th.rug2);
      if (!rt) b(26, up ? 0 : 5, 1, 32 - (up ? 0 : 5) - (dn ? 0 : 5), th.rug2);
      return;
    }
    case 'e': b(4, 4, 24, 24, '#26272c'); g.fillStyle = '#6f757d'; for (let i = 6; i < 28; i += 4) g.fillRect(dx + i, dy + 4, 2, 24); return;
    case 'B':
      shadow(); b(2, 0, 28, 30, '#6b4526'); b(4, 2, 24, 26, '#f2efe6'); b(7, 3, 18, 6, '#ffffff'); b(4, 12, 24, 16, th.cloth); b(4, 12, 24, 2, 'rgba(255,255,255,0.35)');
      return;
    case 'b': shadow(); b(2, 2, 28, 28, '#6b4526'); b(4, 4, 24, 22, '#7d7f86'); b(6, 5, 10, 5, '#e8e6e0'); b(4, 14, 24, 1, '#5d5f66'); return;
    case 'S': { // bookcase, a little taller than its tile
      b(1, -8, 30, 38, '#4a3020'); b(3, -6, 26, 34, '#6b4526');
      for (let s = 0; s < 3; s++) {
        const sy = -5 + s * 11;
        for (let i = 0; i < 6; i++) b(4 + i * 4, sy + (hash(x * 9 + i, y * 3 + s) % 3), 3, 9 - (hash(x * 9 + i, y * 3 + s) % 3), ['#b8433a', '#3a6fa8', '#4f8a5b', '#e8c35a', '#8e5bb5', '#e8e2d6'][hash(x + i, s + y) % 6]);
        b(3, sy + 9, 26, 2, '#4a3020');
      }
      return;
    }
    case 'T': {
      const lf = same(-1, 0), rt = same(1, 0);
      shadow();
      b(lf ? 0 : 2, 6, 32 - (lf ? 0 : 2) - (rt ? 0 : 2), 16, '#8a5a36'); b(lf ? 0 : 2, 6, 32 - (lf ? 0 : 2) - (rt ? 0 : 2), 3, '#a67646');
      if (!lf) b(3, 22, 3, 7, '#5a3a24');
      if (!rt) b(26, 22, 3, 7, '#5a3a24');
      if (hash(x, y) % 3 === 0) { b(12, 10, 8, 6, '#f2efe6'); b(14, 11, 4, 3, '#8a5a36'); }   // a cup
      return;
    }
    case 'h': {
      const tableRight = decorAt(x + 1, y) === 'T', tableLeft = decorAt(x - 1, y) === 'T';
      shadow(); b(8, 12, 16, 12, '#8a5a36'); b(8, 22, 2, 7, '#5a3a24'); b(22, 22, 2, 7, '#5a3a24');
      if (tableRight) b(6, 4, 4, 20, '#6b4526'); else if (tableLeft) b(22, 4, 4, 20, '#6b4526'); else b(8, 4, 16, 6, '#6b4526');
      return;
    }
    case 'o': case 'A': {
      const lf = ch === 'o' && same(-1, 0), rt = ch === 'o' && same(1, 0);
      shadow(); b(lf ? 0 : 2, 4, 32 - (lf ? 0 : 2) - (rt ? 0 : 2), 10, mix(th.cloth, '#000000')); b(lf ? 0 : 2, 12, 32 - (lf ? 0 : 2) - (rt ? 0 : 2), 16, th.cloth);
      if (!lf) b(2, 8, 5, 20, mix(th.cloth, '#000000'));
      if (!rt) b(25, 8, 5, 20, mix(th.cloth, '#000000'));
      b(lf ? 0 : 7, 14, 32 - (lf ? 0 : 7) - (rt ? 0 : 7), 2, 'rgba(255,255,255,0.25)');
      return;
    }
    case 'C': case '$': case 'k': case 'E': case 'G': {
      const lf = 'C$kEG'.includes(decorAt(x - 1, y) ?? '-'), rt = 'C$kEG'.includes(decorAt(x + 1, y) ?? '-');
      shadow();
      b(0, 10, 32, 20, mix(th.top, th.back)); b(0, 6, 32, 6, th.top);
      if (!lf) b(0, 6, 2, 24, 'rgba(0,0,0,0.25)');
      if (!rt) b(30, 6, 2, 24, 'rgba(0,0,0,0.25)');
      if (ch === '$') { b(9, -2, 14, 9, '#3b3f4a'); b(11, 0, 10, 3, '#4fae5b'); b(10, 6, 12, 2, '#26272c'); }
      if (ch === 'k') { b(6, 7, 20, 5, '#9aa0a6'); b(8, 8, 16, 3, '#5f8fb0'); b(15, 2, 2, 6, '#c9ccd2'); }
      if (ch === 'E') { b(6, -4, 20, 12, '#c9ccd2'); b(8, -2, 16, 4, '#8a8d93'); b(10, 4, 3, 3, '#26272c'); b(19, 4, 3, 3, '#26272c'); b(9, 7, 4, 2, '#f2efe6'); }
      if (ch === 'G') { // glass case with kanelsnegle and wienerbrød
        b(1, 0, 30, 12, 'rgba(201,230,240,0.75)'); b(1, 0, 30, 1, '#f2efe6');
        for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#c98a3a' : '#e0a85a'; g.beginPath(); g.arc(dx + 6 + i * 7, dy + 8, 3, 0, 7); g.fill(); g.fillStyle = '#7a4a2a'; g.fillRect(dx + 5 + i * 7, dy + 7, 2, 1); }
      }
      return;
    }
    case 'F': shadow(); b(3, -8, 26, 37, '#e8e6e0'); b(3, 6, 26, 1, '#b8b5ae'); b(24, -4, 2, 8, '#8a8d93'); b(24, 10, 2, 10, '#8a8d93'); return;
    case 'O':
      shadow(); b(2, 4, 28, 26, '#c9ccd2'); b(2, 4, 28, 10, '#3b3f4a');
      for (const [cx, cy] of [[9, 7], [23, 7], [9, 11], [23, 11]]) { g.strokeStyle = '#8a8d93'; g.lineWidth = 1; g.beginPath(); g.arc(dx + cx, dy + cy, 2.5, 0, 7); g.stroke(); }
      b(6, 17, 20, 9, '#26272c'); b(8, 19, 16, 5, '#4a3b33'); b(6, 15, 20, 1, '#8a8d93');
      return;
    case 'M':
      b(1, -8, 30, 38, '#c9ccd2'); b(3, -6, 26, 34, '#e8e6e0');
      for (let s = 0; s < 3; s++) {
        const sy = -5 + s * 11;
        for (let i = 0; i < 4; i++) b(4 + i * 6, sy + 2, 5, 7, ['#d9473a', '#3a6fa8', '#f2c33b', '#4fae5b', '#8e5bb5'][(hash(x + i, y + s) >>> 2) % 5]);
        b(3, sy + 9, 26, 2, '#9aa0a6');
      }
      return;
    case 'D':
      shadow(); b(1, 6, 30, 16, '#6b4526'); b(1, 6, 30, 3, '#8a5a36'); b(3, 22, 3, 7, '#4a3020'); b(26, 22, 3, 7, '#4a3020');
      b(5, 9, 10, 7, '#f2efe6'); b(6, 11, 8, 1, '#9aa0a6'); b(6, 13, 6, 1, '#9aa0a6');
      b(20, 0, 9, 8, '#26323a'); b(21, 1, 7, 5, night ? '#7fb0c8' : '#5f8fb0'); b(23, 8, 3, 3, '#3b3f4a');
      return;
    case 'V':
      shadow(); b(3, 18, 26, 11, '#6b4526'); b(4, 1, 24, 17, '#26272c'); b(6, 3, 20, 12, (time >> 5) % 3 ? '#5f8fb0' : '#7fb0c8');
      return;
    case 'p':
      shadow(); b(9, 20, 14, 10, '#b8633a'); b(9, 20, 14, 2, '#d9844f');
      g.fillStyle = '#2f6f3c'; g.beginPath(); g.arc(dx + 16, dy + 13, 10, 0, 7); g.fill();
      g.fillStyle = '#4e9a55'; g.beginPath(); g.arc(dx + 12, dy + 10, 5, 0, 7); g.arc(dx + 20, dy + 12, 5, 0, 7); g.fill();
      return;
    case 'X':
      shadow(); b(3, 4, 26, 25, '#a67646'); g.strokeStyle = '#7a5233'; g.lineWidth = 2; g.strokeRect(dx + 4, dy + 5, 24, 23);
      g.beginPath(); g.moveTo(dx + 5, dy + 6); g.lineTo(dx + 27, dy + 27); g.moveTo(dx + 27, dy + 6); g.lineTo(dx + 5, dy + 27); g.stroke();
      return;
    case 'Y':
      shadow(); b(6, 4, 20, 25, '#8a5a36'); b(4, 9, 24, 15, '#8a5a36'); b(4, 9, 24, 2, '#4a4e54'); b(4, 21, 24, 2, '#4a4e54');
      g.fillStyle = '#6b4526'; g.beginPath(); g.ellipse(dx + 16, dy + 5, 10, 3, 0, 0, 7); g.fill();
      return;
    case 'N': {
      shadow(); b(2, -2, 28, 31, '#5a6068'); b(4, 0, 24, 10, '#26323a');
      const t = time >> 3;
      for (let i = 0; i < 4; i++) b(6 + i * 6, 3, 3, 3, (t + i + x) % 4 === 0 ? '#ff6b5a' : (t + i) % 3 ? '#4fae5b' : '#e8c35a');
      b(6, 14, 20, 2, '#3b3f4a'); b(6, 19, 8, 6, '#3b3f4a'); b(18, 19, 8, 6, '#1d6fb8');
      return;
    }
    case 'Z':
      shadow(); b(4, 16, 24, 10, '#6b4526');
      g.fillStyle = '#7a3a1e'; g.beginPath(); g.arc(dx + 9, dy + 26, 4, 0, 7); g.arc(dx + 23, dy + 26, 4, 0, 7); g.fill();
      b(6, 8, 24, 9, '#2a2c30'); b(26, 7, 5, 11, '#2a2c30'); b(6, 9, 24, 2, '#4a4e54');
      return;
    case 't':
      shadow(); b(14, 16, 4, 13, '#3b3f4a'); b(8, 27, 16, 2, '#3b3f4a');
      g.save(); g.translate(dx + 16, dy + 14); g.rotate(-0.6); g.fillStyle = '#c9a24a'; g.fillRect(-12, -3, 24, 6); g.fillStyle = '#26323a'; g.fillRect(10, -4, 3, 8); g.restore();
      return;
  }
}

/** Furniture on a 'K' tile that the decor doesn't name: a plain cabinet in the room's wood. */
export function plainFurniture(g: G2, th: Theme, dx: number, dy: number) {
  box(g, dx + 1, dy + 6, 30, 24, mix(th.top, '#4a3020'));
  box(g, dx + 1, dy + 4, 30, 10, th.top);
  box(g, dx + 1, dy + 4, 30, 2, 'rgba(255,255,255,0.3)');
}
