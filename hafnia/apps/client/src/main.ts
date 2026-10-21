// Copper & Current client: rendering, input, audio and menus, ported from the browser POC.
// It holds no game rules. It sends intents to a game server (a Web Worker in solo play)
// and plays back the events that come back.
import type {
  BattleAction, BattleEvent, BattleMonView, BattleRequest, BattleSide, BattleStart, CoilMode, CoilView, DebugCommand, Dir,
  GameConnection, MapDef, MonView, MoveView, SaveSlot, ServerEvent, SlotInfo, Stamp, WorldView, Intent
} from '@hafnia/core';
import { ITEMS } from '@hafnia/core/src/items';
import hafniaManifest from '@hafnia/pack-hafnia/pack.json';
import { MAPS as HAFNIA_MAPS, STAMPS as HAFNIA_STAMPS } from '@hafnia/pack-hafnia/world';
import { connectSolo } from './connection';

// Render data for each installed content pack. A DLC pack adds an entry here.
const WORLDS: Record<string, { maps: Record<string, Omit<MapDef, 'npcs' | 'doors'>>; stamps: Record<string, Stamp>; manifest: typeof hafniaManifest }> = {
  hafnia: { maps: HAFNIA_MAPS, stamps: HAFNIA_STAMPS, manifest: hafniaManifest }
};
const BASE_PACK = 'hafnia';

const TILE = 32, VW = 512, VH = 384;
const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
const FONT = '"Pixelify Sans", "Courier New", monospace';
const ASSETS = 'game-assets';

const TYPE_COLORS: Record<string, string> = {
  normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', grass: '#7ac74c', flying: '#a98ff3', fairy: '#d685ad',
  dark: '#705746', psychic: '#f95587', ghost: '#735797', poison: '#a33ea1', electric: '#e3b81e', ice: '#96d9d6',
  fighting: '#c22e28', ground: '#e2bf65', rock: '#b6a136', bug: '#a6b91a', dragon: '#6f35fc', steel: '#b7b7ce'
};
const STATUS_COLORS: Record<string, [string, string]> = {
  brn: ['BRN', '#ee8130'], par: ['PAR', '#d8b21e'], psn: ['PSN', '#a33ea1'], tox: ['TOX', '#7d2a7b'], slp: ['SLP', '#8c8c8c'], frz: ['FRZ', '#66b8d6']
};
const COPPER = '#c8743a', PATINA = '#5fbf9a', CURRENT = '#9fd8ff';

// ---------- images ----------
type Img = HTMLImageElement & { box?: { bottom: number } };
const IMG: Record<string, Img> = {};
function image(key: string, url: string): Img {
  let im = IMG[key];
  if (!im) {
    im = IMG[key] = new Image() as Img;
    im.onload = () => { if (/^pokemon\/(front|back)\//.test(key)) im.box = contentBox(im); };
    im.src = url;
  }
  return im;
}
const packImg = (key: string, pack = BASE_PACK) => image(`${pack}/${key}`, `${ASSETS}/${pack}/${key}.png`);
const monImg = (kind: 'front' | 'back' | 'icons', key: string) => image(`pokemon/${kind}/${key}`, `${ASSETS}/pokemon/${kind}/${key}.png`);

function preload(onProgress: (p: number) => void): Promise<void> {
  const list: Img[] = [];
  for (const [id, w] of Object.entries(WORLDS)) {
    for (const k of Object.keys(w.manifest.images)) list.push(packImg(k, id));
    for (const sp of w.manifest.species) for (const kind of ['front', 'back', 'icons'] as const) list.push(monImg(kind, sp.toUpperCase()));
  }
  let done = 0;
  return Promise.all(list.map(im => new Promise<void>(res => {
    const finish = () => { done++; onProgress(done / list.length); res(); };
    if (im.complete && im.naturalWidth) return finish();
    im.addEventListener('load', finish, { once: true });
    im.addEventListener('error', finish, { once: true });
    setTimeout(finish, 15000);
  }))).then(() => undefined);
}

// Find the lowest opaque row of a sprite's first frame so sprites of any canvas size stand on the same line.
function contentBox(im: HTMLImageElement) {
  try {
    const fh = im.height, c = document.createElement('canvas'); c.width = fh; c.height = fh;
    const cx = c.getContext('2d')!; cx.drawImage(im, 0, 0, fh, fh, 0, 0, fh, fh);
    const d = cx.getImageData(0, 0, fh, fh).data;
    for (let y = fh - 1; y >= 0; y--) for (let x = 0; x < fh; x++) if (d[(y * fh + x) * 4 + 3] > 20) return { bottom: y };
  } catch { /* tainted canvas */ }
  return { bottom: im.height - 1 };
}

// ---------- audio ----------
const audioUrl = (name: string) => name.startsWith('cries/')
  ? `${ASSETS}/pokemon/${name}.ogg` : `${ASSETS}/${BASE_PACK}/audio/${name}.ogg`;
const Sound = {
  muted: false, bgmEl: null as HTMLAudioElement | null, bgmName: null as string | null, unlocked: false,
  vol: { bgm: 0.45, me: 0.6, se: 0.7 },
  bgm(name: string | null) {
    if (this.bgmName === name) return;
    this.bgmEl?.pause();
    this.bgmName = name;
    if (!name) { this.bgmEl = null; return; }
    const el = new Audio(audioUrl(name)); el.loop = true; el.volume = this.vol.bgm; el.muted = this.muted;
    this.bgmEl = el; if (this.unlocked) el.play().catch(() => {});
  },
  se(name: string, vol?: number) {
    if (this.muted || !this.unlocked) return;
    const el = new Audio(audioUrl(name)); el.volume = vol ?? this.vol.se; el.play().catch(() => {});
  },
  cry(key: string) { this.se('cries/' + key, 0.6); },
  me(name: string): Promise<void> { // jingle: pause bgm, resolve when done (max 6s)
    return new Promise(res => {
      if (this.muted || !this.unlocked) { setTimeout(res, 600); return; }
      this.bgmEl?.pause();
      const el = new Audio(audioUrl(name)); el.volume = this.vol.me;
      let finished = false;
      const end = () => { if (finished) return; finished = true; if (this.bgmEl && !this.muted) this.bgmEl.play().catch(() => {}); res(); };
      el.onended = end; el.onerror = end; setTimeout(end, 6000);
      el.play().catch(end);
    });
  },
  unlock() {
    if (this.unlocked) return; this.unlocked = true;
    if (this.bgmEl && !this.muted) this.bgmEl.play().catch(() => {});
  },
  setMuted(m: boolean) {
    this.muted = m;
    if (this.bgmEl) { this.bgmEl.muted = m; if (!m && this.unlocked) this.bgmEl.play().catch(() => {}); }
  }
};

// ---------- input ----------
type Key = Dir | 'A' | 'B' | 'MENU';
const input = { held: {} as Partial<Record<Key, boolean>>, queue: new Set<Key>(), pressed: new Set<Key>() };
const KEYMAP: Record<string, Key> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
  z: 'A', Z: 'A', ' ': 'A', Enter: 'A', x: 'B', X: 'B', Escape: 'B', Backspace: 'B', c: 'MENU', C: 'MENU', m: 'MENU', M: 'MENU'
};
// Overworld presses that land while a request is in flight are kept until the overworld can use them.
const sticky = new Set<Key>();
function press(k: Key) { if (!input.held[k]) { input.queue.add(k); sticky.add(k); } input.held[k] = true; Sound.unlock(); }
function release(k: Key) { input.held[k] = false; }
window.addEventListener('keydown', e => { const k = KEYMAP[e.key]; if (!k) return; e.preventDefault(); press(k); });
window.addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) release(k); });
window.addEventListener('blur', () => { for (const k in input.held) input.held[k as Key] = false; });
// On-screen buttons. Some app webviews drop pointer events, so a plain click also counts as a tap.
let lastPointer = 0;
function tapKey(k: Key) { press(k); setTimeout(() => release(k), 90); }
document.querySelectorAll<HTMLElement>('[data-key]').forEach(btn => {
  const k = btn.dataset.key as Key;
  btn.addEventListener('pointerdown', e => {
    e.preventDefault(); lastPointer = performance.now();
    try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    press(k); btn.classList.add('down');
  });
  const up = () => { release(k); btn.classList.remove('down'); };
  btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('lostpointercapture', up);
  btn.addEventListener('click', () => { if (performance.now() - lastPointer > 400) tapKey(k); });
  btn.addEventListener('contextmenu', e => e.preventDefault());
});
canvas.addEventListener('pointerdown', e => { e.preventDefault(); lastPointer = performance.now(); canvas.focus({ preventScroll: true }); tapKey('A'); });
canvas.addEventListener('click', () => { if (performance.now() - lastPointer > 400) { canvas.focus({ preventScroll: true }); tapKey('A'); } });
const just = (k: Key) => input.pressed.has(k);

// ---------- coroutine helpers ----------
let frameWaiters: (() => void)[] = [];
const nextFrame = () => new Promise<void>(r => frameWaiters.push(r));
async function wait(frames: number) { for (let i = 0; i < frames; i++) await nextFrame(); }
async function waitKey(...keys: Key[]): Promise<Key> { for (;;) { await nextFrame(); const k = keys.find(just); if (k) return k; } }

// ---------- client state (presentation only) ----------
interface Actor { id: string; sprite: string; x: number; y: number; dir: Dir; px: number; py: number; moving: boolean; step: number; anim: number; object?: boolean; exclaim?: boolean }
const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DIR_ROW: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };

