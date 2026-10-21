// The battle animation player. It plays a timeline (data from anim-data.ts or a pack's anims.json)
// step by step on the battle canvas: sprite moves (lunge, hop, shake...) become offsets that
// drawMonSprite applies, and everything else (particles, projectiles, beams, bursts) lives in an
// effects layer that drawBattle draws above the sprites. One step per frame tick, 60 ticks a second.
import type { AnimAt, AnimPreset, AnimShape, AnimStep, AnimTimeline, AnimWho, BattleSide } from '@hafnia/core';

/** A place on the battlefield: a side's first Pokémon, or (multi battles) its second. */
export type Spot = BattleSide | 'ally2' | 'foe2';

export interface Point { x: number; y: number }
export interface AnimHost {
  nextFrame(): Promise<void>;
  /** Where a side's Pokémon is on screen (the middle of its body). */
  centerOf(side: Spot): Point;
  sfx(name: string, vol?: number): void;
  font: string;
}
/** Who plays which role in a timeline. For self-targeted moves user and target are the same side. */
export interface Cast { user: Spot; target: Spot }
/** What the player adds to a sprite while a step runs. */
export interface SpriteMod { dx: number; dy: number; alpha: number; sx: number; sy: number; tint?: string; tintA?: number }

const SCENE = { w: 512, h: 288 };
const FPS = 60;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const other = (s: Spot): Spot => (s.startsWith('ally') ? 'foe' : 'ally');

interface Effect { draw(g: CanvasRenderingContext2D): void }
interface Mod { side: Spot; m: Partial<SpriteMod> }
interface Particle {
  x: number; y: number; vx: number; vy: number; ay: number; drag: number; sway: number;
  age: number; life: number; delay: number; size: number; grow: number; alpha: number;
  color: string; shape: AnimShape; rot: number; vr: number; orient: boolean;
}

export class AnimPlayer {
  /** 1 = normal, 2 = fast (halves every duration). */
  speed = 1;
  /** prefers-reduced-motion: no screen shake, softer flashes, no strobing. */
  reduced = false;
  quake = { x: 0, y: 0 };
  private effects = new Set<Effect>();
  private mods = new Set<Mod>();

  constructor(private host: AnimHost) {}

  frames(ms: number) { return Math.max(1, Math.round((ms / 1000) * FPS / this.speed)); }

  async play(tl: AnimTimeline, cast: Cast) {
    for (const s of tl) await this.step(s, cast);
  }

  /** Clears everything, e.g. when a battle ends mid-animation. */
  clear() { this.effects.clear(); this.mods.clear(); this.quake = { x: 0, y: 0 }; }

  /** The combined sprite offsets of every running step for one side. */
  modFor(side: Spot): SpriteMod {
    const out: SpriteMod = { dx: 0, dy: 0, alpha: 1, sx: 1, sy: 1 };
    for (const { side: s, m } of this.mods) {
      if (s !== side) continue;
      out.dx += m.dx ?? 0; out.dy += m.dy ?? 0; out.alpha *= m.alpha ?? 1; out.sx *= m.sx ?? 1; out.sy *= m.sy ?? 1;
      if (m.tint && (m.tintA ?? 0) > 0) { out.tint = m.tint; out.tintA = m.tintA; }
    }
    return out;
  }

  draw(g: CanvasRenderingContext2D) { for (const e of this.effects) e.draw(g); }

  // ---------- steps ----------

  private side(who: AnimWho | undefined, cast: Cast, dflt: AnimWho): Spot { return cast[who ?? dflt]; }
  private at(at: AnimAt | undefined, cast: Cast, dflt: AnimWho): Point {
    return at === 'screen' ? { x: SCENE.w / 2, y: SCENE.h / 2 } : this.host.centerOf(cast[at ?? dflt]);
  }

