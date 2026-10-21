// Hand-drawn placeholder art for the demo maps: city, indoor and tunnel tiles the Essentials
// tilesets don't have in a usable form, story objects (switches, valves, lily pads...) and a few
// buildings. Everything is plain canvas drawing, so Mark's own art can replace it piece by piece.
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

/** Draws one of the hand-drawn tiles. Returns false for tiles the caller draws from the tileset. */
export function drawTile(g: G2, t: string, x: number, y: number, dx: number, dy: number, tileAt: TileAt, time: number): boolean {
  switch (t) {
    case '_': floor(g, dx, dy, x, y); return true;
    case 'm':
      floor(g, dx, dy, x, y);
      g.fillStyle = '#9b3b33'; g.fillRect(dx + 2, dy + 8, 28, 18);
      g.fillStyle = '#c9574b'; g.fillRect(dx + 4, dy + 10, 24, 14);
      return true;
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
    default: box(8, 8, 16, 16, '#d0f');
  }
}

// ---------- buildings ----------

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