const G = {
  scene: 'loading' as 'loading' | 'title' | 'intro' | 'overworld' | 'battle',
  t: 0, fade: 0, overlays: [] as (() => void)[], busy: false, lock: false, mapBanner: 0,
  mapKey: '', world: null as WorldView | null,
  player: { id: 'player', sprite: 'chars/player', x: 0, y: 0, dir: 'down', px: 0, py: 0, moving: false, step: 0, anim: 0 } as Actor,
  npcs: new Map<string, Actor>(),
  ui: { text: null as null | { full: string; shown: number; w?: number }, choice: null as null | { options: string[]; idx: number; rect?: { x: number; y: number; w: number } } }
};
let conn: GameConnection;

function mapOf(key: string) {
  const [pack, id] = key.split(':');
  const w = WORLDS[pack];
  return { map: w.maps[id], stamps: w.stamps, pack };
}
function tileAt(x: number, y: number): string | null {
  const m = mapOf(G.mapKey).map;
  return x < 0 || y < 0 || x >= m.w || y >= m.h ? null : m.grid[y][x];
}

// ---------- talking to the server ----------
async function send(intent: Intent) {
  const evs = await conn.send(intent);
  await play(evs);
}

/** Plays server events in order. Prompts and battle requests ask the player, send the answer and stop:
 *  the answer's own events (with a fresh view) supersede the rest of this batch. */
async function play(evs: ServerEvent[]) {
  for (const e of evs) {
    switch (e.t) {
      case 'view': applyView(e.view); break;
      case 'say': await say(e.text); break;
      case 'prompt': {
        G.ui.text = { full: e.text, shown: e.text.length };
        const i = await choose(e.options, e.cancel ?? -1);
        G.ui.text = null;
        return send({ t: 'answer', index: i });
      }
      case 'pickSpecies': return send({ t: 'answer', index: await pickSpecies(e.species) });
      case 'sfx': Sound.se(e.name); break;
      case 'me': await Sound.me(e.name); break;
      case 'bgm': Sound.bgm(e.name); break;
      case 'cry': Sound.cry(e.key); break;
      case 'face': actor(e.actor) && (actor(e.actor)!.dir = e.dir); break;
      case 'walk': { const a = actor(e.actor); if (a) await stepActor(a, e.dir, e.frames); break; }
      case 'place': placeNpc(e); break;
      case 'exclaim': { const a = actor(e.actor); if (a) { a.exclaim = true; await wait(40); a.exclaim = false; } break; }
      case 'map': await changeMap(e); break;
      case 'wait': await wait(e.frames); break;
      case 'fade': await fadeTo(e.to, e.frames ?? 14); break;
      case 'battleStart': await battleStart(e.battle); break;
      case 'battle': await battleEvent(e.ev); break;
      case 'battleRequest': return send({ t: 'battle', action: await battleMenu(e.request) });
      case 'battleEnd': await battleEnd(); break;
      case 'chapterEnd': await chapterEnd(e.title, e.subtitle); break;
      case 'evolve': await evolveScene(e); break;
      case 'error': console.error(e.message); await say(`Something went wrong: ${e.message}`); break;
      case 'checkpoint': case 'title': break;
    }
  }
}

function actor(id: string): Actor | undefined { return id === 'player' ? G.player : G.npcs.get(id); }

function applyView(v: WorldView) {
  G.world = v;
  if (v.map !== G.mapKey) return; // a map change event will follow
  if (!G.player.moving) Object.assign(G.player, { x: v.x, y: v.y, dir: v.dir });
  const next = new Map<string, Actor>();
  for (const n of v.npcs) {
    const old = G.npcs.get(n.id);
    next.set(n.id, old && !old.moving ? Object.assign(old, { x: n.x, y: n.y, dir: n.dir, sprite: n.sprite })
      : old ?? { ...n, px: 0, py: 0, moving: false, step: 0, anim: 0 });
  }
  G.npcs = next;
}

function placeNpc(e: Extract<ServerEvent, { t: 'place' }>) {
  if (e.hidden) { G.npcs.delete(e.actor); return; }
  const a = G.npcs.get(e.actor);
  if (a) Object.assign(a, { x: e.x, y: e.y, dir: e.dir });
  else G.npcs.set(e.actor, { id: e.actor, sprite: e.sprite ?? 'chars/kid', x: e.x, y: e.y, dir: e.dir, px: 0, py: 0, moving: false, step: 0, anim: 0 });
}

const WALK_FRAMES = 12;
async function stepActor(a: Actor, dir: Dir, frames = WALK_FRAMES) {
  a.dir = dir; a.moving = true;
  const [dx, dy] = DIRS[dir];
  for (let i = 1; i <= frames; i++) {
    a.px = dx * TILE * i / frames; a.py = dy * TILE * i / frames;
    a.anim = Math.floor((a.step * 2 + i * 4 / frames)) % 4;
    await nextFrame();
  }
  a.x += dx; a.y += dy; a.px = 0; a.py = 0; a.step++; a.moving = false;
}

async function changeMap(e: Extract<ServerEvent, { t: 'map' }>) {
  const first = G.scene !== 'overworld' && G.scene !== 'battle';
  if (G.mapKey) Sound.se('door', 0.3);
  await fadeTo(1, first ? 12 : 10);
  G.mapKey = e.map; G.npcs = new Map();
  if (G.world) applyView({ ...G.world, map: e.map, npcs: G.world.map === e.map ? G.world.npcs : [] });
  Object.assign(G.player, { x: e.x, y: e.y, dir: e.dir, px: 0, py: 0, moving: false });
  G.scene = 'overworld'; G.mapBanner = 120;
  Sound.bgm(e.bgm);
  await fadeTo(0, first ? 16 : 10);
}

// ---------- dialogue UI ----------
function wrapText(str: string, maxW: number, size: number) {
  ctx.font = `${size}px ${FONT}`;
  const out: string[] = [];
  for (const para of str.split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}
async function say(str: string) {
  G.ui.text = { full: str, shown: 0 };
  for (;;) {
    await nextFrame();
    const t = G.ui.text!;
    if (t.shown < t.full.length) {
      t.shown += 1.5;
      if (just('A') || just('B')) t.shown = t.full.length;
    } else if (just('A') || just('B')) { Sound.se('cursor', 0.4); break; }
  }
  G.ui.text = null;
}
async function choose(options: string[], cancelIdx = -1, rect?: { x: number; y: number; w: number }) {
  G.ui.choice = { options, idx: 0, rect };
  for (;;) {
    await nextFrame();
    const c = G.ui.choice!;
    if (just('up')) { c.idx = (c.idx + options.length - 1) % options.length; Sound.se('cursor'); }
    if (just('down')) { c.idx = (c.idx + 1) % options.length; Sound.se('cursor'); }
    if (just('A')) { Sound.se('select'); G.ui.choice = null; return c.idx; }
    if (just('B') && cancelIdx >= 0) { G.ui.choice = null; return cancelIdx; }
  }
}
async function ask(str: string, options: string[]) {
  G.ui.text = { full: str, shown: str.length };
  const r = await choose(options, options.length - 1);
  G.ui.text = null; return r;
}
async function fadeTo(target: number, frames = 14) {
  const start = G.fade;
  for (let i = 1; i <= frames; i++) { G.fade = start + (target - start) * i / frames; await nextFrame(); }
}

async function pickSpecies(opts: Extract<ServerEvent, { t: 'pickSpecies' }>['species']) {
  let idx = 0;
  const ov = () => {
    ctx.fillStyle = 'rgba(10,20,40,0.72)'; ctx.fillRect(0, 0, VW, VH);
    panel(32, 24, 448, 230);
    opts.forEach((sp, i) => {
      const cx = 96 + i * 160, cy = 150, sel = i === idx;
      if (sel) { ctx.fillStyle = '#ffe9a8'; roundRect(cx - 66, 40, 132, 168, 10); ctx.fill(); }
      drawMonSprite(sp.key, 'front', cx, cy + 14, sel ? 0.9 : 0.75, sel);
      text(sp.name, cx, 182, 18, '#1d2b45', 'center');
      sp.types.forEach((t, k, a) => typeChip(t, cx - (a.length * 36) + 36 + k * 72 - 30, 194));
    });
  };
  G.overlays.push(ov);
  try {
    for (;;) {
      G.ui.text = { full: opts[idx].blurb, shown: 999 };
      const k = await waitKey('left', 'right', 'A');
      if (k === 'left') { idx = (idx + opts.length - 1) % opts.length; Sound.se('cursor'); continue; }
      if (k === 'right') { idx = (idx + 1) % opts.length; Sound.se('cursor'); continue; }
      Sound.se('select');
      return idx;
    }
  } finally { G.overlays.pop(); G.ui.text = null; }
}

async function evolveScene(e: Extract<ServerEvent, { t: 'evolve' }>) {
  let showTo = false, white = 0;
  const ov = () => {
    ctx.fillStyle = '#0e2148'; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2 + G.t / 40; ctx.fillStyle = 'rgba(159,216,255,0.25)'; ctx.fillRect(VW / 2 + Math.cos(a) * 150, 160 + Math.sin(a) * 110, 4, 4); }
    drawMonSprite(showTo ? e.to : e.from, 'front', VW / 2, 250, 1.1, true, white ? { tint: '#ffffff' } : {});
    if (white > 0.5) { ctx.fillStyle = `rgba(255,255,255,${white - 0.5})`; ctx.fillRect(0, 0, VW, VH); }
  };
  G.overlays.push(ov);
  try {
    Sound.cry(e.from);
    await wait(50);
    for (let k = 0; k < 10; k++) { showTo = k % 2 === 1; white = 0.4; await wait(Math.max(4, 16 - k)); }
    white = 1; await wait(20); showTo = true; white = 0; Sound.cry(e.to);
    await wait(40);
  } finally { G.overlays.pop(); }
}

