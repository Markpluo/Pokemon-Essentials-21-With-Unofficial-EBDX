// Hand-drawn placeholder art for the demo maps: city, indoor and tunnel tiles the Essentials
// tilesets don't have in a usable form, story objects (switches, valves, lily pads...) and a few
// buildings. Everything is plain canvas drawing, so Mark's own art can replace it piece by piece.
import { THEMES, plainFurniture, themedFloor, themedWall } from './interiors';

type G2 = CanvasRenderingContext2D;
type TileAt = (x: number, y: number) => string | null;

export const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

const HOUSE_COLOURS = ['#d9473a', '#f2c33b', '#3a7bd5', '#4fae5b', '#e9823a', '#8e5bb5', '#e8d9b5', '#5fa8a0'];
const CONTAINER_COLOURS = ['#c8743a', '#3a6fa8', '#b8433a', '#4f8a5b', '#7d7f86'];

function speckle(g: G2, dx: number, dy: number, x: number, y: number, colour: string, n: number) {
  g.fillStyle = colour;
  for (let i = 0; i < n; i++) { const h = hash(x * 31 + i, y * 17 - i); g.fillRect(dx + h % 30, dy + (h >>> 6) % 30, 2, 2); }
}

function floor(g: G2, dx: number, dy: number, x: number, y: number) {
  g.fillStyle = '#c99a63'; g.fillRect(dx, dy, 32, 32);
  g.fillStyle = '#b3854f';
  for (let j = 0; j < 4; j++) {
    g.fillRect(dx, dy + j * 8 + 7, 32, 1);
    const off = ((y * 4 + j) * 13 + x * 7) % 32;
    g.fillRect(dx + off, dy + j * 8, 1, 8);
  }
}

function mat(g: G2, dx: number, dy: number) {
  g.fillStyle = '#9b3b33'; g.fillRect(dx + 2, dy + 8, 28, 18);
  g.fillStyle = '#c9574b'; g.fillRect(dx + 4, dy + 10, 24, 14);
}

/** Vesterbro's red-brick courtyard blocks: brick courses, white-framed sash windows, a cornice along the top. */
function brickFacade(g: G2, x: number, y: number, dx: number, dy: number, tileAt: TileAt) {
  const above = tileAt(x, y - 1), below = tileAt(x, y + 1);
  g.fillStyle = (hash(Math.floor(x / 4), 3) & 1) ? '#a5462f' : '#9b4030'; g.fillRect(dx, dy, 32, 32);
  g.fillStyle = 'rgba(60,20,12,0.35)';
  for (let j = 0; j < 8; j++) { g.fillRect(dx, dy + j * 4 + 3, 32, 1); for (let i = (j % 2) * 4; i < 32; i += 8) g.fillRect(dx + i, dy + j * 4, 1, 3); }
  if (above !== 'H') { g.fillStyle = '#5a5e66'; g.fillRect(dx, dy, 32, 6); g.fillStyle = '#e8e2d6'; g.fillRect(dx, dy + 6, 32, 2); }
  else if (litWindow(x, y, tileAt) !== null) { g.fillStyle = '#f2efe6'; g.fillRect(dx + 9, dy + 5, 14, 20); g.fillStyle = '#3a4a5e'; g.fillRect(dx + 11, dy + 7, 10, 16); g.fillStyle = '#f2efe6'; g.fillRect(dx + 11, dy + 14, 10, 2); }
  if (below !== null && below !== 'H') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(dx, dy + 28, 32, 4); }
}

/** Which house-front tiles have a window (and so can light up at night): not the roof row. Returns the window
 *  rect inside the tile, or null. */
export function litWindow(x: number, y: number, tileAt: TileAt, theme?: string): [number, number, number, number] | null {
  if (tileAt(x, y) !== 'H' || tileAt(x, y - 1) !== 'H') return null;
  return theme === 'brick' ? [11, 7, 10, 16] : [8, 6, 10, 14];
}