  /** Runs `each(t, i)` once per frame for `ms`, with t going from 0 to 1. */
  private async run(ms: number, each: (t: number, i: number, n: number) => void) {
    const n = this.frames(ms);
    for (let i = 0; i < n; i++) { each(n === 1 ? 1 : i / (n - 1), i, n); await this.host.nextFrame(); }
  }
  private async withMod(side: Spot, ms: number, fn: (t: number, i: number) => Partial<SpriteMod>) {
    const mod: Mod = { side, m: {} };
    this.mods.add(mod);
    try { await this.run(ms, (t, i) => { mod.m = fn(t, i); }); } finally { this.mods.delete(mod); }
  }
  private async withEffect(ms: number, draw: (g: CanvasRenderingContext2D, t: number, i: number) => void) {
    let t = 0, i = 0;
    const e: Effect = { draw: g => { g.save(); draw(g, t, i); g.restore(); } };
    this.effects.add(e);
    try { await this.run(ms, (tt, ii) => { t = tt; i = ii; }); } finally { this.effects.delete(e); }
  }

  private async step(s: AnimStep, cast: Cast): Promise<void> {
    switch (s.do) {
      case 'par': await Promise.all(s.steps.map(x => this.step(x, cast))); return;
      case 'wait': await this.run(s.ms, () => {}); return;
      case 'sfx': this.host.sfx(s.name, s.vol); return;

      case 'lunge': {
        const side = this.side(s.who, cast, 'user'), from = this.host.centerOf(side);
        const toSide = cast.user === cast.target ? other(side) : (side === cast.user ? cast.target : cast.user);
        const to = this.host.centerOf(toSide), len = Math.hypot(to.x - from.x, to.y - from.y) || 1, d = s.dist ?? 26;
        const ux = (to.x - from.x) / len, uy = (to.y - from.y) / len;
        // Quick out, short hold, slower back.
        return this.withMod(side, s.ms ?? 260, t => { const k = t < 0.35 ? t / 0.35 : t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5; return { dx: ux * d * k, dy: uy * d * k }; });
      }
      case 'hop': {
        const h = s.height ?? 14, times = s.times ?? 1;
        return this.withMod(this.side(s.who, cast, 'user'), s.ms ?? 300, t => ({ dy: -h * Math.abs(Math.sin(Math.PI * t * times)) }));
      }
      case 'shake': {
        const amp = s.amp ?? 6;
        return this.withMod(this.side(s.who, cast, 'target'), s.ms ?? 300, (t, i) => ({ dx: amp * (1 - t) * (i % 4 < 2 ? 1 : -1) }));
      }
      case 'blink': {
        const reduced = this.reduced;
        return this.withMod(this.side(s.who, cast, 'target'), s.ms ?? 300, (t, i) =>
          reduced ? { tint: '#ffffff', tintA: 0.5 * Math.sin(Math.PI * t) } : { alpha: Math.floor(i / 3) % 2 ? 0.15 : 1 });
      }
      case 'tint': {
        const a = s.alpha ?? 0.5;
        return this.withMod(this.side(s.who, cast, 'target'), s.ms ?? 400, t => ({ tint: s.color, tintA: a * Math.sin(Math.PI * t) }));
      }
      case 'squash': {
        const a = s.amount ?? 0.15;
        return this.withMod(this.side(s.who, cast, 'user'), s.ms ?? 300, t => { const k = Math.sin(Math.PI * t) * a; return { sx: 1 + k, sy: 1 - k }; });
      }
      case 'screen': {
        const a = (s.alpha ?? 0.5) * (this.reduced ? 0.4 : 1);
        return this.withEffect(s.ms ?? 200, (g, t) => { g.globalAlpha = a * Math.sin(Math.PI * t); g.fillStyle = s.color; g.fillRect(0, 0, SCENE.w, SCENE.h); });
      }
      case 'quake': {
        if (this.reduced) return this.run(s.ms ?? 300, () => {});
        const amp = s.amp ?? 5;
        try { await this.run(s.ms ?? 300, t => { this.quake = { x: rnd(-amp, amp) * (1 - t), y: rnd(-amp, amp) * (1 - t) * 0.5 }; }); }
        finally { this.quake = { x: 0, y: 0 }; }
        return;
      }
      case 'projectile': return this.projectile(s, cast);
      case 'beam': return this.beam(s, cast);
      case 'particles': return this.particles(s, cast);
      case 'burst': {
        const c = this.at(s.at, cast, 'target'), size = s.size ?? 34;
        return this.withEffect(s.ms ?? 260, (g, t) => {
          const r = size * (0.3 + 0.9 * t);
          g.globalAlpha = 1 - t;
          g.strokeStyle = s.color; g.lineWidth = 5 * (1 - t) + 1;
          g.beginPath(); g.arc(c.x, c.y, r, 0, Math.PI * 2); g.stroke();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + 0.2;
            g.beginPath(); g.moveTo(c.x + Math.cos(a) * r * 0.7, c.y + Math.sin(a) * r * 0.7); g.lineTo(c.x + Math.cos(a) * r * 1.25, c.y + Math.sin(a) * r * 1.25); g.stroke();
          }
          g.fillStyle = '#ffffff'; g.globalAlpha = 0.85 * (1 - t);
          g.beginPath(); g.arc(c.x, c.y, size * 0.45 * (1 - t), 0, Math.PI * 2); g.fill();
        });
      }
      case 'slash': {
        const c = this.at(s.at, cast, 'target'), n = s.count ?? 3, col = s.color ?? '#ffffff';
        return this.withEffect(s.ms ?? 320, (g, t) => {
          for (let k = 0; k < n; k++) {
            const start = (k / n) * 0.4, lt = Math.max(0, Math.min(1, (t - start) / 0.45));
            if (lt <= 0) continue;
            const grow = Math.min(1, lt / 0.5), fade = lt > 0.6 ? 1 - (lt - 0.6) / 0.4 : 1;
            const x0 = c.x - 34 + (k - (n - 1) / 2) * 16 + 8, y0 = c.y - 36, x1 = x0 + 48, y1 = c.y + 36;
            g.globalAlpha = fade;
            g.lineCap = 'round';
            g.strokeStyle = col; g.lineWidth = 6;
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (x1 - x0) * grow, y0 + (y1 - y0) * grow); g.stroke();
            g.strokeStyle = '#ffffff'; g.lineWidth = 2;
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (x1 - x0) * grow, y0 + (y1 - y0) * grow); g.stroke();
          }
        });
      }
      case 'bite': {
        const c = this.at(s.at, cast, 'target'), col = s.color ?? '#ffffff';
        return this.withEffect(s.ms ?? 380, (g, t) => {
          const close = Math.min(1, t / 0.55), gap = 44 * (1 - close) + 4, fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
          g.globalAlpha = fade; g.fillStyle = col; g.strokeStyle = '#26324a'; g.lineWidth = 2;
          for (const dir of [-1, 1]) {
            const y = c.y + dir * gap;
            g.beginPath();
            for (let k = 0; k < 4; k++) {
              const x = c.x - 36 + k * 18;
              g.moveTo(x, y + dir * 10); g.lineTo(x + 18, y + dir * 10); g.lineTo(x + 9, y - dir * 12); g.closePath();
            }
            g.fill(); g.stroke();
          }
        });
      }
      case 'orbit': {
        const c = this.at(s.at, cast, 'target'), n = s.count ?? 3, r = s.radius ?? 30, shape = s.shape ?? 'star';
        return this.withEffect(s.ms ?? 700, (g, t, i) => {
          g.globalAlpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
          for (let k = 0; k < n; k++) {
            const a = i * 0.14 + (k / n) * Math.PI * 2;
            drawShape(g, shape, c.x + Math.cos(a) * r, c.y - 44 + Math.sin(a) * r * 0.35, 9, s.color, i * 0.1, this.host.font);
          }
        });
      }
      case 'wave': {
        const from = this.host.centerOf(this.side(s.from, cast, 'user'));
        const toSide = this.side(s.to, cast, 'target');
        const to = toSide === this.side(s.from, cast, 'user') ? this.host.centerOf(other(toSide)) : this.host.centerOf(toSide);
        const ang = Math.atan2(to.y - from.y, to.x - from.x), dist = Math.hypot(to.x - from.x, to.y - from.y), rings = s.rings ?? 3;
        return this.withEffect(s.ms ?? 450, (g, t) => {
          g.strokeStyle = s.color; g.lineWidth = 3;
          for (let k = 0; k < rings; k++) {
            const lt = t * 1.6 - k * 0.3; if (lt <= 0 || lt >= 1) continue;
            g.globalAlpha = 1 - lt;
            g.beginPath(); g.arc(from.x, from.y, 16 + dist * lt, ang - 0.45, ang + 0.45); g.stroke();
          }
        });
      }
      case 'drain': {
        const from = this.host.centerOf(this.side(s.from, cast, 'target')), to = this.host.centerOf(this.side(s.to, cast, 'user'));
        const n = s.count ?? 6, seeds = Array.from({ length: n }, () => ({ off: rnd(-30, 30), ph: rnd(0, 6) }));
        return this.withEffect(s.ms ?? 650, (g, t) => {
          seeds.forEach((sd, k) => {
            const lt = (t - (k / n) * 0.45) / 0.55; if (lt <= 0 || lt >= 1) return;
            const x = from.x + (to.x - from.x) * lt, y = from.y + (to.y - from.y) * lt + Math.sin(lt * Math.PI) * sd.off + Math.sin(lt * 9 + sd.ph) * 4;
            g.globalAlpha = lt > 0.85 ? (1 - lt) / 0.15 : 1;
            drawShape(g, 'orb', x, y, 9, s.color, 0, this.host.font);
          });
        });
      }
    }
  }

  private async projectile(s: Extract<AnimStep, { do: 'projectile' }>, cast: Cast) {
    const fromSide = this.side(s.from, cast, 'user'), toSide = this.side(s.to, cast, 'target');
    const a = this.host.centerOf(fromSide), b = this.host.centerOf(toSide === fromSide ? other(fromSide) : toSide);
    if (toSide === fromSide) { b.x = (a.x + b.x) / 2; b.y = a.y - 60; } // self: toss it up
    const n = s.count ?? 1, gapF = this.frames(s.gap ?? 70), flyF = this.frames(s.ms ?? 380), total = flyF + gapF * (n - 1);
    const shape = s.shape ?? 'orb', size = s.size ?? 12, arc = s.arc ?? 0, spread = s.spread ?? 0;
    const shots = Array.from({ length: n }, () => ({ ex: rnd(-spread, spread), ey: rnd(-spread, spread) * 0.6 }));
    const spin = shape === 'star' || shape === 'rock' || shape === 'leaf';
    const pos = (k: number, t: number) => {
      const ex = b.x + shots[k].ex, ey = b.y + shots[k].ey;
      return { x: a.x + (ex - a.x) * t, y: a.y + (ey - a.y) * t - arc * 4 * t * (1 - t) };
    };
    const ms = (total / FPS) * 1000 * this.speed;
    await this.withEffect(ms, (g, _t, i) => {
      for (let k = 0; k < n; k++) {
        const t = (i - k * gapF) / flyF; if (t < 0 || t > 1) continue;
        const p = pos(k, t), q = pos(k, Math.max(0, t - 0.05));
        const rot = spin ? i * 0.35 : Math.atan2(p.y - q.y, p.x - q.x);
        for (let tr = 3; tr >= 1; tr--) { // a short fading trail
          const tp = pos(k, Math.max(0, t - tr * 0.04));
          g.globalAlpha = 0.18 * (4 - tr);
          drawShape(g, shape, tp.x, tp.y, size * (1 - tr * 0.12), s.color, rot, this.host.font);
        }
        g.globalAlpha = 1;
        drawShape(g, shape, p.x, p.y, size, s.color, rot, this.host.font);
      }
    });
  }

  private async beam(s: Extract<AnimStep, { do: 'beam' }>, cast: Cast) {
    const fromSide = this.side(s.from, cast, 'user'), toSide = this.side(s.to, cast, 'target');
    const a = this.host.centerOf(fromSide), b = this.host.centerOf(toSide === fromSide ? other(fromSide) : toSide);
    const w = s.width ?? 12, wob = s.wobble ?? 0.25;
    await this.withEffect(s.ms ?? 450, (g, t, i) => {
      const head = Math.min(1, t / 0.35), fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      const hx = a.x + (b.x - a.x) * head, hy = a.y + (b.y - a.y) * head;
      const ww = w * (1 + wob * Math.sin(i * 0.9)) * fade;
      g.lineCap = 'round';
      g.globalAlpha = 0.45 * fade; g.strokeStyle = s.color; g.lineWidth = ww * 1.8;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(hx, hy); g.stroke();
      g.globalAlpha = fade; g.lineWidth = ww;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1, ww * 0.35);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(hx, hy); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(hx, hy, ww * 0.9, 0, Math.PI * 2); g.fill();
    });
  }

  private async particles(s: Extract<AnimStep, { do: 'particles' }>, cast: Cast) {
    const preset = PRESETS[s.preset];
    const screen = s.at === 'screen', c = this.at(s.at, cast, 'target');
    const F = this.frames(s.ms ?? 600), n = s.count ?? preset.count ?? 12, R = s.radius ?? (screen ? 256 : 36);
    const color = s.color ?? preset.color;
    const ps: Particle[] = Array.from({ length: n }, (_, k) => ({
      x: c.x, y: c.y, vx: 0, vy: 0, ay: 0, drag: 1, sway: 0, age: 0, life: F, delay: 0, size: 6, grow: 0, alpha: 1,
      color, shape: 'orb', rot: 0, vr: 0, orient: false, ...preset.make({ c, R, F, k, n, screen })
    }));
    const sp = this.speed;
    await this.withEffect((F / FPS) * 1000 * sp, g => {
      for (const p of ps) {
        if (p.delay > 0 || p.age >= p.life) continue;
        const t = p.age / p.life;
        g.globalAlpha = p.alpha * (t < 0.15 ? t / 0.15 : 1 - Math.max(0, t - 0.5) / 0.5);
        const rot = p.orient ? Math.atan2(p.vy, p.vx) : p.rot;
        drawShape(g, p.shape, p.x + Math.sin(p.age / 6) * p.sway * 6, p.y, Math.max(1, p.size), p.color, rot, this.host.font);
      }
      // advance after drawing, scaled to battle speed so fast mode covers the same distance
      for (const p of ps) {
        if (p.delay > 0) { p.delay--; continue; }
        p.age++;
        for (let k = 0; k < sp; k++) { p.vx *= p.drag; p.vy = p.vy * p.drag + p.ay; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.size += p.grow; }
      }
    });
  }
}