async function chapterEnd(title: string, subtitle: string) {
  await fadeTo(1);
  let alpha = 0;
  const ov = () => {
    ctx.fillStyle = '#0b1830'; ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = Math.min(1, alpha);
    text(title, VW / 2, 130, 40, '#ffd36b', 'center');
    text(subtitle, VW / 2, 178, 22, '#e8eefc', 'center');
    text('To be continued...', VW / 2, 220, 18, '#9fb3d9', 'center');
    text('Press A to keep exploring', VW / 2, 300, 14, '#9fb3d9', 'center');
    ctx.globalAlpha = 1;
  };
  G.overlays.push(ov); G.fade = 0;
  for (let i = 0; i < 60; i++) { alpha = i / 40; await nextFrame(); }
  await waitKey('A', 'B');
  G.overlays.pop();
}

// ---------- drawing helpers ----------
function roundRect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function panel(x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#1d2b45'; roundRect(x, y, w, h, 10); ctx.fill();
  ctx.fillStyle = '#fbf7ee'; roundRect(x + 4, y + 4, w - 8, h - 8, 7); ctx.fill();
  ctx.strokeStyle = '#d9473a'; ctx.lineWidth = 2; roundRect(x + 8, y + 8, w - 16, h - 16, 5); ctx.stroke();
}
function text(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function typeChip(t: string, x: number, y: number) {
  ctx.fillStyle = TYPE_COLORS[t] ?? '#777'; roundRect(x, y, 60, 18, 9); ctx.fill();
  text(t.toUpperCase(), x + 30, y + 14, 11, '#fff', 'center');
}
function statusChip(s: string, x: number, y: number) {
  const st = STATUS_COLORS[s]; if (!st) return;
  ctx.fillStyle = st[1]; roundRect(x, y, 36, 14, 7); ctx.fill();
  text(st[0], x + 18, y + 11, 10, '#fff', 'center');
}
function drawTextbox() {
  const t = G.ui.text; if (!t) return;
  const x = 8, y = VH - 104, w = t.w ?? VW - 16, h = 96;
  panel(x, y, w, h);
  const lines = wrapText(t.full, w - 44, 17);
  let remain = Math.floor(t.shown);
  lines.slice(0, 3).forEach((ln, i) => {
    const part = ln.slice(0, Math.max(0, remain)); remain -= ln.length + 1;
    text(part, x + 22, y + 32 + i * 24, 17, '#26324a');
  });
  if (t.shown >= t.full.length && !G.ui.choice && Math.floor(G.t / 20) % 2 === 0) {
    ctx.fillStyle = '#d9473a'; ctx.beginPath();
    ctx.moveTo(x + w - 30, y + h - 26); ctx.lineTo(x + w - 18, y + h - 26); ctx.lineTo(x + w - 24, y + h - 18); ctx.fill();
  }
}
const CHOICE_ROWS = 8; // longer lists (the Mart) scroll
function drawChoice() {
  const c = G.ui.choice; if (!c) return;
  const w = c.rect?.w ?? Math.min(VW - 16, Math.max(120, ...c.options.map(o => o.length * 11 + 56)));
  const rows = Math.min(CHOICE_ROWS, c.options.length);
  const first = Math.max(0, Math.min(c.idx - Math.floor(rows / 2), c.options.length - rows));
  const h = rows * 30 + 22;
  const x = c.rect?.x ?? VW - w - 8, y = c.rect?.y ?? Math.max(4, VH - 108 - h);
  panel(x, y, w, h);
  for (let r = 0; r < rows; r++) {
    const i = first + r;
    text(c.options[i], x + 36, y + 32 + r * 30, 18, '#26324a');
    if (i === c.idx) { ctx.fillStyle = '#d9473a'; ctx.beginPath(); ctx.moveTo(x + 18, y + 19 + r * 30); ctx.lineTo(x + 28, y + 25 + r * 30); ctx.lineTo(x + 18, y + 31 + r * 30); ctx.fill(); }
  }
  ctx.fillStyle = '#d9473a';
  if (first > 0) { ctx.beginPath(); ctx.moveTo(x + w - 24, y + 18); ctx.lineTo(x + w - 18, y + 10); ctx.lineTo(x + w - 12, y + 18); ctx.fill(); }
  if (first + rows < c.options.length) { ctx.beginPath(); ctx.moveTo(x + w - 24, y + h - 18); ctx.lineTo(x + w - 18, y + h - 10); ctx.lineTo(x + w - 12, y + h - 18); ctx.fill(); }
}

// Pokemon sprites are horizontal strips of square frames.
type SpriteFx = { shrink?: number; flash?: boolean; dy?: number; tint?: string; glitch?: number };
const tintCanvas = document.createElement('canvas');
function drawMonSprite(key: string, side: 'front' | 'back', cx: number, bottom: number, scaleMul = 1, animate = true, opts: SpriteFx = {}) {
  const im = monImg(side, key); if (!im.complete || !im.naturalWidth) return;
  const fh = im.height, frames = Math.max(1, Math.floor(im.width / fh));
  const f = animate ? Math.floor(G.t / 2) % frames : 0;
  const scale = 2 * scaleMul * (opts.shrink ?? 1);
  const w = fh * scale, foot = ((im.box?.bottom ?? fh - 1) + 1) * scale;
  if (opts.flash) ctx.globalAlpha = 0.4;
  const dx = Math.round(cx - w / 2), dy = Math.round(bottom - foot + (opts.dy || 0));
  if (opts.tint || opts.glitch) {
    // Copper patina / Overcharge: tint the sprite's own pixels on a scratch canvas.
    tintCanvas.width = w; tintCanvas.height = w;
    const g = tintCanvas.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(im, f * fh, 0, fh, fh, 0, 0, w, w);
    g.globalCompositeOperation = 'source-atop';
    if (opts.tint) { g.globalAlpha = 0.38; g.fillStyle = opts.tint; g.fillRect(0, 0, w, w); }
    if (opts.glitch) { g.globalAlpha = 0.5; g.fillStyle = Math.floor(G.t / 3) % 2 ? '#ffffff' : COPPER; for (let y = 0; y < w; y += 8) if ((y + G.t) % 24 < 8) g.fillRect(0, y, w, 4); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const jit = opts.glitch ? (Math.floor(G.t / 2) % 3 - 1) * 3 : 0;
    ctx.drawImage(tintCanvas, dx + jit, dy);
  } else ctx.drawImage(im, f * fh, 0, fh, fh, dx, dy, w, w);
  ctx.globalAlpha = 1;
}

// ---------- overworld rendering ----------
const AUTO: Record<string, string> = { '=': 'brick', '~': 'sea', 'o': 'still' };
function hash(x: number, y: number) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }
function drawOutsideTile(sx: number, sy: number, dx: number, dy: number) { ctx.drawImage(packImg('outside'), sx * 32, sy * 32, 32, 32, dx, dy, 32, 32); }
function drawGrass(dx: number, dy: number, x: number, y: number) { drawOutsideTile(1 + hash(x, y) % 5, 0, dx, dy); }
// Trees are two tiles wide: pair halves from the start of each horizontal run so no half-tree is cut off next to open ground.
function treeHalf(x: number, y: number) {
  const isT = (i: number) => { const t = tileAt(i, y); return t === null || t === 'T'; };
  if (!isT(x + 1)) return 1;
  let s = x; while (s > 0 && isT(s - 1)) s--;
  return s === 0 ? x & 1 : (x - s) & 1;
}
function drawAuto(ch: string, x: number, y: number, dx: number, dy: number) {
  const im = packImg(AUTO[ch]);
  if (!im.naturalWidth) return;
  const frames = Math.max(1, Math.floor(im.width / 96));
  const fx = (Math.floor(G.t / 16) % frames) * 96;
  const same = (ox: number, oy: number) => { const t = tileAt(x + ox, y + oy); return t === null || t === ch; };
  const u = same(0, -1), d = same(0, 1), l = same(-1, 0), r = same(1, 0);
  const q: (number[] | null)[] = [
    u && l ? (same(-1, -1) ? [32, 64] : [64, 0]) : u ? [0, 64] : l ? [32, 32] : [0, 32],
    u && r ? (same(1, -1) ? [48, 64] : [80, 0]) : u ? [80, 64] : r ? [48, 32] : [80, 32],
    d && l ? (same(-1, 1) ? [32, 80] : [64, 16]) : d ? [0, 80] : l ? [32, 112] : [0, 112],
    d && r ? (same(1, 1) ? [48, 80] : [80, 16]) : d ? [80, 80] : r ? [48, 112] : [80, 112]
  ];
  const off = [[0, 0], [16, 0], [0, 16], [16, 16]];
  if (ch === 'o') { // the pond autotile has no bottom bank, so mirror the top bank for the lower quarters
    const dl = same(-1, 1), dr = same(1, 1);
    for (const [i, side, diag] of [[2, l, dl], [3, r, dr]] as [number, boolean, boolean][]) {
      if (d && side && diag) continue;
      const top = i === 2 ? (d && l ? [64, 0] : d ? [0, 64] : l ? [32, 32] : [0, 32]) : (d && r ? [80, 0] : d ? [80, 64] : r ? [48, 32] : [80, 32]);
      if (d && !side) { q[i] = top; continue; }
      ctx.save(); ctx.translate(dx + off[i][0], dy + off[i][1] + 16); ctx.scale(1, -1);
      ctx.drawImage(im, fx + top[0], top[1], 16, 16, 0, 0, 16, 16); ctx.restore();
      q[i] = null;
    }
  }
  q.forEach((c, i) => c && ctx.drawImage(im, fx + c[0], c[1], 16, 16, dx + off[i][0], dy + off[i][1], 16, 16));
}
// Superkilen: Den Røde Plads (red rubber surface) and Den Sorte Plads (black with white wave stripes).
function drawSquareTile(t: string, x: number, y: number, dx: number, dy: number) {
  if (t === 'r') {
    ctx.fillStyle = '#c8473d'; ctx.fillRect(dx, dy, 32, 32);
    ctx.fillStyle = '#b13a32';
    for (let i = 0; i < 6; i++) { const h = hash(x * 7 + i, y * 13 - i); ctx.fillRect(dx + h % 30, dy + (h >>> 5) % 30, 2, 2); }
    if (tileAt(x, y - 1) !== 'r') { ctx.fillStyle = '#e8e2d6'; ctx.fillRect(dx, dy, 32, 2); }
  } else {
    ctx.fillStyle = '#26272c'; ctx.fillRect(dx, dy, 32, 32);
    ctx.fillStyle = '#f2efe6';
    for (let px = 0; px < 32; px += 2) {
      const wx = x * 32 + px, base = Math.sin(wx / 26) * 5;
      for (let k = 0; k < 2; k++) { const yy = ((k * 16 + base + 64) % 32); ctx.fillRect(dx + px, dy + yy, 2, 2); }
    }
  }
}
// Hand-drawn buildings that the tileset has no match for, cached as one bitmap each.
const BUILDING_CACHE: Record<string, HTMLCanvasElement> = {};
function customBuilding(kind: string) {
  if (BUILDING_CACHE[kind]) return BUILDING_CACHE[kind];
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  if (kind === 'palmHouse') drawPalmHouse(g);
  return (BUILDING_CACHE[kind] = c);
}
// The Palm House (1874): white iron-and-glass greenhouse, tall domed centre and two curved wings, palms inside.
function drawPalmHouse(g: CanvasRenderingContext2D) {
  const FRAME = '#f3f1e8', LINE = '#4b5a6b', GLASS = '#a9dce0', GLASS2 = '#86c6cf', PALM = '#4e9a55', PALM2 = '#2f6f3c';
  const glassBody = (x: number, y: number, w: number, h: number) => {
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, GLASS); gr.addColorStop(1, GLASS2);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  };
  const palm = (x: number, base: number, h: number) => {
    g.fillStyle = '#7a5a3a'; g.fillRect(x - 1, base - h, 3, h);
    g.fillStyle = PALM2; for (const [dx, dy] of [[-9, 2], [9, 2], [-6, -2], [6, -2], [0, -4]]) g.fillRect(x + dx - 5, base - h + dy, 11, 4);
    g.fillStyle = PALM; for (const [dx, dy] of [[-8, 0], [8, 0], [-4, -3], [4, -3]]) g.fillRect(x + dx - 4, base - h + dy, 9, 3);
  };
  const ribs = (x: number, y: number, w: number, h: number, step: number) => {
    g.fillStyle = FRAME;
    for (let i = x; i <= x + w; i += step) g.fillRect(i, y, 2, h);
    for (let j = y + h - 2; j >= y; j -= 14) g.fillRect(x, j, w + 2, 2);
  };
  // stone plinth
  g.fillStyle = '#cfc6b4'; g.fillRect(4, 112, 248, 14); g.fillStyle = '#a89f8c'; g.fillRect(4, 124, 248, 3); g.fillRect(4, 112, 248, 2);
  // wings: barrel-vaulted roofs over glass walls
  for (const [x, w] of [[8, 76], [172, 76]]) {
    g.fillStyle = LINE; g.beginPath(); g.moveTo(x - 2, 64); g.quadraticCurveTo(x + w / 2, 30, x + w + 2, 64); g.lineTo(x + w + 2, 113); g.lineTo(x - 2, 113); g.fill();
    g.save(); g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + w / 2, 33, x + w, 64); g.lineTo(x + w, 112); g.lineTo(x, 112); g.clip();
    glassBody(x, 36, w, 76); palm(x + 20, 112, 30); palm(x + 54, 112, 36); ribs(x, 36, w, 76, 12);
    g.restore();
    g.fillStyle = FRAME; g.fillRect(x - 2, 62, w + 4, 3);
  }
  // centre: tall walls and a dome with a lantern on top
  const cx = 128;
  g.fillStyle = LINE; g.fillRect(78, 46, 100, 67);
  g.beginPath(); g.ellipse(cx, 48, 52, 42, 0, Math.PI, 0); g.fill();
  g.save(); g.beginPath(); g.rect(80, 46, 96, 66); g.ellipse(cx, 48, 50, 40, 0, Math.PI, 0); g.clip();
  glassBody(80, 6, 96, 106); palm(100, 112, 54); palm(152, 112, 48); palm(cx, 112, 70);
  g.fillStyle = FRAME;
  for (let a = 0; a <= 8; a++) { const t = Math.PI + a * Math.PI / 8;
    g.beginPath(); g.moveTo(cx, 48); g.lineTo(cx + Math.cos(t) * 52, 48 + Math.sin(t) * 42); g.lineWidth = 2; g.strokeStyle = FRAME; g.stroke(); }
  for (const r of [0.45, 0.75]) { g.beginPath(); g.ellipse(cx, 48, 50 * r, 40 * r, 0, Math.PI, 0); g.lineWidth = 2; g.strokeStyle = FRAME; g.stroke(); }
  ribs(80, 46, 96, 66, 12);
  g.restore();
  g.fillStyle = FRAME; g.fillRect(76, 44, 104, 4);
  g.fillStyle = LINE; g.fillRect(cx - 7, 0, 14, 10); g.fillStyle = FRAME; g.fillRect(cx - 5, 2, 10, 7); g.fillStyle = LINE; g.fillRect(cx - 1, 0, 2, 3);
  // double doors under a small pediment
  g.fillStyle = LINE; g.fillRect(cx - 17, 82, 34, 31);
  g.fillStyle = '#2f6f4a'; g.fillRect(cx - 15, 86, 14, 27); g.fillRect(cx + 1, 86, 14, 27);
  g.fillStyle = GLASS; g.fillRect(cx - 12, 89, 8, 12); g.fillRect(cx + 4, 89, 8, 12);
  g.fillStyle = '#e8c35a'; g.fillRect(cx - 4, 100, 2, 3); g.fillRect(cx + 2, 100, 2, 3);
  g.fillStyle = FRAME; g.beginPath(); g.moveTo(cx - 20, 83); g.lineTo(cx, 72); g.lineTo(cx + 20, 83); g.fill();
  g.strokeStyle = LINE; g.lineWidth = 1; g.stroke();
}
function camera(): [number, number] {
  const p = G.player, m = mapOf(G.mapKey).map;
  const px = p.x * TILE + p.px, py = p.y * TILE + p.py;
  let cx = px + 16 - VW / 2, cy = py + 16 - VH / 2;
  cx = m.w * TILE <= VW ? (m.w * TILE - VW) / 2 : Math.max(0, Math.min(cx, m.w * TILE - VW));
  cy = m.h * TILE <= VH ? (m.h * TILE - VH) / 2 : Math.max(0, Math.min(cy, m.h * TILE - VH));
  return [Math.round(cx), Math.round(cy)];
}
function drawChar(sprite: string, x: number, y: number, dir: Dir, frame: number, cx: number, cy: number) {
  const im = packImg(sprite); if (!im.complete || !im.naturalWidth) return;
  const fw = im.width / 4, fh = im.height / 4;
  ctx.drawImage(im, frame * fw, DIR_ROW[dir] * fh, fw, fh, Math.round(x + 16 - fw / 2 - cx), Math.round(y + 32 - fh - cy + 2), fw, fh);
}
function drawOverworld() {
  const { map: m, stamps } = mapOf(G.mapKey), [cx, cy] = camera();
  ctx.fillStyle = '#2f6b3a'; ctx.fillRect(0, 0, VW, VH);
  const x0 = Math.floor(cx / TILE) - 1, y0 = Math.floor(cy / TILE) - 1;
  for (let y = y0; y < y0 + 14; y++) for (let x = x0; x < x0 + 18; x++) {
    const t = tileAt(x, y); if (t === null) continue;
    const dx = x * TILE - cx, dy = y * TILE - cy;
    drawGrass(dx, dy, x, y);
    if (AUTO[t]) drawAuto(t, x, y, dx, dy);
    else if (t === 'g') drawOutsideTile(6, 0, dx, dy);
    else if (t === 'f') ctx.drawImage(packImg('flowers'), (Math.floor(G.t / 14) % 5) * 32, 0, 32, 32, dx, dy, 32, 32);
    else if (t === 'r' || t === 'k') drawSquareTile(t, x, y, dx, dy);
    else if (t === 'T') { // forest rows cycle body, trunk, next crown from the top of each run
      let k = 0; while (k < 6 && tileAt(x, y - k - 1) === 'T') k++;
      drawOutsideTile(treeHalf(x, y), [53, 54, 52][k % 3], dx, dy);
    }
  }
  for (const b of m.buildings) {
    const st = stamps[b.s];
    if (st.draw) { ctx.drawImage(customBuilding(st.draw), b.x * TILE - cx, b.y * TILE - cy); continue; }
    for (const [sx, sy, w, h, ox, oy] of st.parts ?? [])
      ctx.drawImage(packImg('outside'), sx * 32, sy * 32, w * 32, h * 32, (b.x + ox) * TILE - cx, (b.y + oy) * TILE - cy, w * 32, h * 32);
  }
  const p = G.player;
  const actors = [...G.npcs.values()].map(n => ({ y: n.y * TILE + n.py, draw: () => {
    if (n.object) ctx.drawImage(packImg('chars/ball'), 0, 0, 32, 32, n.x * TILE - cx, n.y * TILE - cy, 32, 32);
    else drawChar(n.sprite, n.x * TILE + n.px, n.y * TILE + n.py, n.dir, n.moving ? n.anim : 0, cx, cy);
    if (n.exclaim) bubble(n.x * TILE + n.px - cx + 16, n.y * TILE + n.py - cy - 26);
  } }));
  actors.push({ y: p.y * TILE + p.py, draw: () => {
    drawChar('chars/player', p.x * TILE + p.px, p.y * TILE + p.py, p.dir, p.moving ? p.anim : 0, cx, cy);
    if (tileAt(p.x, p.y) === 'g' && !p.moving) // grass covers the feet
      ctx.drawImage(packImg('outside'), 6 * 32, 18, 32, 14, p.x * TILE - cx, p.y * TILE - cy + 18, 32, 14);
  } });
  actors.sort((a, b) => a.y - b.y).forEach(a => a.draw());
  if (G.mapBanner > 0) {
    const a = Math.min(1, G.mapBanner / 20);
    ctx.globalAlpha = a; panel(8, 8, Math.max(180, m.name.length * 11 + 40), 46); text(m.name, 28, 39, 18, '#26324a'); ctx.globalAlpha = 1;
    G.mapBanner--;
  }
}
function bubble(x: number, y: number) {
  ctx.fillStyle = '#fff'; roundRect(x - 10, y - 14, 20, 24, 6); ctx.fill();
  ctx.strokeStyle = '#1d2b45'; ctx.lineWidth = 2; ctx.stroke();
  text('!', x, y + 5, 18, '#d9473a', 'center');
}