/** Draws one of the hand-drawn tiles. Returns false for tiles the caller draws from the tileset. */
export function drawTile(g: G2, t: string, x: number, y: number, dx: number, dy: number, tileAt: TileAt, time: number, theme?: string): boolean {
  const th = theme ? THEMES[theme] : undefined;
  if (th) {
    if (t === '_') { themedFloor(g, th, dx, dy, x, y); return true; }
    if (t === 'K') { themedFloor(g, th, dx, dy, x, y); return true; }   // the furniture itself is drawn with the decor
    if (t === 'm') { themedFloor(g, th, dx, dy, x, y); mat(g, dx, dy); return true; }
    if (t === 'w') { themedWall(g, th, dx, dy, x, y, tileAt(x, y + 1)); return true; }
  }
  if (t === 'H' && theme === 'brick') { brickFacade(g, x, y, dx, dy, tileAt); return true; }
  switch (t) {
    case '_': floor(g, dx, dy, x, y); return true;
    case 'm': floor(g, dx, dy, x, y); mat(g, dx, dy); return true;
    case 'w': {
      const below = tileAt(x, y + 1);
      if (below !== null && below !== 'w') {
        g.fillStyle = '#ece2c8'; g.fillRect(dx, dy, 32, 32);
        g.fillStyle = '#dccfae'; for (let i = 0; i < 32; i += 8) g.fillRect(dx + i, dy, 1, 22);
        g.fillStyle = '#8a6a48'; g.fillRect(dx, dy + 22, 32, 10);
        g.fillStyle = '#6e5238'; g.fillRect(dx, dy + 22, 32, 2);
      } else { g.fillStyle = '#4a3b33'; g.fillRect(dx, dy, 32, 32); g.fillStyle = '#5a4a40'; g.fillRect(dx, dy + 28, 32, 4); }
      return true;
    }
    case 'K':
      floor(g, dx, dy, x, y);
      g.fillStyle = '#6b4526'; g.fillRect(dx + 1, dy + 6, 30, 24);
      g.fillStyle = '#a67646'; g.fillRect(dx + 1, dy + 4, 30, 10);
      g.fillStyle = '#c08f5c'; g.fillRect(dx + 1, dy + 4, 30, 2);
      return true;
    case 'P':
      floor(g, dx, dy, x, y);
      g.fillStyle = '#8a5a3a'; g.fillRect(dx + 6, dy + 20, 20, 10);
      g.fillStyle = '#2f6f3c'; g.beginPath(); g.arc(dx + 16, dy + 14, 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4e9a55'; g.beginPath(); g.arc(dx + 12, dy + 11, 6, 0, Math.PI * 2); g.arc(dx + 21, dy + 13, 5, 0, Math.PI * 2); g.fill();
      return true;
    case 'c':
      g.fillStyle = '#6d6a66'; g.fillRect(dx, dy, 32, 32);
      speckle(g, dx, dy, x, y, '#5d5a57', 7); speckle(g, dx, dy, x + 3, y, '#7d7a76', 4);
      return true;
    case 'R': {
      g.fillStyle = '#3d3936'; g.fillRect(dx, dy, 32, 32);
      speckle(g, dx, dy, x, y, '#4b4643', 6);
      if (tileAt(x, y + 1) !== 'R' && tileAt(x, y + 1) !== null) { g.fillStyle = '#57514c'; g.fillRect(dx, dy + 26, 32, 6); }
      return true;
    }
    case 'p':
      g.fillStyle = '#3d3936'; g.fillRect(dx, dy, 32, 32);
      g.fillStyle = '#c8743a'; g.fillRect(dx, dy + 6, 32, 8);
      g.fillStyle = '#e09a5e'; g.fillRect(dx, dy + 6, 32, 2);
      g.fillStyle = '#e8e6e0'; g.fillRect(dx, dy + 18, 32, 8);
      g.fillStyle = '#b8b5ae'; g.fillRect(dx, dy + 24, 32, 2);
      if (x % 3 === 0) { g.fillStyle = '#7a4a2a'; g.fillRect(dx + 14, dy + 4, 4, 12); g.fillStyle = '#8a8780'; g.fillRect(dx + 14, dy + 16, 4, 12); }
      return true;
    case 'a':
      g.fillStyle = '#7a7e84'; g.fillRect(dx, dy, 32, 32);
      speckle(g, dx, dy, x, y, '#6c7076', 6);
      return true;
    case 'l': {
      g.fillStyle = '#5f7fae'; g.fillRect(dx, dy, 32, 32);
      speckle(g, dx, dy, x, y, '#56749f', 5);
      const up = tileAt(x, y - 1), down = tileAt(x, y + 1);
      g.fillStyle = '#f2efe6';
      if (up !== 'l') g.fillRect(dx, dy, 32, 2);
      if (down !== 'l') g.fillRect(dx, dy + 30, 32, 2);
      if (up === 'l' && x % 2 === 0) g.fillRect(dx + 4, dy, 18, 2);
      // a bike symbol every few tiles
      if (hash(x, y) % 7 === 0) { g.strokeStyle = '#f2efe6'; g.lineWidth = 1.5; g.beginPath(); g.arc(dx + 10, dy + 20, 4, 0, 7); g.arc(dx + 22, dy + 20, 4, 0, 7); g.stroke(); }
      return true;
    }
    case 'q': {
      g.fillStyle = '#8f877b'; g.fillRect(dx, dy, 32, 32);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const sx = dx + i * 8 + (j % 2) * 4 - 2, sy = dy + j * 8;
        g.fillStyle = (hash(x * 4 + i, y * 4 + j) & 3) ? '#b0a796' : '#a3998a';
        g.beginPath(); g.ellipse(sx + 4, sy + 4, 3.4, 3, 0, 0, 7); g.fill();
      }
      return true;
    }
    case 'd':
      g.fillStyle = '#5b8fb0'; g.fillRect(dx, dy, 32, 32);
      for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#9a7448' : '#a57e50'; g.fillRect(dx + i * 8, dy, 7, 32); }
      g.fillStyle = '#6e5232'; g.fillRect(dx, dy + 30, 32, 2);
      return true;
    case 'H': {
      const col = HOUSE_COLOURS[hash(Math.floor(x / 3), Math.floor(y / 5) + 7) % HOUSE_COLOURS.length];
      const above = tileAt(x, y - 1), below = tileAt(x, y + 1);
      g.fillStyle = col; g.fillRect(dx, dy, 32, 32);
      if (above !== 'H') { g.fillStyle = '#7a3a30'; g.fillRect(dx, dy, 32, 10); g.fillStyle = '#93473b'; for (let i = 0; i < 32; i += 6) g.fillRect(dx + i, dy + 2, 4, 6); }
      else { g.fillStyle = 'rgba(255,245,210,0.9)'; g.fillRect(dx + 8, dy + 6, 10, 14); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(dx + 8, dy + 12, 10, 1); g.fillRect(dx + 13, dy + 6, 1, 14); }
      if (x % 3 === 2) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(dx + 30, dy, 2, 32); }
      if (below !== null && below !== 'H') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(dx, dy + 28, 32, 4); }
      return true;
    }
    case 'x': {
      const col = CONTAINER_COLOURS[hash(Math.floor(x / 3), y) % CONTAINER_COLOURS.length];
      g.fillStyle = '#7a7e84'; g.fillRect(dx, dy, 32, 32);
      g.fillStyle = col; g.fillRect(dx + 1, dy + 2, 30, 28);
      g.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 4; i < 32; i += 5) g.fillRect(dx + i, dy + 2, 1, 28);
      return true;
    }
    case 'i': {
      // Gym 3 sea ice: pale blue with a few scratches and a moving glint.
      g.fillStyle = '#cfe8f5'; g.fillRect(dx, dy, 32, 32);
      g.fillStyle = '#b5d8ec'; g.fillRect(dx, dy + 31, 32, 1); g.fillRect(dx + 31, dy, 1, 32);
      g.fillStyle = '#e9f6fc'; const h = hash(x, y); g.fillRect(dx + h % 20, dy + (h >>> 5) % 24, 9, 1); g.fillRect(dx + (h >>> 3) % 24, dy + (h >>> 9) % 26, 5, 1);
      if (((time >> 2) + x * 3 + y * 5) % 90 < 3) { g.fillStyle = '#fff'; g.fillRect(dx + 14, dy + 14, 4, 4); }
      return true;
    }
    case 'u': {
      // Storm drain water: a dark channel with a slow current.
      g.fillStyle = '#26323a'; g.fillRect(dx, dy, 32, 32);
      g.fillStyle = '#3a4b55'; const o = ((time >> 2) + x * 9) % 32;
      g.fillRect(dx + o, dy + 9, 8, 1); g.fillRect(dx + (o + 17) % 32, dy + 21, 6, 1);
      return true;
    }
    case 'W':
      // Kødbyen's white-tiled yard.
      g.fillStyle = '#e8e6df'; g.fillRect(dx, dy, 32, 32);
      g.fillStyle = '#cfccc3'; g.fillRect(dx, dy + 15, 32, 1); g.fillRect(dx, dy + 31, 32, 1); g.fillRect(dx + 15, dy, 1, 32); g.fillRect(dx + 31, dy, 1, 32);
      return true;
    case 'v': {
      // The neon square: dark paving with coloured light pooled on it.
      g.fillStyle = '#3b3a48'; g.fillRect(dx, dy, 32, 32);
      speckle(g, dx, dy, x, y, '#45445a', 5);
      const c = ['rgba(255,80,170,0.22)', 'rgba(80,200,255,0.22)', 'rgba(255,211,107,0.18)'][hash(x, y) % 3];
      g.fillStyle = c; g.beginPath(); g.arc(dx + 16, dy + 16, 12 + Math.sin(time / 20 + x) * 2, 0, 7); g.fill();
      return true;
    }
    case 'y': {
      // Cykelslangen's orange deck.
      g.fillStyle = '#e07a2e'; g.fillRect(dx, dy, 32, 32);
      g.fillStyle = '#c96a24'; g.fillRect(dx, dy + 30, 32, 2);
      const up = tileAt(x, y - 1), down = tileAt(x, y + 1);
      g.fillStyle = '#f7d9b8';
      if (up !== 'y') g.fillRect(dx, dy, 32, 3);
      if (down !== 'y') g.fillRect(dx, dy + 29, 32, 3);
      if (x % 2 === 0 && up === 'y' && down === 'y') g.fillRect(dx + 6, dy + 15, 16, 2);
      return true;
    }
    case 'z': {
      // Gym 5 Trick Room floor: a violet checkerboard that slowly shimmers.
      const ph = ((time >> 3) + x + y) % 12 < 6;
      g.fillStyle = (x + y) % 2 ? '#5a3f8a' : '#6d4fa3'; g.fillRect(dx, dy, 32, 32);
      g.fillStyle = ph ? 'rgba(255,214,255,0.16)' : 'rgba(255,214,255,0.06)'; g.fillRect(dx + 3, dy + 3, 26, 26);
      g.strokeStyle = '#c9a8f0'; g.lineWidth = 1; g.strokeRect(dx + 0.5, dy + 0.5, 31, 31);
      return true;
    }
    case 'j': {
      // Gym 6: the Rutschebanen's wooden coaster track over a dark drop.
      g.fillStyle = '#1b1622'; g.fillRect(dx, dy, 32, 32);
      g.fillStyle = '#6b4526'; for (let i = 2; i < 32; i += 8) g.fillRect(dx + i, dy, 3, 32);
      g.fillStyle = '#a67646'; g.fillRect(dx, dy + 9, 32, 3); g.fillRect(dx, dy + 21, 32, 3);
      g.fillStyle = '#c9cdd4'; g.fillRect(dx, dy + 9, 32, 1); g.fillRect(dx, dy + 21, 32, 1);
      return true;
    }
    case 'n':
      g.fillStyle = '#7a7e84'; g.fillRect(dx, dy, 32, 32);
      g.fillStyle = '#2f4a3a'; g.fillRect(dx + 13, dy, 6, 32);
      g.fillStyle = '#466b55'; g.fillRect(dx + 14, dy, 2, 32);
      return true;
  }
  void time;
  return false;
}