// ---------- particle presets ----------
interface Spawn { c: Point; R: number; F: number; k: number; n: number; screen: boolean }
type Preset = { color: string; count?: number; make(s: Spawn): Partial<Particle> };
const ring = (s: Spawn, r = s.R) => { const a = rnd(0, Math.PI * 2); return { a, x: s.c.x + Math.cos(a) * r, y: s.c.y + Math.sin(a) * r }; };
const outward = (s: Spawn, v0: number, v1: number) => { const a = rnd(0, Math.PI * 2), v = rnd(v0, v1); return { vx: Math.cos(a) * v, vy: Math.sin(a) * v }; };
const stagger = (s: Spawn, part = 0.35) => Math.floor((s.k / s.n) * s.F * part);
const life = (s: Spawn, part = 0.6) => Math.max(6, Math.floor(s.F * part));

const PRESETS: Record<AnimPreset, Preset> = {
  sparks: { color: '#ffe14a', make: s => ({ shape: 'spark', orient: true, ...outward(s, 2.5, 5), drag: 0.88, size: rnd(8, 12), delay: stagger(s), life: life(s, 0.45) }) },
  embers: { color: '#ff8a2a', make: s => ({ x: s.c.x + rnd(-s.R, s.R), y: s.c.y + rnd(-s.R / 3, s.R / 2), vx: rnd(-0.4, 0.4), vy: rnd(-2.6, -1), size: rnd(4, 7), grow: -0.06, delay: stagger(s), life: life(s) }) },
  leaves: { color: '#6cc24a', make: s => { const p = ring(s, s.R * 1.2); return { shape: 'leaf', x: p.x, y: p.y, vx: -Math.sin(p.a) * 3 - Math.cos(p.a) * 0.8, vy: Math.cos(p.a) * 3 - Math.sin(p.a) * 0.8, vr: rnd(-0.3, 0.3), rot: rnd(0, 6), size: rnd(8, 12), delay: stagger(s), life: life(s) }; } },
  petals: { color: '#f7a8c8', make: s => ({ shape: 'leaf', x: s.c.x + rnd(-s.R * 1.3, s.R * 1.3), y: s.c.y - s.R - rnd(0, 30), vy: rnd(1, 2), sway: 1.2, rot: rnd(0, 6), vr: rnd(-0.1, 0.1), size: rnd(6, 9), delay: stagger(s, 0.4), life: life(s) }) },
  bubbles: { color: '#8fd3ff', make: s => ({ shape: 'ring', x: s.c.x + rnd(-s.R, s.R), y: s.c.y + rnd(-s.R / 2, s.R / 2), vy: rnd(-1.6, -0.5), sway: 0.8, size: rnd(6, 12), delay: stagger(s), life: life(s) }) },
  snow: { color: '#ffffff', count: 40, make: s => ({ x: s.c.x + rnd(-s.R, s.R), y: s.c.y - (s.screen ? 150 : s.R) - rnd(0, 20), vy: rnd(1, 2.4), vx: rnd(-0.6, 0.2), sway: 0.6, size: rnd(3, 6), delay: stagger(s, 0.5), life: life(s, 0.5) }) },
  smoke: { color: '#a0a0a8', make: s => ({ x: s.c.x + rnd(-s.R / 2, s.R / 2), y: s.c.y + rnd(-10, s.R / 2), vx: rnd(-0.6, 0.6), vy: rnd(-0.9, -0.3), size: rnd(12, 20), grow: 0.35, alpha: 0.55, delay: stagger(s), life: life(s, 0.7) }) },
  stars: { color: '#fff6a0', make: s => ({ shape: 'star', ...outward(s, 1.5, 3.5), drag: 0.93, vr: 0.2, size: rnd(8, 12), delay: stagger(s, 0.25), life: life(s, 0.6) }) },
  rocks: { color: '#a08a5a', make: s => ({ shape: 'rock', x: s.c.x + rnd(-s.R, s.R), y: s.c.y - s.R - rnd(30, 60), vy: rnd(1.5, 3), ay: 0.35, vr: rnd(-0.15, 0.15), size: rnd(8, 14), delay: stagger(s, 0.4), life: life(s, 0.45) }) },
  shadows: { color: '#3a2b4a', make: s => { const p = ring(s, s.R * 1.5); const l = life(s, 0.6); return { x: p.x, y: p.y, vx: (s.c.x - p.x) / l, vy: (s.c.y - p.y) / l, size: rnd(10, 16), alpha: 0.75, delay: stagger(s), life: l }; } },
  drops: { color: '#5fa8ff', make: s => ({ shape: 'drop', x: s.c.x + rnd(-10, 10), y: s.c.y + rnd(-6, 6), vx: rnd(-3, 3), vy: rnd(-4.5, -1.5), ay: 0.32, size: rnd(6, 9), delay: stagger(s, 0.3), life: life(s, 0.55) }) },
  notes: { color: '#ffffff', make: s => ({ shape: 'note', x: s.c.x + rnd(-s.R / 2, s.R / 2), y: s.c.y, vx: rnd(-1.6, 1.6), vy: rnd(-1.8, -0.8), sway: 0.6, size: rnd(12, 15), delay: stagger(s, 0.4), life: life(s) }) },
  zs: { color: '#ffffff', count: 3, make: s => ({ shape: 'z', x: s.c.x + 12, y: s.c.y - 16, vx: 0.8, vy: -1, grow: 0.15, size: 10, delay: stagger(s, 0.55), life: life(s, 0.45) }) },
  hearts: { color: '#ff7aa8', make: s => ({ shape: 'heart', x: s.c.x + rnd(-s.R, s.R), y: s.c.y + rnd(-s.R / 3, s.R / 2), vy: rnd(-1.6, -0.6), sway: 0.6, size: rnd(9, 13), delay: stagger(s), life: life(s) }) },
  arrowsUp: { color: '#5fb0ff', count: 8, make: s => ({ shape: 'arrow', rot: -Math.PI / 2, x: s.c.x + rnd(-s.R * 0.9, s.R * 0.9), y: s.c.y + s.R * 0.7, vy: -2.6, size: rnd(10, 14), delay: stagger(s, 0.45), life: life(s, 0.45) }) },
  arrowsDown: { color: '#ff6b5a', count: 8, make: s => ({ shape: 'arrow', rot: Math.PI / 2, x: s.c.x + rnd(-s.R * 0.9, s.R * 0.9), y: s.c.y - s.R * 0.8, vy: 2.6, size: rnd(10, 14), delay: stagger(s, 0.45), life: life(s, 0.45) }) },
  rain: { color: '#9cc8ff', count: 60, make: s => ({ shape: 'streak', orient: true, x: rnd(-40, SCENE.w + 60), y: rnd(-60, 0), vx: -2, vy: 10, size: 14, alpha: 0.8, delay: stagger(s, 0.65), life: 36 }) },
  sand: { color: '#d9b878', count: 50, make: s => ({ shape: 'streak', orient: true, x: rnd(-60, 0), y: rnd(0, SCENE.h), vx: rnd(6, 10), vy: rnd(-0.6, 0.6), size: rnd(6, 10), alpha: 0.85, delay: stagger(s, 0.65), life: 70 }) },
  rays: { color: '#fff3a0', count: 14, make: s => ({ x: rnd(0, SCENE.w), y: rnd(0, SCENE.h * 0.6), vy: 0.4, size: rnd(18, 36), alpha: 0.3, delay: stagger(s, 0.5), life: life(s, 0.5) }) },
  dust: { color: '#c9b080', make: s => ({ x: s.c.x + rnd(-s.R / 2, s.R / 2), y: s.c.y + s.R * 0.7, vx: rnd(-2.6, 2.6), vy: rnd(-1.1, -0.2), drag: 0.96, size: rnd(6, 11), grow: 0.2, alpha: 0.75, delay: stagger(s, 0.25), life: life(s) }) },
  feathers: { color: '#ffffff', make: s => ({ shape: 'feather', x: s.c.x + rnd(-s.R * 1.2, s.R * 1.2), y: s.c.y - s.R - rnd(0, 20), vy: rnd(0.8, 1.6), sway: 1.4, rot: rnd(-0.6, 0.6), vr: rnd(-0.05, 0.05), size: rnd(10, 14), delay: stagger(s, 0.4), life: life(s) }) },
  ice: { color: '#bfefff', make: s => ({ shape: 'shard', orient: true, ...outward(s, 1.8, 3.6), drag: 0.92, size: rnd(8, 12), delay: stagger(s, 0.25), life: life(s, 0.55) }) },
  spores: { color: '#d8ef7a', make: s => ({ x: s.c.x + rnd(-s.R, s.R), y: s.c.y - s.R - rnd(0, 20), vy: rnd(0.6, 1.4), sway: 0.9, size: rnd(3, 5), delay: stagger(s, 0.45), life: life(s) }) },
  glow: { color: '#9fffb0', make: s => ({ x: s.c.x + rnd(-s.R, s.R), y: s.c.y + rnd(-s.R / 3, s.R / 2), vy: rnd(-1.4, -0.6), size: rnd(6, 10), alpha: 0.8, delay: stagger(s), life: life(s) }) }
};