// ---------- overworld input ----------
let turnDelay = 0;
async function overworldTick() {
  const p = G.player;
  const menu = sticky.has('MENU'), a = sticky.has('A');
  // A quick tap shorter than a frame still turns the player.
  const tapped = (['up', 'down', 'left', 'right'] as Dir[]).find(d => sticky.has(d));
  sticky.clear();
  if (menu) { await startMenu(); return; }
  if (a) { await send({ t: 'interact' }); return; }
  const dir = (['up', 'down', 'left', 'right'] as Dir[]).find(d => input.held[d]);
  if (!dir) {
    turnDelay = 0;
    if (tapped && tapped !== p.dir) { p.dir = tapped; conn.send({ t: 'turn', dir: tapped }); }
    return;
  }
  if (p.dir !== dir && turnDelay === 0) { p.dir = dir; turnDelay = 5; conn.send({ t: 'turn', dir }); return; }
  if (turnDelay > 1) { turnDelay--; return; }
  p.dir = dir;
  await send({ t: 'step', dir });
}

const slotName = (s: SaveSlot) => (s === 'auto' ? 'Autosave' : `Slot ${s}`);
async function pickSlot(slots: SlotInfo[], forSaving: boolean): Promise<SaveSlot | null> {
  const list = forSaving ? slots.filter(s => s.slot !== 'auto') : slots.filter(s => s.summary);
  const opts = list.map(s => `${slotName(s.slot)}: ${s.summary ?? 'empty'}`);
  const c = await choose([...opts, 'Back'], opts.length, { x: 8, y: 8, w: VW - 16 });
  return c < list.length ? list[c].slot : null;
}