// ---------- objects ----------

const SWITCH: Record<string, string> = { green: '#4fae5b', gold: '#e8c35a', silver: '#c9ccd2', purple: '#8e5bb5' };

/** Draws an `obj:*` sprite with its tile's top-left at (dx, dy). */
export function drawObject(g: G2, kind: string, dx: number, dy: number, time: number) {
  const box = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(dx + x, dy + y, w, h); };
  if (kind.startsWith('cart-')) {
    const col = ({ red: '#c9574b', blue: '#3a6fa8', green: '#4fae5b', yellow: '#e8c35a', purple: '#8e5bb5' } as Record<string, string>)[kind.slice(5)] ?? '#888';
    box(2, 12, 28, 14, col); box(4, 8, 24, 6, col); box(4, 10, 24, 2, 'rgba(255,255,255,0.35)');
    g.fillStyle = '#26272c'; g.beginPath(); g.arc(dx + 8, dy + 27, 3, 0, 7); g.arc(dx + 24, dy + 27, 3, 0, 7); g.fill();
    return;
  }
  if (kind.startsWith('switch-')) {
    box(6, 8, 20, 22, '#3b3f4a'); box(8, 10, 16, 18, '#565b66');
    g.fillStyle = SWITCH[kind.slice(7)] ?? '#fff'; g.beginPath(); g.arc(dx + 16, dy + 19, 6, 0, 7); g.fill();
    return;
  }
  switch (kind) {
    case 'sign': box(14, 16, 4, 16, '#6b4526'); box(4, 4, 24, 14, '#a67646'); box(6, 6, 20, 10, '#c9a06a'); box(8, 9, 16, 1, '#6b4526'); box(8, 12, 12, 1, '#6b4526'); break;
    case 'billboard':
      box(6, 18, 3, 14, '#555'); box(23, 18, 3, 14, '#555'); box(0, 2, 32, 18, '#e8e6e0'); box(1, 3, 30, 16, '#1d6fb8');
      g.fillStyle = '#fff'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.fillText('VANGUARD', dx + 16, dy + 14); g.textAlign = 'left'; break;
    case 'tv': box(3, 8, 26, 18, '#26272c'); box(5, 10, 22, 14, (time >> 4) % 2 ? '#5f8fc4' : '#6f9fd4'); box(12, 26, 8, 4, '#26272c'); break;
    case 'bed': box(2, 2, 28, 28, '#6b4526'); box(4, 4, 24, 8, '#f2efe6'); box(4, 12, 24, 16, '#3a7bd5'); box(4, 12, 24, 2, '#5f8fc4'); break;
    case 'pc': box(4, 8, 24, 22, '#c9ccd2'); box(7, 11, 18, 11, (time >> 5) % 2 ? '#4fd17a' : '#3fb86a'); break;
    case 'poster': box(6, 2, 20, 26, '#f2efe6'); box(8, 4, 16, 10, '#1d6fb8'); box(8, 16, 16, 2, '#1d6fb8'); box(8, 20, 12, 2, '#1d6fb8'); break;
    case 'vent': {
      box(4, 8, 24, 22, '#3b3f4a'); for (let i = 0; i < 4; i++) box(6, 11 + i * 5, 20, 2, '#26272c');
      const puff = (time >> 3) % 6;
      g.fillStyle = 'rgba(142,91,181,0.55)'; g.beginPath(); g.arc(dx + 16, dy + 4 - puff, 7 + puff, 0, 7); g.fill();
      break;
    }
    case 'muralcreature': {
      // the sea creature with its mouth open, painted across the mural (spills over neighbouring tiles)
      g.fillStyle = '#2a4f86'; g.beginPath(); g.ellipse(dx + 16, dy + 22, 52, 18, 0, 0, 7); g.fill();
      g.fillStyle = '#3f74b8'; g.beginPath(); g.ellipse(dx + 10, dy + 18, 40, 12, 0, 0, 7); g.fill();
      g.fillStyle = '#e8c35a'; g.beginPath(); g.arc(dx - 18, dy + 14, 3, 0, 7); g.fill();
      g.fillStyle = '#132a4a'; g.beginPath(); g.moveTo(dx - 34, dy + 20); g.lineTo(dx - 52, dy + 10); g.lineTo(dx - 52, dy + 32); g.fill();
      g.fillStyle = '#c9ccd2'; for (let i = 0; i < 4; i++) g.fillRect(dx + 30 + i * 6, dy + 8 - i * 2, 3, 10);
      break;
    }
    case 'terminal': box(6, 4, 20, 26, '#565b66'); box(9, 7, 14, 9, (time >> 4) % 2 ? '#9fd8ff' : '#7fc0ef'); box(10, 20, 12, 3, '#1d6fb8'); break;
    case 'barrier': {
      box(2, 20, 4, 12, '#555'); box(26, 20, 4, 12, '#555');
      for (let i = 0; i < 8; i++) box(i * 4, 10, 4, 8, i % 2 ? '#26272c' : '#f2c33b');
      if ((time >> 3) % 2) { g.fillStyle = 'rgba(159,216,255,0.6)'; g.fillRect(dx, dy + 8, 32, 12); }
      break;
    }
    case 'hatch': box(2, 4, 28, 26, '#565b66'); box(4, 6, 24, 22, '#7d7f86'); box(13, 14, 6, 6, '#3b3f4a'); break;
    case 'valve': box(14, 14, 4, 18, '#7a4a2a');
      g.strokeStyle = '#d9473a'; g.lineWidth = 3; g.beginPath(); g.arc(dx + 16, dy + 12, 9, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(dx + 7, dy + 12); g.lineTo(dx + 25, dy + 12); g.moveTo(dx + 16, dy + 3); g.lineTo(dx + 16, dy + 21); g.stroke(); break;
    case 'pipe': box(0, 8, 32, 16, '#e8e6e0'); box(0, 8, 32, 4, '#b8b5ae'); box(10, 6, 12, 20, '#c8743a');
      g.fillStyle = '#1d6fb8'; g.font = 'bold 6px sans-serif'; g.fillText('VG', dx + 11, dy + 19); break;
    case 'buoy': {
      const bob = Math.sin(time / 12) * 2;
      g.fillStyle = '#d9473a'; g.beginPath(); g.arc(dx + 16, dy + 20 + bob, 10, 0, 7); g.fill();
      box(10, 18 + bob, 12, 4, '#f2efe6'); box(15, 4 + bob, 2, 10, '#26272c'); box(13, 2 + bob, 6, 4, '#f2c33b'); break;
    }
    case 'crane': box(4, 10, 24, 20, '#f2c33b'); box(7, 13, 18, 8, '#26272c'); box(9, 23, 4, 4, '#d9473a'); box(19, 23, 4, 4, '#4fae5b'); break;
    case 'container': box(0, 2, 32, 28, '#c8743a'); for (let i = 3; i < 32; i += 5) box(i, 2, 1, 28, 'rgba(0,0,0,0.25)'); break;
    case 'boom': {
      const bob = Math.sin(time / 15) * 1.5;
      box(1, 12 + bob, 30, 9, '#8a5a3a'); box(1, 12 + bob, 30, 2, '#a8754d'); box(4, 14 + bob, 3, 5, '#f2c33b'); box(25, 14 + bob, 3, 5, '#f2c33b'); break;
    }
    case 'mirror': box(14, 18, 4, 14, '#565b66'); box(4, 2, 24, 18, '#9aa3ad'); box(6, 4, 20, 14, (time >> 5) % 2 ? '#dfe8f2' : '#cfdbe8'); break;
    case 'lily':
      g.fillStyle = '#3f8f4a'; g.beginPath(); g.arc(dx + 16, dy + 16, 14, 0.35, Math.PI * 2 - 0.1); g.lineTo(dx + 16, dy + 16); g.fill();
      g.fillStyle = '#58ad62'; g.beginPath(); g.arc(dx + 14, dy + 14, 8, 0, 7); g.fill();
      g.fillStyle = '#f2a6c4'; g.beginPath(); g.arc(dx + 20, dy + 10, 4, 0, 7); g.fill();
      break;
    case 'locker':
      box(3, 2, 26, 28, '#c9ccd2'); box(5, 4, 22, 24, '#dfe2e7'); box(15, 4, 2, 24, '#a9adb5');
      for (let i = 0; i < 3; i++) { box(7, 7 + i * 3, 6, 1, '#8a8e96'); box(19, 7 + i * 3, 6, 1, '#8a8e96'); }
      box(12, 17, 2, 4, '#565b66'); box(18, 17, 2, 4, '#565b66'); break;
    case 'iceblock':
      box(1, 2, 30, 28, '#9fd0ea'); box(3, 4, 26, 24, '#bfe3f5'); box(6, 7, 8, 3, '#eaf7fd'); box(18, 18, 6, 2, '#eaf7fd');
      box(1, 28, 30, 2, '#7fb8d8'); break;
    case 'bush': {
      g.fillStyle = '#4f7f3a'; g.beginPath(); g.arc(dx + 16, dy + 18, 13, 0, 7); g.fill();
      g.fillStyle = '#6a9a48'; g.beginPath(); g.arc(dx + 11, dy + 14, 7, 0, 7); g.arc(dx + 21, dy + 15, 6, 0, 7); g.fill();
      g.fillStyle = '#f08a24'; for (const [bx, by] of [[9, 20], [14, 12], [20, 22], [23, 13], [16, 25], [11, 15]]) { g.beginPath(); g.arc(dx + bx, dy + by, 2, 0, 7); g.fill(); }
      break;
    }
    case 'ladder': box(8, 0, 3, 32, '#c9ccd2'); box(21, 0, 3, 32, '#c9ccd2'); for (let i = 3; i < 32; i += 7) box(8, i, 16, 2, '#c9ccd2'); break;
    case 'stove': {
      box(2, 6, 28, 24, '#3b3f4a'); box(4, 8, 24, 6, '#565b66');
      g.fillStyle = (time >> 3) % 2 ? '#ff8a5a' : '#ffb35a'; g.beginPath(); g.arc(dx + 10, dy + 11, 3, 0, 7); g.arc(dx + 22, dy + 11, 3, 0, 7); g.fill();
      const puff = (time >> 3) % 6; g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(dx + 16, dy + 3 - puff, 4 + puff, 0, 7); g.fill();
      break;
    }
    case 'speaker': box(6, 4, 20, 26, '#26272c'); g.fillStyle = (time >> 3) % 2 ? '#ff50aa' : '#50c8ff';
      g.beginPath(); g.arc(dx + 16, dy + 12, 5, 0, 7); g.arc(dx + 16, dy + 23, 4, 0, 7); g.fill(); break;
    case 'grave': box(8, 6, 16, 22, '#8e9196'); box(10, 8, 12, 18, '#a3a6ab'); box(6, 26, 20, 4, '#6f7277'); box(12, 12, 8, 1, '#7d8085'); box(12, 15, 6, 1, '#7d8085'); break;
    case 'ghostgrave': box(8, 6, 16, 22, '#7d8592'); box(10, 8, 12, 18, '#959dab'); box(6, 26, 20, 4, '#5e6570');
      g.fillStyle = `rgba(160,200,255,${0.25 + 0.2 * Math.sin(time / 15)})`; g.beginPath(); g.arc(dx + 16, dy + 4, 5, 0, 7); g.fill(); break;
    case 'monument': box(6, 2, 20, 26, '#b9b4a6'); box(8, 4, 16, 22, '#cfcabb'); box(4, 26, 24, 5, '#8f8a7c');
      for (let i = 0; i < 4; i++) box(10, 8 + i * 4, 12 - (i % 2) * 3, 1, '#8f8a7c'); break;
    case 'andersen': box(4, 2, 24, 26, '#6f6a60'); box(6, 4, 20, 22, '#8a8478'); box(2, 26, 28, 5, '#545049');
      g.fillStyle = '#d8c89a'; g.font = '6px monospace'; g.fillText('H.C.A.', dx + 7, dy + 14); break;
    case 'lantern': case 'lanternout': {
      box(15, 12, 2, 20, '#2b2b30'); box(9, 4, 14, 12, '#2b2b30'); box(11, 6, 10, 8, kind === 'lantern' ? '#ffd36b' : '#3d3f46');
      if (kind === 'lantern') { g.fillStyle = `rgba(255,211,107,${0.18 + 0.06 * Math.sin(time / 9)})`; g.beginPath(); g.arc(dx + 16, dy + 10, 14, 0, 7); g.fill(); }
      break;
    }
    case 'grate': box(2, 6, 28, 22, '#3b3f4a'); for (let i = 5; i < 28; i += 5) box(i, 8, 2, 18, '#1d1f24'); box(2, 6, 28, 2, '#565b66'); break;
    case 'mailbox': box(14, 16, 4, 16, '#565b66'); box(6, 4, 20, 14, '#d9473a'); box(9, 8, 14, 2, '#7a231d'); box(6, 4, 20, 2, '#e9705f'); break;
    case 'mirrorpool': {
      // A still pool that reflects what is really there: a pale arch shimmers in it.
      g.fillStyle = '#4b4643'; g.beginPath(); g.ellipse(dx + 16, dy + 18, 15, 11, 0, 0, 7); g.fill();
      g.fillStyle = '#1c2a38'; g.beginPath(); g.ellipse(dx + 16, dy + 18, 12, 8, 0, 0, 7); g.fill();
      g.strokeStyle = `rgba(200,225,255,${0.45 + 0.25 * Math.sin(time / 20)})`; g.lineWidth = 1.5;
      g.beginPath(); g.arc(dx + 16, dy + 21, 5, Math.PI, 0); g.stroke();
      break;
    }
    case 'fakewall': {
      box(0, 0, 32, 32, '#3d3936'); box(0, 26, 32, 6, '#57514c');
      g.fillStyle = `rgba(150,110,220,${0.08 + 0.06 * Math.sin(time / 25)})`; g.fillRect(dx, dy, 32, 26);
      break;
    }
    case 'wheel': box(14, 16, 4, 16, '#565b66');
      g.strokeStyle = '#b87333'; g.lineWidth = 3; g.beginPath(); g.arc(dx + 16, dy + 13, 10, 0, 7); g.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(dx + 16 - Math.cos(a) * 10, dy + 13 - Math.sin(a) * 10); g.lineTo(dx + 16 + Math.cos(a) * 10, dy + 13 + Math.sin(a) * 10); g.stroke(); }
      break;
    case 'flood': {
      // Deep water over a causeway; drawn like the 'u' tile so the walkway is hidden until the level drops.
      box(0, 0, 32, 32, '#26323a');
      g.fillStyle = '#3a4b55'; const o = ((time >> 2) + dx) % 32;
      g.fillRect(dx + Math.abs(o), dy + 9, 8, 1); g.fillRect(dx + (Math.abs(o) + 17) % 32, dy + 21, 6, 1);
      break;
    }
    case 'drone': {
      const bob = Math.sin(time / 8 + dx) * 2;
      box(6, 10 + bob, 20, 8, '#e8e6e0'); box(6, 10 + bob, 20, 2, '#b87333');
      box(2, 8 + bob, 8, 2, '#565b66'); box(22, 8 + bob, 8, 2, '#565b66');
      g.fillStyle = (time >> 4) % 2 ? '#ff5a4a' : '#9fd8ff'; g.beginPath(); g.arc(dx + 16, dy + 16 + bob, 2.5, 0, 7); g.fill();
      g.fillStyle = 'rgba(159,216,255,0.18)'; g.beginPath(); g.moveTo(dx + 16, dy + 18 + bob); g.lineTo(dx + 4, dy + 32); g.lineTo(dx + 28, dy + 32); g.fill();
      break;
    }
    case 'lectern': box(13, 16, 6, 16, '#6b4526'); box(4, 6, 24, 12, '#8a5a3a'); box(6, 4, 10, 10, '#efe3c2'); box(16, 4, 10, 10, '#e4d6b0');
      box(8, 7, 6, 1, '#8f7f5a'); box(8, 10, 5, 1, '#8f7f5a'); box(18, 7, 6, 1, '#8f7f5a'); box(18, 10, 5, 1, '#8f7f5a'); break;
    case 'schematic': box(2, 10, 28, 18, '#6b4526'); box(4, 4, 24, 16, '#1d3f6e');
      g.strokeStyle = '#9fd8ff'; g.lineWidth = 1; g.beginPath(); g.moveTo(dx + 7, dy + 16); g.lineTo(dx + 14, dy + 9); g.lineTo(dx + 20, dy + 14); g.lineTo(dx + 25, dy + 7); g.stroke();
      g.beginPath(); g.arc(dx + 14, dy + 9, 2, 0, 7); g.stroke(); break;
    case 'stairs': for (let i = 0; i < 4; i++) box(2 + i * 2, 4 + i * 7, 28 - i * 4, 6, i % 2 ? '#8e8a84' : '#a3a09a'); break;
    case 'brassring': {
      // Gym 5: a brass ring of the zodiac on a pedestal, with a pointer.
      box(13, 22, 6, 10, '#6b4526');
      g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.beginPath(); g.arc(dx + 16, dy + 13, 10, 0, 7); g.stroke();
      g.strokeStyle = '#8a6a28'; g.lineWidth = 1; g.beginPath(); g.arc(dx + 16, dy + 13, 6, 0, 7); g.stroke();
      const a = time / 60;
      g.strokeStyle = '#f2e6b8'; g.lineWidth = 2; g.beginPath(); g.moveTo(dx + 16, dy + 13); g.lineTo(dx + 16 + Math.cos(a) * 9, dy + 13 + Math.sin(a) * 9); g.stroke();
      break;
    }
    case 'orrerygate':
      box(0, 2, 32, 28, '#5a4630'); box(2, 4, 28, 24, '#3b2e20');
      g.strokeStyle = '#c9a24a'; g.lineWidth = 1; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(dx + 16, dy + 16, 4 + i * 4, 0, 7); g.stroke(); }
      g.fillStyle = '#e8c35a'; g.beginPath(); g.arc(dx + 16, dy + 16, 3, 0, 7); g.fill();
      g.fillStyle = '#9fd8ff'; g.beginPath(); g.arc(dx + 24, dy + 16, 2, 0, 7); g.fill();
      g.fillStyle = '#e07a2e'; g.beginPath(); g.arc(dx + 16, dy + 4.5, 2, 0, 7); g.fill();
      break;
    case 'lens': {
      g.fillStyle = 'rgba(180,220,255,0.75)'; g.beginPath(); g.ellipse(dx + 16, dy + 22, 9, 5, 0, 0, 7); g.fill();
      g.strokeStyle = '#c9a24a'; g.lineWidth = 2; g.beginPath(); g.ellipse(dx + 16, dy + 22, 9, 5, 0, 0, 7); g.stroke();
      if ((time >> 3) % 8 < 2) { g.fillStyle = '#fff'; g.fillRect(dx + 12, dy + 19, 3, 2); }
      break;
    }
    case 'starchart': box(14, 18, 4, 14, '#6b4526'); box(3, 3, 26, 18, '#1b2340');
      g.fillStyle = '#f2e6b8'; for (const [x, y] of [[7, 7], [10, 9], [13, 8], [16, 11], [21, 6], [24, 9], [19, 15], [9, 16]]) g.fillRect(dx + x, dy + y, 2, 2);
      g.strokeStyle = 'rgba(242,230,184,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(dx + 8, dy + 8); g.lineTo(dx + 11, dy + 10); g.lineTo(dx + 14, dy + 9); g.lineTo(dx + 17, dy + 12); g.stroke(); break;
    case 'telescope':
      box(10, 26, 12, 4, '#3b3f4a'); box(14, 16, 4, 10, '#565b66');
      g.save(); g.translate(dx + 16, dy + 16); g.rotate(-0.6); g.fillStyle = '#b87333'; g.fillRect(-14, -4, 28, 8); g.fillStyle = '#d9a066'; g.fillRect(-14, -4, 28, 2); g.fillStyle = '#26272c'; g.fillRect(12, -5, 4, 10); g.restore();
      break;
    case 'orrery': {
      box(6, 24, 20, 6, '#6b4526'); box(15, 14, 2, 10, '#8a6a28');
      g.fillStyle = '#e8c35a'; g.beginPath(); g.arc(dx + 16, dy + 12, 4, 0, 7); g.fill();
      g.strokeStyle = 'rgba(201,162,74,0.7)'; g.lineWidth = 1; g.beginPath(); g.ellipse(dx + 16, dy + 12, 12, 5, 0, 0, 7); g.stroke();
      const a = time / 40;
      g.fillStyle = '#5f8fc4'; g.beginPath(); g.arc(dx + 16 + Math.cos(a) * 12, dy + 12 + Math.sin(a) * 5, 2.5, 0, 7); g.fill();
      g.fillStyle = '#c9574b'; g.beginPath(); g.arc(dx + 16 + Math.cos(-a * 0.6) * 8, dy + 12 + Math.sin(-a * 0.6) * 3.3, 2, 0, 7); g.fill();
      break;
    }
    case 'mermaid':
      // The little statue on her rock (she really is small).
      g.fillStyle = '#6d6a66'; g.beginPath(); g.ellipse(dx + 16, dy + 26, 13, 6, 0, 0, 7); g.fill();
      box(13, 12, 7, 12, '#4f7d6a'); box(11, 20, 12, 4, '#4f7d6a');
      g.fillStyle = '#5f9580'; g.beginPath(); g.arc(dx + 17, dy + 9, 4, 0, 7); g.fill();
      if ((time >> 4) % 6 === 0) { g.fillStyle = 'rgba(159,216,255,0.7)'; g.beginPath(); g.arc(dx + 16, dy + 17, 2, 0, 7); g.fill(); }
      break;
    case 'train':
      box(0, 6, 32, 20, '#b8323a'); box(2, 9, 28, 7, '#dfe8f0'); box(0, 26, 32, 3, '#26272c');
      for (let i = 3; i < 30; i += 9) box(i, 10, 6, 5, '#5f8fc4');
      box(12, 18, 8, 8, '#8a2027'); break;
    case 'card': {
      // One of Pierrot's playing cards, a little harlequin diamond on it.
      g.save(); g.translate(dx + 16, dy + 20); g.rotate(-0.2 + Math.sin(time / 30) * 0.05);
      g.fillStyle = '#fbf7ee'; g.fillRect(-7, -9, 14, 18); g.strokeStyle = '#26272c'; g.lineWidth = 1; g.strokeRect(-7, -9, 14, 18);
      g.fillStyle = '#c9574b'; g.beginPath(); g.moveTo(0, -5); g.lineTo(4, 0); g.lineTo(0, 5); g.lineTo(-4, 0); g.fill();
      g.restore(); break;
    }
    case 'mirror':
      box(4, 1, 24, 30, '#c9a24a'); box(6, 3, 20, 26, '#b8d4e8');
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(dx + 8, dy + 26); g.lineTo(dx + 18, dy + 5); g.lineTo(dx + 22, dy + 5); g.lineTo(dx + 12, dy + 26); g.fill();
      break;
    case 'terminal':
      box(4, 4, 24, 26, '#3b3f4a'); box(7, 7, 18, 11, (time >> 4) % 2 ? '#1d6fb8' : '#2a7fcc');
      g.fillStyle = '#fff'; g.font = 'bold 6px sans-serif'; g.fillText('VG', dx + 12, dy + 15);
      for (let i = 0; i < 3; i++) box(8 + i * 6, 21, 4, 4, ['#c9574b', '#e8c35a', '#4fae5b'][i]); break;
    case 'scales': {
      // The merchants' brass scales: a beam on a post, two pans.
      box(15, 8, 2, 22, '#b08a3a'); box(8, 28, 16, 3, '#8a6a2a');
      box(3, 8, 26, 2, '#c9a24a');
      g.strokeStyle = '#8a6a2a'; g.lineWidth = 1; g.beginPath(); g.moveTo(dx + 5, dy + 10); g.lineTo(dx + 3, dy + 18); g.moveTo(dx + 5, dy + 10); g.lineTo(dx + 9, dy + 18);
      g.moveTo(dx + 27, dy + 10); g.lineTo(dx + 23, dy + 18); g.moveTo(dx + 27, dy + 10); g.lineTo(dx + 29, dy + 18); g.stroke();
      box(2, 18, 9, 2, '#c9a24a'); box(22, 18, 9, 2, '#c9a24a'); box(4, 15, 5, 3, '#565b66');
      break;
    }
    case 'photo':
      // The old photograph on the lighthouse wall: two sailors on a jetty, sepia.
      box(7, 6, 18, 16, '#6b4526'); box(9, 8, 14, 12, '#d8c39a'); box(9, 16, 14, 4, '#a68a5c');
      box(12, 10, 3, 6, '#5a4630'); box(17, 10, 3, 6, '#5a4630'); break;
    case 'logbook': box(6, 14, 20, 14, '#6b4526'); box(8, 10, 16, 8, '#7a2f2a'); box(9, 11, 14, 6, '#f2e6c8'); box(15, 11, 1, 6, '#7a2f2a'); break;
    case 'keyring': {
      g.strokeStyle = '#8a8d93'; g.lineWidth = 2; g.beginPath(); g.arc(dx + 16, dy + 12, 6, 0, 7); g.stroke();
      for (const [x, r] of [[10, 0.3], [16, 0], [22, -0.3]] as const) { g.save(); g.translate(dx + x, dy + 18); g.rotate(r); g.fillStyle = '#b08a3a'; g.fillRect(-1, 0, 3, 10); g.fillRect(-1, 7, 5, 2); g.restore(); }
      break;
    }
    case 'viewport': {
      // A thick window into the deep water below the fort. Something vast and grey is down there.
      box(0, 2, 32, 28, '#3b3f4a'); box(3, 5, 26, 22, '#0d2236');
      g.fillStyle = `rgba(80,140,190,${0.25 + 0.1 * Math.sin(time / 40)})`; g.fillRect(dx + 3, dy + 5, 26, 22);
      g.fillStyle = '#6f7880'; g.beginPath(); g.ellipse(dx + 16, dy + 24, 11, 6, 0, Math.PI, 0); g.fill();
      break;
    }
    default: box(8, 8, 16, 16, '#d0f');
  }
}