// ---------- shapes ----------
const ROCK = [1, 0.78, 1, 0.9, 0.72, 0.95];
/** Sizes in timelines are in battle-screen pixels at 1x; sprites are drawn at 2x, so effects scale up to match. */
const SHAPE_SCALE = 1.5;
export function drawShape(g: CanvasRenderingContext2D, shape: AnimShape, x: number, y: number, s: number, color: string, rot: number, font: string) {
  s *= SHAPE_SCALE;
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.fillStyle = color; g.strokeStyle = color;
  switch (shape) {
    case 'orb': {
      g.beginPath(); g.arc(0, 0, s / 2, 0, Math.PI * 2); g.fill();
      g.globalAlpha *= 0.7; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-s * 0.12, -s * 0.12, s / 5, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'ring': g.lineWidth = 2; g.beginPath(); g.arc(0, 0, s / 2, 0, Math.PI * 2); g.stroke(); break;
    case 'shard': g.beginPath(); g.moveTo(s, 0); g.lineTo(0, s * 0.3); g.lineTo(-s * 0.6, 0); g.lineTo(0, -s * 0.3); g.closePath(); g.fill(); break;
    case 'leaf': {
      g.beginPath(); g.ellipse(0, 0, s * 0.6, s * 0.26, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha *= 0.5; g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.moveTo(-s * 0.5, 0); g.lineTo(s * 0.5, 0); g.stroke();
      break;
    }
    case 'feather': {
      g.beginPath(); g.ellipse(0, 0, s * 0.55, s * 0.18, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#9aa3b5'; g.lineWidth = 1; g.beginPath(); g.moveTo(-s * 0.7, 0); g.lineTo(s * 0.55, 0); g.stroke();
      break;
    }
    case 'star': {
      g.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? s * 0.22 : s * 0.55, a = (k / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill();
      break;
    }
    case 'note': {
      g.rotate(-rot);
      g.beginPath(); g.ellipse(-s * 0.18, s * 0.32, s * 0.22, s * 0.16, -0.4, 0, Math.PI * 2); g.fill();
      g.fillRect(s * 0.02, -s * 0.5, 2, s * 0.84); g.fillRect(s * 0.02, -s * 0.5, s * 0.3, 3);
      break;
    }
    case 'drop': {
      g.rotate(-rot);
      g.beginPath(); g.arc(0, s * 0.15, s * 0.35, 0, Math.PI); g.lineTo(0, -s * 0.55); g.closePath(); g.fill();
      break;
    }
    case 'rock': {
      g.beginPath();
      ROCK.forEach((r, k) => { const a = (k / ROCK.length) * Math.PI * 2; g.lineTo(Math.cos(a) * r * s / 2, Math.sin(a) * r * s / 2); });
      g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
      break;
    }
    case 'spark': {
      g.lineWidth = 2.5; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-s / 2, 0); g.lineTo(-s / 6, -s / 4); g.lineTo(s / 6, s / 4); g.lineTo(s / 2, 0); g.stroke();
      break;
    }
    case 'heart': {
      g.rotate(-rot);
      const r = s * 0.27;
      g.beginPath(); g.arc(-r, -r * 0.4, r, Math.PI * 0.75, Math.PI * 2); g.arc(r, -r * 0.4, r, Math.PI, Math.PI * 0.25); g.lineTo(0, s * 0.5); g.closePath(); g.fill();
      break;
    }
    case 'arrow': {
      g.beginPath(); g.moveTo(s * 0.5, 0); g.lineTo(0, -s * 0.4); g.lineTo(0, s * 0.4); g.closePath(); g.fill();
      g.fillRect(-s * 0.5, -s * 0.14, s * 0.52, s * 0.28);
      break;
    }
    case 'streak': g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-s, 0); g.stroke(); break;
    case 'z': {
      g.rotate(-rot);
      g.font = `bold ${Math.round(s * 1.4)}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 3; g.strokeStyle = '#26324a'; g.strokeText('Z', 0, 0); g.fillText('Z', 0, 0);
      break;
    }
  }
  g.restore();
}