async function startMenu() {
  Sound.se('menu');
  for (;;) {
    const w = G.world;
    const items = ['Pokémon', 'Bag', 'Save', ...(w?.debug ? ['Debug'] : []), 'Close'];
    const ov = () => { if (w) { panel(8, 8, 200, 58); text(`${w.money} kr.`, 28, 34, 16, '#26324a'); text(`Badges: ${w.badges}`, 28, 54, 14, '#55617a'); } };
    G.overlays.push(ov);
    let c: number;
    try { c = await choose(items, items.length - 1, { x: VW - 168, y: 8, w: 160 }); } finally { G.overlays.pop(); }
    const pick = items[c];
    if (pick === 'Save') {
      const r = await conn.send({ t: 'slots' });
      const slots = r.find(e => e.t === 'slots');
      if (!slots || slots.t !== 'slots') continue;
      const slot = await pickSlot(slots.slots, true);
      if (slot !== null) await send({ t: 'save', slot });
      continue;
    }
    if (pick === 'Debug') { await debugMenu(); continue; }
    if (pick === 'Close') return;
    if (pick === 'Pokémon') c = 0; else if (pick === 'Bag') c = 1;
    if (c === 0) {
      const i = await partyScreen('view', G.world?.party ?? []);
      if (i > 0) {
        const m = G.world!.party[i];
        if (await ask(`Move ${m.name} to the front?`, ['Yes', 'No']) === 0) await send({ t: 'lead', uid: m.uid });
      }
    } else if (c === 1) {
      const r = await bagMenu(G.world?.bag ?? {}, G.world?.party ?? [], false);
      if (r?.kind === 'item') await send({ t: 'useItem', item: r.item, uid: r.uid });
    }
  }
}

// Dev builds only: the server refuses these commands otherwise.
async function debugMenu() {
  const cmds: [string, DebugCommand, (string | number)?][] = [
    ['Give Lv. 10 Sprigatito', 'givePokemon', 'sprigatito'], ['Heal team', 'heal'], ['Lead +5 levels', 'levelUp', 5], ['Give items', 'items'], ['+10,000 kr.', 'money'],
    ['Unlock Copper & Current', 'unlockCoil'], ['Toggle wild encounters', 'encounters'], ['Add a badge', 'badge'],
    ['Warp: Nørrebro', 'warp', 'hafnia:norrebro'], ['Warp: Route 1', 'warp', 'hafnia:route1'], ['Warp: Botanical Garden', 'warp', 'hafnia:garden']
  ];
  const c = await choose([...cmds.map(x => x[0]), 'Back'], cmds.length, { x: 8, y: 8, w: 300 });
  if (c < cmds.length) await send({ t: 'debug', cmd: cmds[c][1], ...(cmds[c][2] !== undefined ? { arg: cmds[c][2] } : {}) });
}

async function partyScreen(mode: 'view' | 'switch' | 'item' | 'forced', party: MonView[]): Promise<number> {
  let idx = 0;
  const title = mode === 'item' ? 'Use on which Pokémon?' : mode === 'view' ? 'Your team' : 'Choose a Pokémon';
  const ov = () => {
    ctx.fillStyle = '#20406e'; ctx.fillRect(0, 0, VW, VH);
    text(title, 20, 32, 20, '#fbf7ee');
    party.forEach((m, i) => {
      const y = 46 + i * 54, sel = i === idx;
      ctx.fillStyle = sel ? '#ffe9a8' : '#fbf7ee'; roundRect(16, y, VW - 32, 48, 8); ctx.fill();
      const ic = monImg('icons', m.key); if (ic.complete && ic.naturalWidth) ctx.drawImage(ic, (Math.floor(G.t / 15) % 2) * 64, 0, 64, 64, 18, y - 10, 60, 60);
      text(m.name, 84, y + 22, 18, '#26324a'); text('Lv ' + m.level, 84, y + 41, 14, '#55617a');
      if (m.status) statusChip(m.status, 150, y + 30);
      hpBar(220, y + 12, 170, m.hp, m.maxhp);
      text(`${m.hp}/${m.maxhp}`, VW - 28, y + 22, 14, '#26324a', 'right');
      text(m.moves.map(k => k.name).join(' · '), 220, y + 40, 12, '#55617a');
    });
    text(mode === 'forced' ? 'A: select' : 'A: select   B: back', VW - 20, VH - 12, 13, '#c6d3ef', 'right');
  };
  G.overlays.push(ov);
  try {
    if (!party.length) { await say('You have no Pokémon yet.'); return -1; }
    for (;;) {
      const k = await waitKey('up', 'down', 'A', 'B');
      if (k === 'B') { if (mode === 'forced') continue; return -1; }
      if (k === 'up') { idx = (idx + party.length - 1) % party.length; Sound.se('cursor'); }
      if (k === 'down') { idx = (idx + 1) % party.length; Sound.se('cursor'); }
      if (k === 'A') {
        Sound.se('select');
        if (mode === 'view' && idx === 0) { await say(`${party[0].name} leads your team.`); continue; }
        if (mode === 'forced' && party[idx].hp <= 0) { await say(`${party[idx].name} has no energy left to battle!`); continue; }
        return idx;
      }
    }
  } finally { G.overlays.pop(); }
}

type BagChoice = { kind: 'item'; item: string; uid: string } | { kind: 'ball'; item: string } | null;
async function bagMenu(bag: Record<string, number>, party: MonView[], inBattle: boolean): Promise<BagChoice> {
  const order = ['balls', 'medicine', 'other'];
  const items = Object.keys(ITEMS).filter(k => bag[k] > 0 && (!inBattle || ITEMS[k].pocket !== 'other'))
    .sort((a, b) => order.indexOf(ITEMS[a].pocket) - order.indexOf(ITEMS[b].pocket));
  if (!items.length) { await say(inBattle ? 'You have nothing to use in battle.' : 'Your bag is empty.'); return null; }
  const c = await choose([...items.map(k => `${ITEMS[k].name}  x${bag[k]}`), 'Back'], items.length, { x: VW - 260, y: 8, w: 252 });
  if (c >= items.length) return null;
  const item = items[c], def = ITEMS[item];
  if (def.ball) {
    if (!inBattle) { await say('Throw Poké Balls at weakened wild Pokémon.'); return null; }
    return { kind: 'ball', item };
  }
  if (def.repel) return { kind: 'item', item, uid: '' };
  const i = await partyScreen('item', party);
  return i < 0 ? null : { kind: 'item', item, uid: party[i].uid };
}