// ---------- buildings ----------

const brickWindows = (gate: boolean) => [0, 1].flatMap(r => [0, 1, 2, 3].filter(c => !(r === 1 && (c === 1 || (gate && c === 2))))
  .map(c => [10 + c * 30, 24 + r * 30, 10, 16] as [number, number, number, number]));
/** Window panes of the hand-drawn buildings, in pixels from the stamp's top-left, that light up at night. */
export const BUILDING_WINDOWS: Record<string, [number, number, number, number][]> = {
  brickBlock: brickWindows(false), brickGate: brickWindows(true),
  cafe: [[14, 36, 14, 18], [86, 36, 14, 18], [104, 36, 14, 18]],
  coldStores: [[14, 68, 16, 8], [46, 68, 16, 8], [162, 68, 16, 8], [194, 68, 16, 8]],
  roundTower: [[22, 40, 12, 18], [94, 40, 12, 18], [22, 80, 12, 18], [94, 80, 12, 18]],
  borsen: [[40, 60, 14, 20], [90, 60, 14, 20], [200, 60, 14, 20], [250, 60, 14, 20]],
  houseboat: [[36, 24, 16, 14], [140, 24, 16, 14]]
};

/** Draws a hand-drawn building into a canvas of its stamp size (w×h tiles). */
export function drawBuildingArt(g: G2, kind: string, w: number, h: number) {
  const W = w * 32, H = h * 32;
  if (kind === 'mural') {
    g.fillStyle = '#d8d2c4'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#9b958a'; g.fillRect(0, H - 4, W, 4);
    const waves = ['#1d4f8a', '#2a66a8', '#3f84c8', '#68a8dc'];
    waves.forEach((c, i) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) g.lineTo(x, 14 + i * 10 + Math.sin(x / 14 + i * 1.7) * 5);
      g.lineTo(W, H); g.fill();
    });
    g.fillStyle = '#f2efe6'; g.font = 'bold 9px sans-serif'; g.fillText('THE SOUND', 8, 12);
    return;
  }
  if (kind === 'roundTower') {
    g.fillStyle = '#9b4a36'; g.fillRect(8, 20, W - 16, H - 20);
    for (let y = 24; y < H; y += 8) { g.fillStyle = '#86402f'; g.fillRect(8, y, W - 16, 1); }
    g.fillStyle = '#6b6f75'; g.fillRect(4, 10, W - 8, 12);
    g.fillStyle = '#4a4e54'; g.fillRect(W / 2 - 14, 0, 28, 12);
    g.fillStyle = '#c9ccd2'; g.beginPath(); g.arc(W / 2, 4, 10, Math.PI, 0); g.fill();
    for (const [x, y] of [[22, 40], [W - 34, 40], [22, 80], [W - 34, 80]]) { g.fillStyle = '#f2e6c4'; g.fillRect(x, y, 12, 18); g.beginPath(); g.arc(x + 6, y, 6, Math.PI, 0); g.fill(); }
    g.fillStyle = '#3b2a22'; g.fillRect(36, H - 28, 24, 28); g.beginPath(); g.arc(48, H - 28, 12, Math.PI, 0); g.fill();
    return;
  }
  if (kind === 'cafe') {
    g.fillStyle = '#f2c33b'; g.fillRect(0, 22, W, H - 22);
    g.fillStyle = '#7a3a30'; g.beginPath(); g.moveTo(0, 26); g.lineTo(W / 2, 0); g.lineTo(W, 26); g.fill();
    for (const x of [14, 86, 104]) { g.fillStyle = '#fff3cc'; g.fillRect(x, 36, 14, 18); }
    g.fillStyle = '#2f6f4a'; g.fillRect(36, H - 34, 24, 34);
    g.fillStyle = '#d9473a'; g.fillRect(28, H - 42, 40, 8);
    g.fillStyle = '#fff'; g.font = 'bold 7px sans-serif'; g.fillText('CAFÉ', 38, H - 36);
    return;
  }
  if (kind === 'pyramid') {
    // The Cisterns' glass pyramid in Søndermarken, with the stair door in the middle.
    g.fillStyle = '#5b8a6a'; g.fillRect(0, H - 8, W, 8);
    g.fillStyle = '#a9d4e8'; g.beginPath(); g.moveTo(4, H - 6); g.lineTo(W / 2, 4); g.lineTo(W - 4, H - 6); g.fill();
    g.fillStyle = '#cfe9f5'; g.beginPath(); g.moveTo(W / 2, 4); g.lineTo(W - 4, H - 6); g.lineTo(W / 2 + 6, H - 6); g.fill();
    g.strokeStyle = '#6f7f88'; g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const y = 4 + i * (H - 10) / 4; g.beginPath(); g.moveTo(W / 2 - (y - 4) * (W / 2 - 4) / (H - 10), y); g.lineTo(W / 2 + (y - 4) * (W / 2 - 4) / (H - 10), y); g.stroke(); }
    g.fillStyle = '#26323a'; g.fillRect(W / 2 - 9, H - 26, 18, 20);
    return;
  }
  if (kind === 'kastellet') {
    // Kastellet's gate: a grass rampart with a brick gatehouse and the flag.
    g.fillStyle = '#4e9a55'; g.fillRect(0, 10, W, H - 10);
    g.fillStyle = '#3f7f47'; g.fillRect(0, 10, W, 4);
    g.fillStyle = '#b5523e'; g.fillRect(W / 2 - 26, 18, 52, H - 18);
    g.fillStyle = '#e8e2d6'; g.fillRect(W / 2 - 26, 18, 52, 4);
    g.fillStyle = '#2a1c16'; g.beginPath(); g.moveTo(W / 2 - 10, H); g.lineTo(W / 2 - 10, H - 18); g.arc(W / 2, H - 18, 10, Math.PI, 0); g.lineTo(W / 2 + 10, H); g.fill();
    g.fillStyle = '#6b4526'; g.fillRect(W / 2 - 1, 0, 2, 18);
    g.fillStyle = '#c8102e'; g.fillRect(W / 2 + 1, 1, 14, 9); g.fillStyle = '#fff'; g.fillRect(W / 2 + 5, 1, 2, 9); g.fillRect(W / 2 + 1, 5, 14, 2);
    return;
  }
  if (kind === 'substation') {
    g.fillStyle = '#8a8d93'; g.fillRect(2, 10, W - 4, H - 10);
    g.fillStyle = '#6c7076'; g.fillRect(2, 10, W - 4, 4);
    g.fillStyle = '#1d6fb8'; g.fillRect(10, 20, 30, 12); g.fillStyle = '#fff'; g.font = 'bold 8px sans-serif'; g.fillText('VG D-7', 12, 29);
    g.fillStyle = '#3b3f4a'; g.fillRect(W / 2 - 9, H - 26, 18, 26);
    g.strokeStyle = '#e8c35a'; g.lineWidth = 2; g.beginPath(); g.moveTo(W - 22, 18); g.lineTo(W - 28, 28); g.lineTo(W - 20, 28); g.lineTo(W - 26, 38); g.stroke();
    return;
  }
  if (kind === 'circus') {
    // Pierrot's tent: red and cream stripes, a pennant, the dark doorway.
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = i % 2 ? '#f2e6c8' : '#c9302c';
      g.beginPath(); g.moveTo(W / 2, 8); g.lineTo(i * W / stripes, H - 30); g.lineTo((i + 1) * W / stripes, H - 30); g.fill();
      g.fillRect(i * W / stripes, H - 30, W / stripes, 30);
    }
    g.fillStyle = '#e8c35a'; g.fillRect(0, H - 32, W, 4);
    g.fillStyle = '#6b4526'; g.fillRect(W / 2 - 1, 0, 2, 10); g.fillStyle = '#8e5bb5'; g.beginPath(); g.moveTo(W / 2 + 1, 0); g.lineTo(W / 2 + 14, 4); g.lineTo(W / 2 + 1, 8); g.fill();
    g.fillStyle = '#26172a'; g.fillRect(W / 2 - 12, H - 28, 24, 28);
    return;
  }
  if (kind === 'borsen') {
    // Børsen under restoration: the long red-brick exchange, Dutch gables, scaffolding, and the spire's burned stump.
    g.fillStyle = '#a5462f'; g.fillRect(0, 34, W, H - 34);
    g.fillStyle = '#8a3a27'; for (let y = 40; y < H; y += 8) g.fillRect(0, y, W, 1);
    for (let i = 0; i < 6; i++) { const x = 14 + i * 52; g.fillStyle = '#a5462f'; g.beginPath(); g.moveTo(x, 34); g.lineTo(x + 12, 14); g.lineTo(x + 24, 34); g.fill(); g.fillStyle = '#e8e2d6'; g.fillRect(x + 9, 24, 6, 8); }
    g.fillStyle = '#4f7a6a'; g.fillRect(0, 30, W, 6);                                   // the copper roof
    g.fillStyle = '#26272c'; g.fillRect(W / 2 - 6, 4, 12, 28);                           // the burned spire stump
    g.strokeStyle = '#c9ccd2'; g.lineWidth = 1;
    for (let x = 4; x < W; x += 16) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x, H); g.stroke(); }
    for (let y = 16; y < H; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (const x of [40, 90, 200, 250]) { g.fillStyle = '#f2e6c4'; g.fillRect(x, 60, 14, 20); }
    g.fillStyle = '#3b2a22'; g.fillRect(W / 2 - 12, H - 30, 24, 30);
    return;
  }
  if (kind === 'palace') {
    // Christiansborg: pale granite, rows of windows, a green copper roof and the tower.
    g.fillStyle = '#d8d2c4'; g.fillRect(0, 40, W, H - 40);
    g.fillStyle = '#4f7a6a'; g.fillRect(0, 28, W, 14);
    g.fillStyle = '#d8d2c4'; g.fillRect(W / 2 - 18, 6, 36, 34);
    g.fillStyle = '#4f7a6a'; g.beginPath(); g.moveTo(W / 2 - 22, 8); g.lineTo(W / 2, 0); g.lineTo(W / 2 + 22, 8); g.fill();
    g.fillStyle = '#e8c35a'; g.fillRect(W / 2 - 3, 0, 6, 4);
    for (let y = 52; y < H - 20; y += 26) for (let x = 12; x < W - 12; x += 22) { g.fillStyle = '#5f6b7a'; g.fillRect(x, y, 10, 16); }
    g.fillStyle = '#8f8a7c'; g.fillRect(0, H - 8, W, 8);
    return;
  }
  if (kind === 'lighthouse') {
    // Trekroner's lighthouse: white tower, red band, a dark lamp room.
    g.fillStyle = '#e8e6e0'; g.fillRect(20, 30, W - 40, H - 30);
    g.fillStyle = '#b8323a'; g.fillRect(20, 70, W - 40, 12);
    g.fillStyle = '#3b3f4a'; g.fillRect(16, 26, W - 32, 6);
    g.fillStyle = '#26323a'; g.fillRect(24, 8, W - 48, 18);
    g.fillStyle = '#565b66'; g.beginPath(); g.moveTo(20, 8); g.lineTo(W / 2, 0); g.lineTo(W - 20, 8); g.fill();
    g.fillStyle = '#3b2a22'; g.fillRect(W / 2 - 9, H - 24, 18, 24);
    return;
  }
  if (kind === 'bunker') {
    // The old gun battery: a grassed-over earth mound with a stone mouth and an iron door.
    g.fillStyle = '#4e7a55'; g.beginPath(); g.moveTo(0, H); g.lineTo(10, 14); g.lineTo(W - 10, 14); g.lineTo(W, H); g.fill();
    g.fillStyle = '#9b958a'; g.fillRect(W / 2 - 30, 30, 60, H - 30);
    g.fillStyle = '#4a4e54'; g.fillRect(W / 2 - 12, H - 30, 24, 30);
    g.fillStyle = '#6b6f75'; for (let y = H - 26; y < H; y += 6) g.fillRect(W / 2 - 12, y, 24, 1);
    return;
  }
  if (kind === 'fortgate') {
    // Vanguard's steel door set into the old brick of the inner fort.
    g.fillStyle = '#9b4a36'; g.fillRect(0, 6, W, H - 6);
    g.fillStyle = '#86402f'; for (let y = 12; y < H; y += 8) g.fillRect(0, y, W, 1);
    g.fillStyle = '#8a8d93'; g.fillRect(W / 2 - 18, 26, 36, H - 26);
    g.fillStyle = '#6c7076'; g.fillRect(W / 2 - 1, 26, 2, H - 26);
    g.fillStyle = '#1d6fb8'; g.fillRect(W / 2 - 40, 14, 30, 10); g.fillStyle = '#fff'; g.font = 'bold 7px sans-serif'; g.fillText('VANGUARD', W / 2 - 39, 22);
    g.fillStyle = '#d9473a'; g.fillRect(W / 2 + 22, 40, 6, 8);
    return;
  }
  if (kind === 'coldStores') {
    // Gym 3: one of Kødbyen's white-tiled cold stores. Flat roof with a frosted cooling unit, the steel loading
    // bay with its canopy, a frost-blue band and the gym's snowflake sign.
    g.fillStyle = '#5a5e66'; g.fillRect(0, 14, W, 8);
    g.fillStyle = '#8a8d93'; g.fillRect(W - 70, 0, 50, 16); g.fillStyle = '#c9ccd2'; for (let x = W - 66; x < W - 24; x += 6) g.fillRect(x, 3, 3, 10);
    g.fillStyle = '#f4f4f0'; g.fillRect(0, 22, W, H - 22);
    g.fillStyle = '#d8d8d2'; for (let y = 30; y < H; y += 8) g.fillRect(0, y, W, 1); for (let x = 0; x < W; x += 8) g.fillRect(x, 22, 1, H - 22);
    g.fillStyle = '#8fc3df'; g.fillRect(0, 52, W, 6);
    for (const x of [12, 44, 160, 192]) { g.fillStyle = '#3a4a5e'; g.fillRect(x, 66, 20, 22); g.fillStyle = '#b5d8ec'; g.fillRect(x + 2, 68, 16, 8); }
    g.fillStyle = '#6c7076'; g.fillRect(84, 88, 56, 6);                          // the canopy over the loading bay
    g.fillStyle = '#9aa0a6'; g.fillRect(88, 94, 48, H - 94);
    g.fillStyle = '#7d828a'; for (let y = 98; y < H; y += 6) g.fillRect(88, y, 48, 1);
    g.fillStyle = '#3b3f4a'; g.fillRect(100, H - 30, 24, 30);                   // the door (tile 3,4)
    g.fillStyle = '#1d4f8a'; g.fillRect(70, 26, 84, 20);
    g.fillStyle = '#f2efe6'; g.font = 'bold 9px sans-serif'; g.fillText('COLD STORES', 80, 40);
    g.strokeStyle = '#cfe8f5'; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(58 + Math.cos(a) * 7, 36 + Math.sin(a) * 7); g.lineTo(58 - Math.cos(a) * 7, 36 - Math.sin(a) * 7); g.stroke(); }
    return;
  }
  if (kind === 'brickBlock' || kind === 'brickGate') {
    // A Vesterbro block: four storeys of red brick, white sash windows, a slate roof, and either a stairwell
    // door or the arched gateway into the courtyard (iron gate, a tree behind it).
    g.fillStyle = '#4a4e54'; g.beginPath(); g.moveTo(0, 14); g.lineTo(8, 0); g.lineTo(W - 8, 0); g.lineTo(W, 14); g.fill();
    g.fillStyle = '#a5462f'; g.fillRect(0, 14, W, H - 14);
    g.fillStyle = 'rgba(60,20,12,0.35)';
    for (let y = 16; y < H; y += 4) { g.fillRect(0, y + 3, W, 1); for (let x = (y / 4) % 2 * 4; x < W; x += 8) g.fillRect(x, y, 1, 3); }
    g.fillStyle = '#e8e2d6'; g.fillRect(0, 14, W, 3);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      if (r === 1 && (c === 1 || (kind === 'brickGate' && c === 2))) continue;
      const x = 8 + c * 30, y = 22 + r * 30;
      g.fillStyle = '#f2efe6'; g.fillRect(x, y, 14, 20); g.fillStyle = '#3a4a5e'; g.fillRect(x + 2, y + 2, 10, 16); g.fillStyle = '#f2efe6'; g.fillRect(x + 2, y + 9, 10, 2);
    }
    if (kind === 'brickBlock') {
      g.fillStyle = '#e8e2d6'; g.fillRect(36, H - 34, 24, 4);
      g.fillStyle = '#2f4a3a'; g.fillRect(38, H - 30, 20, 30); g.fillStyle = '#e8c35a'; g.fillRect(53, H - 16, 2, 3);
    } else {
      g.fillStyle = '#e8e2d6'; g.beginPath(); g.arc(64, H - 22, 22, Math.PI, 0); g.fill(); g.fillRect(42, H - 22, 44, 22);
      g.fillStyle = '#6b8a5a'; g.beginPath(); g.arc(64, H - 22, 19, Math.PI, 0); g.fill(); g.fillRect(45, H - 22, 38, 22);
      g.fillStyle = '#3f6b47'; g.beginPath(); g.arc(70, H - 22, 9, 0, 7); g.fill();
      g.fillStyle = '#26272c'; for (let x = 46; x < 84; x += 5) g.fillRect(x, H - 36, 2, 36); g.fillRect(45, H - 20, 38, 2);
    }
    return;
  }
  if (kind === 'houseboat') {
    g.fillStyle = '#3a6fa8'; g.beginPath(); g.moveTo(0, 54); g.lineTo(W, 54); g.lineTo(W - 16, H); g.lineTo(16, H); g.fill();
    g.fillStyle = '#f2efe6'; g.fillRect(0, 52, W, 6);
    g.fillStyle = '#4fae5b'; g.fillRect(20, 14, W - 40, 40);
    g.fillStyle = '#8a5a3a'; g.fillRect(14, 8, W - 28, 8);
    g.fillStyle = '#c9ccd2'; g.fillRect(30, 2, 30, 6); g.fillRect(W - 60, 2, 30, 6);  // solar mirrors
    g.fillStyle = '#fff3cc'; g.fillRect(36, 24, 16, 14); g.fillRect(W - 52, 24, 16, 14);
    g.fillStyle = '#6b4526'; g.fillRect(68, 60, 24, 30);
    return;
  }
}