// ---------- battle ----------
interface BattleState {
  start: BattleStart; intro: number;
  foe: BattleMonView | null; ally: BattleMonView | null; foeHp: number; allyHp: number;
  foeShown: boolean; allyShown: boolean; trainerShown: boolean; trainerOffset: number; playerBackShown: boolean; playerOffset: number;
  foeFx: SpriteFx; allyFx: SpriteFx;
  ballFx: { x: number; y: number; dy?: number } | null; grid: GridState | null; lastIdx: Record<string, number>; foeLeft: number;
  savedBgm: string | null;
  coil: { ally?: CoilView; foe?: CoilView }; patina: Set<string>; overcharged: Set<string>; arc: { side: BattleSide; t: number } | null;
}
interface GridState { x: number; y: number; w: number; h: number; items: { label: string; type?: string; sub?: string; dim?: boolean; on?: string }[]; cols: number; idx: number; key: string }
let B: BattleState | null = null;

function hpBar(x: number, y: number, w: number, hp: number, max: number) {
  const r = Math.max(0, hp / max);
  ctx.fillStyle = '#3b3f4a'; roundRect(x, y, w, 10, 5); ctx.fill();
  ctx.fillStyle = r > 0.5 ? '#4fd17a' : r > 0.2 ? '#f2c33b' : '#ef5a4b';
  if (r > 0) { roundRect(x + 2, y + 2, Math.max(4, (w - 4) * r), 6, 3); ctx.fill(); }
}
function databox(m: BattleMonView, x: number, y: number, showNums: boolean, disp: number) {
  ctx.fillStyle = 'rgba(29,43,69,0.9)'; roundRect(x, y, 230, showNums ? 70 : 54, 10); ctx.fill();
  ctx.fillStyle = '#fbf7ee'; roundRect(x + 3, y + 3, 224, (showNums ? 70 : 54) - 6, 8); ctx.fill();
  text(m.name, x + 14, y + 23, 18, '#26324a');
  if (m.gender) text(m.gender === 'M' ? '♂' : '♀', x + 14 + Math.min(120, m.name.length * 10) + 6, y + 23, 16, m.gender === 'M' ? '#3a7bd5' : '#d9473a');
  text('Lv' + m.level, x + 216, y + 23, 16, '#26324a', 'right');
  text('HP', x + 14, y + 42, 12, '#d9473a');
  hpBar(x + 36, y + 33, 180, disp, m.maxhp);
  if (m.status) statusChip(m.status, x + 150, y + 6);
  if (showNums) {
    text(`${Math.ceil(disp)}/${m.maxhp}`, x + 216, y + 61, 14, '#26324a', 'right');
    if (m.exp !== undefined && m.expHi !== undefined && m.expLo !== undefined) {
      ctx.fillStyle = '#c9d2e3'; ctx.fillRect(x + 14, y + 58, 110, 4);
      ctx.fillStyle = '#4aa3df'; ctx.fillRect(x + 14, y + 58, 110 * Math.max(0, Math.min(1, (m.exp - m.expLo) / Math.max(1, m.expHi - m.expLo))), 4);
    }
  }
}
/** The Coil gauge: copper pips that light up one by one, pulse when ready and go dark once spent. */
function drawCoil(c: CoilView, x: number, y: number) {
  ctx.fillStyle = 'rgba(29,43,69,0.9)'; roundRect(x, y, 26 + c.max * 18, 16, 8); ctx.fill();
  ctx.fillStyle = c.overcharge ? '#ff6b5a' : CURRENT; ctx.font = `10px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('⚡', x + 6, y + 12);
  const pulse = !c.used && c.pips >= c.ready ? 0.65 + 0.35 * Math.sin(G.t / 6) : 1;
  for (let i = 0; i < c.max; i++) {
    const lit = !c.used && i < c.pips;
    ctx.globalAlpha = lit ? pulse : 1;
    ctx.fillStyle = c.used ? '#3b3f4a' : lit ? (c.overcharge ? '#ff8a5a' : COPPER) : '#55617a';
    roundRect(x + 20 + i * 18, y + 4, 14, 8, 3); ctx.fill();
    if (i === c.ready - 1) { ctx.fillStyle = '#fbf7ee'; ctx.fillRect(x + 20 + i * 18 + 15, y + 3, 1, 10); }
  }
  ctx.globalAlpha = 1;
}
/** Current: arcs from the Rotom Pokédex (bottom left) into the Pokémon. */
function drawArc(side: BattleSide, t: number) {
  const [tx, ty] = side === 'ally' ? [128, 230] : [384, 130];
  ctx.strokeStyle = CURRENT; ctx.lineWidth = 3; ctx.globalAlpha = 1 - t / 30;
  for (let k = 0; k < 2; k++) {
    ctx.beginPath(); ctx.moveTo(20, 280);
    for (let i = 1; i <= 8; i++) { const f = i / 8; ctx.lineTo(20 + (tx - 20) * f + (i < 8 ? Math.sin(G.t * 7 + i * 3 + k) * 14 : 0), 280 + (ty - 280) * f + (i < 8 ? Math.cos(G.t * 5 + i * 2 + k) * 10 : 0)); }
    ctx.stroke();
  }
  ctx.globalAlpha = 0.25 * (1 - t / 30); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, VW, 288);
  ctx.globalAlpha = 1;
}
function sideFx(side: BattleSide): SpriteFx {
  const b = B!, mon = side === 'foe' ? b.foe : b.ally, fx = side === 'foe' ? b.foeFx : b.allyFx;
  if (!mon?.uid) return fx;
  return { ...fx, ...(b.patina.has(mon.uid) ? { tint: PATINA } : {}), ...(b.overcharged.has(mon.uid) ? { glitch: 1 } : {}) };
}
function drawBattle() {
  const b = B!, bg = b.start.bg;
  ctx.drawImage(packImg(`bb/${bg}_bg`), 0, 0, 512, 288);
  const slide = b.intro;
  ctx.drawImage(packImg(`bb/${bg}_base1`), 256 + slide, 92);
  ctx.drawImage(packImg(`bb/${bg}_base0`), -128 - slide, 240);
  if (b.trainerShown && b.start.trainer) {
    const ti = packImg(b.start.trainer.sprite);
    if (ti.naturalWidth) ctx.drawImage(ti, 0, 0, ti.width, ti.height, 384 - 64 + slide + b.trainerOffset, 70, 128, 128);
  }
  if (b.foe && b.foeShown) drawMonSprite(b.foe.key, 'front', 384 + slide, 180, 1, true, sideFx('foe'));
  if (b.ballFx) ctx.drawImage(packImg('chars/ball'), 0, 0, 32, 32, b.ballFx.x - 16, b.ballFx.y - 16 + (b.ballFx.dy || 0), 32, 32);
  if (b.playerBackShown) {
    const im = packImg('tr/player_back'), fw = im.width / 5;
    if (im.naturalWidth) ctx.drawImage(im, 0, 0, fw, im.height, 70 - slide + b.playerOffset, 292 - im.height * 0.62, fw * 0.62, im.height * 0.62);
  }
  if (b.ally && b.allyShown) drawMonSprite(b.ally.key, 'back', 128 - slide, 286, 1, true, sideFx('ally'));
  if (b.arc) drawArc(b.arc.side, b.arc.t);
  if (b.foe && b.foeShown) databox(b.foe, 16, 20, false, b.foeHp);
  if (b.ally && b.allyShown) databox(b.ally, VW - 246, 196, true, b.allyHp);
  if (b.coil.foe && !b.trainerShown) drawCoil(b.coil.foe, 16, 78);
  if (b.coil.ally && b.allyShown) drawCoil(b.coil.ally, VW - 42 - b.coil.ally.max * 18, 174);
  if (b.start.trainer && b.trainerShown) { // the trainer's team, one ball per Pokémon
    ctx.fillStyle = 'rgba(29,43,69,0.85)'; roundRect(16, 20, b.start.foeCount * 26 + 14, 34, 10); ctx.fill();
    for (let i = 0; i < b.start.foeCount; i++) {
      ctx.globalAlpha = i < b.foeLeft ? 1 : 0.35;
      ctx.drawImage(packImg('chars/ball'), 0, 0, 32, 32, 21 + i * 26, 21, 32, 32);
      ctx.globalAlpha = 1;
    }
  }
  if (!G.ui.text) { ctx.fillStyle = '#1d2b45'; ctx.fillRect(0, 288, VW, 96); }
}
function drawGrid(g: GridState) {
  const { x, y, w, h, items, cols, idx } = g;
  panel(x, y, w, h);
  const cw = (w - 24) / cols, rh = (h - 20) / Math.ceil(items.length / cols);
  items.forEach((it, i) => {
    const cx = x + 12 + (i % cols) * cw, cy = y + 10 + Math.floor(i / cols) * rh;
    if (i === idx) { ctx.fillStyle = '#ffe9a8'; roundRect(cx + 2, cy + 2, cw - 4, rh - 4, 6); ctx.fill(); }
    if (it.on) { ctx.fillStyle = it.on; roundRect(cx + 2, cy + 2, cw - 4, rh - 4, 6); ctx.fill(); if (i === idx) { ctx.strokeStyle = '#d9473a'; ctx.lineWidth = 3; roundRect(cx + 3, cy + 3, cw - 6, rh - 6, 6); ctx.stroke(); } }
    if (it.type) { ctx.fillStyle = TYPE_COLORS[it.type] ?? '#777'; roundRect(cx + 6, cy + 8, 6, rh - 16, 3); ctx.fill(); }
    text(it.label, cx + 18, cy + rh / 2 + 6, 17, it.dim ? '#9aa3b5' : '#26324a');
    if (it.sub) text(it.sub, cx + cw - 10, cy + rh / 2 + 6, 11, '#55617a', 'right');
  });
}
async function gridChoose(items: GridState['items'], rect: { x: number; y: number; w: number; h: number; key: string }, cols: number, cancelable: boolean) {
  const b = B!;
  b.grid = { ...rect, items, cols, idx: b.lastIdx[rect.key] ?? 0 };
  if (b.grid.idx >= items.length) b.grid.idx = 0;
  try {
    for (;;) {
      const k = await waitKey('up', 'down', 'left', 'right', 'A', 'B');
      const g = b.grid!, n = items.length;
      if (k === 'left' && g.idx % cols > 0) g.idx--;
      else if (k === 'right' && g.idx % cols < cols - 1 && g.idx + 1 < n) g.idx++;
      else if (k === 'up' && g.idx - cols >= 0) g.idx -= cols;
      else if (k === 'down' && g.idx + cols < n) g.idx += cols;
      else if (k === 'A') { Sound.se('select'); b.lastIdx[rect.key] = g.idx; return g.idx; }
      else if (k === 'B' && cancelable) return -1;
      else continue;
      Sound.se('cursor');
    }
  } finally { b.grid = null; }
}

async function battleStart(start: BattleStart) {
  B = {
    start, intro: 300, foe: null, ally: null, foeHp: 0, allyHp: 0, foeShown: false, allyShown: false,
    trainerShown: !!start.trainer, trainerOffset: 0, playerBackShown: true, playerOffset: 0, foeFx: {}, allyFx: {},
    ballFx: null, grid: null, lastIdx: {}, foeLeft: start.foeCount, savedBgm: Sound.bgmName,
    coil: { ...start.coil }, patina: new Set(), overcharged: new Set(), arc: null
  };
  Sound.bgm(start.bgm);
  for (let i = 0; i < 3; i++) { await fadeTo(0.8, 4); await fadeTo(0, 4); }
  await fadeTo(1, 10);
  G.scene = 'battle';
  await fadeTo(0, 10);
  for (let i = 0; i <= 30; i++) { B.intro = 300 * (1 - i / 30); await nextFrame(); }
}

async function animateHp(side: BattleSide, target: number) {
  const b = B!, key = side === 'foe' ? 'foeHp' : 'allyHp';
  const start = b[key], frames = Math.max(8, Math.min(40, Math.abs(start - target) * 2));
  for (let i = 1; i <= frames; i++) { b[key] = start + (target - start) * i / frames; await nextFrame(); }
}
async function flash(side: BattleSide) {
  const b = B!, k = side === 'foe' ? 'foeFx' : 'allyFx';
  for (let i = 0; i < 8; i++) { b[k] = { flash: i % 2 === 0 }; await wait(3); }
  b[k] = {};
}
async function lunge(side: BattleSide) {
  const b = B!, k = side === 'foe' ? 'foeFx' : 'allyFx', dir = side === 'foe' ? 1 : -1;
  for (const d of [4, 8, 12, 8, 4, 0]) { b[k] = { dy: d * dir }; await nextFrame(); }
  b[k] = {};
}
async function grow(side: BattleSide) {
  const b = B!, k = side === 'foe' ? 'foeFx' : 'allyFx';
  for (let i = 0; i <= 10; i++) { b[k] = { shrink: i / 10 }; await nextFrame(); }
  b[k] = {};
}

async function battleEvent(e: BattleEvent) {
  const b = B!;
  switch (e.b) {
    case 'text': await say(e.text); break;
    case 'trainerOut': await say(e.text); break;
    case 'switch': {
      if (e.side === 'foe') {
        if (b.start.trainer && b.trainerShown) {
          for (let i = 0; i <= 16; i++) { b.trainerOffset = i * 12; await nextFrame(); }
          b.trainerShown = false;
        }
        b.foe = e.mon; b.foeHp = e.mon.hp; b.foeShown = true;
        if (b.start.kind === 'wild') { Sound.cry(e.mon.key); await say(e.text); }
        else { await say(e.text); Sound.cry(e.mon.key); await grow('foe'); }
      } else {
        if (b.ally && b.allyShown) {
          await say(`${b.ally.name}, come back!`); Sound.se('recall');
          b.allyShown = false; await wait(10);
        }
        if (b.playerBackShown) { for (let i = 0; i <= 12; i++) { b.playerOffset = -i * 16; await nextFrame(); } b.playerBackShown = false; }
        b.ally = e.mon; b.allyHp = e.mon.hp;
        await say(e.text);
        b.allyShown = true; Sound.cry(e.mon.key);
        await grow('ally');
      }
      break;
    }
    case 'recall': await say(e.text); if (e.side === 'ally') b.allyShown = false; else b.foeShown = false; break;
    case 'move': {
      await say(e.text);
      await lunge(e.side);
      break;
    }
    case 'hp': {
      const mon = e.side === 'foe' ? b.foe : b.ally;
      if (!mon) break;
      const dropped = e.hp < (e.side === 'foe' ? b.foeHp : b.allyHp);
      if (dropped && e.effect !== 'residual') {
        Sound.se(e.effect === 'super' ? 'hit_super' : e.effect === 'weak' ? 'hit_weak' : 'hit');
        await flash(e.side);
      }
      mon.hp = e.hp; mon.maxhp = e.maxhp;
      await animateHp(e.side, e.hp);
      break;
    }
    case 'status': { const mon = e.side === 'foe' ? b.foe : b.ally; if (mon) mon.status = e.status; break; }
    case 'faint': {
      const k = e.side === 'foe' ? 'foeFx' : 'allyFx', mon = e.side === 'foe' ? b.foe : b.ally;
      if (mon) Sound.cry(mon.key);
      for (let i = 0; i <= 16; i++) { b[k] = { dy: i * 6, shrink: 1 - i / 20 }; await nextFrame(); }
      if (e.side === 'foe') { b.foeShown = false; b.foeLeft--; } else b.allyShown = false;
      b[k] = {};
      await say(e.text);
      break;
    }
    case 'exp': {
      const a = b.ally; if (!a) break;
      const from = a.exp ?? e.exp;
      a.level = e.level; a.maxhp = e.maxhp; a.hp = e.hp; a.expLo = e.expLo; a.expHi = e.expHi;
      for (let i = 1; i <= 20; i++) { a.exp = from + (e.exp - from) * i / 20; await nextFrame(); }
      b.allyHp = e.hp;
      break;
    }
    case 'throw': {
      Sound.se('throw');
      for (let i = 0; i <= 24; i++) {
        const t = i / 24; b.ballFx = { x: 120 + (384 - 120) * t, y: 260 - 200 * t + 260 * t * t - 60 * t };
        await nextFrame();
      }
      for (let i = 0; i <= 10; i++) { b.foeFx = { shrink: 1 - i / 10 }; await nextFrame(); }
      b.foeShown = false; b.foeFx = {};
      for (let i = 0; i <= 10; i++) { b.ballFx!.y += 3; await nextFrame(); }
      for (let s = 0; s < e.shakes; s++) {
        await wait(18); Sound.se('shake');
        for (const d of [-4, -8, -4, 0, 4, 8, 4, 0]) { b.ballFx!.x += d / 2; await nextFrame(); }
      }
      await wait(20);
      if (!e.caught) { b.ballFx = null; b.foeShown = true; }
      else b.ballFx = { ...b.ballFx!, dy: 0 };
      break;
    }
    case 'flee': Sound.se('flee'); break;
    case 'coil': b.coil[e.side] = e.coil; break;
    case 'copper': {
      const mon = e.side === 'foe' ? b.foe : b.ally;
      Sound.se('recall');
      for (let i = 0; i < 12; i++) { if (mon?.uid) { if (i % 2) b.patina.add(mon.uid); else b.patina.delete(mon.uid); } await wait(3); }
      if (mon?.uid) b.patina.add(mon.uid);
      Sound.se('select');
      await say(e.text);
      break;
    }
    case 'current': case 'overcharge': {
      Sound.se('hit_super', 0.4);
      for (let t = 0; t < 30; t++) { b.arc = { side: e.side, t }; await nextFrame(); }
      b.arc = null;
      const mon = e.side === 'foe' ? b.foe : b.ally;
      if (e.b === 'overcharge' && mon?.uid) { b.patina.add(mon.uid); b.overcharged.add(mon.uid); }
      await say(e.text);
      break;
    }
  }
}

/** Moves, plus the Copper and Current toggles when the Coil is online (a toggle applies to the move picked next). */
async function fightMenu(req: BattleRequest): Promise<BattleAction | null> {
  let mode: CoilMode | null = null;
  const coil = req.coil;
  const pad = <T,>(list: T[], filler: T) => { const out = [...list]; while (out.length % 2) out.push(filler); return out; };
  for (;;) {
    const moves: GridState['items'] = pad<GridState['items'][number]>(req.moves.map((m: MoveView) => ({
      label: m.name, type: m.type, sub: `${m.pp}/${m.maxpp}`,
      dim: m.disabled || (mode === 'current' && m.category === 'Status')
    })), { label: '', dim: true });
    const toggles: GridState['items'] = coil ? [
      { label: mode === 'copper' ? 'Copper ✓' : 'Copper', sub: coil.copper ? '' : 'ready', dim: !!coil.copper, on: mode === 'copper' ? '#cdeedd' : undefined },
      { label: mode === 'current' ? 'Current ✓' : 'Current', sub: coil.current ? '' : 'ready', dim: !!coil.current, on: mode === 'current' ? '#d6efff' : undefined }
    ] : [];
    const items = [...moves, ...toggles];
    const rows = items.length / 2;
    const h = rows * 34 + 20;
    const mi = await gridChoose(items, { x: 0, y: VH - h, w: 512, h, key: 'move' }, 2, true);
    if (mi < 0) return null;
    if (mi >= moves.length) {
      const which: CoilMode = mi === moves.length ? 'copper' : 'current';
      const why = coil?.[which];
      if (why) { await say(why); continue; }
      mode = mode === which ? null : which;
      Sound.se(mode ? 'select' : 'cursor');
      continue;
    }
    const m = req.moves[mi];
    if (!m) continue;
    if (m.disabled) { await say(m.pp === 0 ? 'There\'s no PP left for this move!' : 'That move can\'t be used right now!'); continue; }
    if (mode === 'current' && m.category === 'Status') { await say('Status moves can\'t carry Current.'); continue; }
    return { kind: 'move', index: mi, ...(mode ? { mode } : {}) };
  }
}

async function battleMenu(req: BattleRequest): Promise<BattleAction> {
  const b = B!;
  if (req.forceSwitch) {
    const i = await partyScreen('forced', req.party);
    return { kind: 'switch', uid: req.party[i].uid };
  }
  for (;;) {
    const name = b.ally?.name ?? 'your Pokémon';
    G.ui.text = { full: `What will ${name} do?`, shown: 999, w: 268 };
    const c = await gridChoose([{ label: 'Fight' }, { label: 'Bag' }, { label: 'Pokémon' }, { label: 'Run', dim: !req.canRun }],
      { x: 272, y: 288, w: 240, h: 96, key: 'cmd' }, 2, false);
    G.ui.text = null;
    if (c === 0) {
      const r = await fightMenu(req);
      if (r) return r;
      continue;
    }
    if (c === 1) {
      const r = await bagMenu(req.bag, req.party, true);
      if (!r) continue;
      if (r.kind === 'ball' && !req.canCatch) { await say('The trainer blocked the ball!\nDon\'t be a thief!'); continue; }
      return r.kind === 'ball' ? { kind: 'ball', item: r.item } : { kind: 'item', item: r.item, uid: r.uid };
    }
    if (c === 2) {
      const i = await partyScreen('switch', req.party);
      if (i < 0) continue;
      const m = req.party[i];
      if (m.hp <= 0) { await say(`${m.name} has no energy left to battle!`); continue; }
      if (m.uid === req.activeUid) { await say(`${m.name} is already in battle!`); continue; }
      return { kind: 'switch', uid: m.uid };
    }
    if (!req.canRun) { await say('No! There\'s no running from a trainer battle!'); continue; }
    return { kind: 'run' };
  }
}

async function battleEnd() {
  await wait(20);
  await fadeTo(1, 12);
  const saved = B?.savedBgm ?? null;
  G.scene = 'overworld'; B = null; G.ui.text = null;
  Sound.bgm(saved ?? 'overworld');
  await fadeTo(0, 12);
}

// ---------- title ----------
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#0e2148'); g.addColorStop(0.6, '#26507f'); g.addColorStop(1, '#f2a65a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // harbour skyline of gabled houses
  const cols = ['#d9473a', '#f2c33b', '#3a7bd5', '#4fae5b', '#e9823a', '#8e5bb5', '#d9473a', '#3a7bd5'];
  for (let i = 0; i < 8; i++) {
    const x = i * 64, h = 120 + (i % 3) * 16;
    ctx.fillStyle = cols[i]; ctx.fillRect(x + 2, VH - h, 60, h);
    ctx.beginPath(); ctx.moveTo(x + 2, VH - h); ctx.lineTo(x + 32, VH - h - 26); ctx.lineTo(x + 62, VH - h); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,190,0.85)';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) ctx.fillRect(x + 14 + c * 24, VH - h + 18 + r * 30, 10, 14);
  }
  ctx.fillStyle = 'rgba(14,33,72,0.55)'; ctx.fillRect(0, VH - 40, VW, 40);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect((i * 53 + G.t) % VW, VH - 30 + (i % 3) * 8, 18, 2); }
  text('COPPER & CURRENT', VW / 2, 82, 44, '#ffd36b', 'center');
  text('A Pokémon fan game set in Hafnia', VW / 2, 114, 18, '#e8eefc', 'center');
  drawMonSprite('POPPLIO', 'front', 120, 236, 0.9, true);
  drawMonSprite('SPRIGATITO', 'front', 256, 230, 0.9, true);
  drawMonSprite('PONYTA', 'front', 392, 236, 0.8, true);
  if (!G.ui.choice && Math.floor(G.t / 30) % 2 === 0) {
    ctx.fillStyle = 'rgba(14,33,72,0.8)'; roundRect(VW / 2 - 170, 290, 340, 34, 17); ctx.fill();
    text('Tap the screen or press A to start', VW / 2, 313, 18, '#fff', 'center');
  }
  if (titleSummary && G.ui.choice) text(titleSummary, VW / 2, 360, 14, '#e8eefc', 'center');
}
let titleSummary = '';

async function titleFlow() {
  G.scene = 'title'; Sound.bgm('title');
  const evs = await conn.send({ t: 'title' });
  const title = evs.find(e => e.t === 'title');
  const hasSave = !!(title && title.t === 'title' && title.hasSave);
  titleSummary = title && title.t === 'title' ? title.summary ?? '' : '';
  const slots = title && title.t === 'title' ? title.slots ?? [] : [];
  await waitKey('A');
  Sound.se('select');
  const opts = hasSave ? ['Continue', 'New game'] : ['New game'];
  const c = await choose(opts, -1, { x: VW / 2 - 90, y: 250, w: 180 });
  let slot: SaveSlot | undefined;
  if (hasSave && c === 0 && slots.filter(s => s.summary).length > 1) {
    const picked = await pickSlot(slots, false);
    if (picked === null) return titleFlow();
    slot = picked;
  }
  await fadeTo(1, 16);
  if (hasSave && c === 0) {
    const r = await conn.send({ t: 'continue', ...(slot !== undefined ? { slot } : {}) });
    if (r.some(e => e.t === 'error')) { G.fade = 0; await play(r); return titleFlow(); }
    await play(r);
    return;
  }
  G.scene = 'intro';
  await fadeTo(0, 10);
  await send({ t: 'newGame' });
}

// ---------- main loop ----------
let loadP = 0;
function render() {
  ctx.textAlign = 'left';
  if (G.scene === 'loading') {
    ctx.fillStyle = '#0e2148'; ctx.fillRect(0, 0, VW, VH);
    text('Loading Copper & Current...', VW / 2, VH / 2 - 10, 20, '#e8eefc', 'center');
    ctx.fillStyle = '#26507f'; ctx.fillRect(VW / 2 - 120, VH / 2 + 10, 240, 10);
    ctx.fillStyle = '#ffd36b'; ctx.fillRect(VW / 2 - 120, VH / 2 + 10, 240 * loadP, 10);
    return;
  }
  if (G.scene === 'title') drawTitle();
  else if (G.scene === 'intro') { ctx.fillStyle = '#0e2148'; ctx.fillRect(0, 0, VW, VH); drawMonSprite('POPPLIO', 'front', VW / 2, 220, 1.2, true); }
  else if (G.scene === 'battle' && B) drawBattle();
  else if (G.mapKey) drawOverworld();
  for (const o of G.overlays) o();
  drawTextbox(); if (G.scene === 'battle' && B?.grid) drawGrid(B.grid); drawChoice();
  if (G.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
}

function update() {
  input.pressed = input.queue; input.queue = new Set();
  if (G.scene !== 'overworld' || G.ui.text || G.ui.choice || G.overlays.length) sticky.clear();
  G.t++;
  const ws = frameWaiters; frameWaiters = [];
  ws.forEach(r => r());
  if (G.scene === 'overworld' && !G.busy && !G.lock) {
    G.busy = true;
    overworldTick().catch(e => console.error(e)).finally(() => { G.busy = false; });
  }
}

let last = performance.now(), acc = 0;
function loop(now: number) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(loop);
}

async function boot() {
  requestAnimationFrame(loop);
  try { await document.fonts.load(`20px ${FONT}`); } catch { /* font optional */ }
  const [c] = await Promise.all([connectSolo(), preload(p => { loadP = p; })]);
  conn = c;
  (window as any).__hafnia = { G, mode: c.mode, send: (i: Intent) => conn.send(i) }; // for tests and debugging
  G.lock = true;
  try { await titleFlow(); } finally { G.lock = false; }
  // Browsers close tabs without warning: autosave every 2 minutes and whenever the tab is hidden (systems.md §8).
  const autosave = () => { if (G.scene === 'overworld') conn.send({ t: 'autosave' }); };
  setInterval(autosave, 120_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autosave(); });
}

document.getElementById('mute')!.addEventListener('click', e => {
  Sound.unlock(); Sound.setMuted(!Sound.muted);
  const btn = e.currentTarget as HTMLButtonElement;
  btn.textContent = Sound.muted ? 'Sound off' : 'Sound on';
  btn.setAttribute('aria-pressed', String(!Sound.muted));
});
boot();
