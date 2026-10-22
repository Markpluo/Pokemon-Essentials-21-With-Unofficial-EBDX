// The shared test bot. It plays the real game in a browser with the keyboard, like a player:
// it reads what the screen is asking for (window.__hafnia.probe()) and presses keys.
//
//   import { test, expect } from '../lib/bot';
//   test('my feature', async ({ bot }) => {
//     await bot.boot();
//     await bot.newGame();
//     await bot.walkTo(6, 6);
//     await bot.shot('flat');
//   });
//
// Every test fails on a page error or console error, and keeps a transcript of what was said.
import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import type { Dir, SaveData, SaveSlot } from '@hafnia/core';
import type { Probe } from '../../apps/client/src/main';
import { doorOf, findPath, mapDef, mapKey, solid, world, DIRS } from './world';

export { expect };
export type { Probe };

type Key = Dir | 'A' | 'B' | 'MENU';
const KEYS: Record<Key, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', A: 'z', B: 'x', MENU: 'c' };
type Match = string | RegExp | number;

/** How to answer a prompt: when the question (or one of the options) matches `when`, pick `pick`. */
export interface Answer { when?: RegExp; pick: Match; once?: boolean }

/** What to do in battle. `fight` uses the strongest move, `coil` does too but spends the Copper & Current Coil
 *  (Current, else Copper) as soon as it is charged, `catch` throws Poké Balls at wild Pokémon, `run` flees.
 *  A function decides each turn. */
export type BattlePlan = 'fight' | 'coil' | 'catch' | 'run' | ((s: Probe) => BattleChoice);
export type BattleChoice = { move: number | string; coil?: 'copper' | 'current' | 'harmony'; target?: number } | { ball: string } | { run: true } | { switchTo: number | string };

export interface SettleOptions {
  /** Max time to wait for the overworld to be free again. */
  timeout?: number;
  /** Stop early (returns true) once this is true. */
  until?: (s: Probe) => boolean;
  battle?: BattlePlan;
  /** Character look on the new-game picker ('boy' / 'girl') and the starter (name or index). */
  pickLook?: Match;
  pickStarter?: Match;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class Bot {
  /** Every line the game showed, in order (deduplicated). */
  readonly said: string[] = [];
  /** Answers for prompts, checked before the default (first option). Push your own. */
  readonly answers: Answer[] = [];
  battlePlan: BattlePlan = 'fight';
  /** Name to pick on name screens (must be one of the suggestions; typing is not automated). */
  name = 'Mark';
  /** Results of finished battles: 'win' | 'lose' | 'caught' | 'run' (as far as the bot can tell). */
  readonly battles: { kind: string; trainer: string | null; foe: string | null; result: string }[] = [];
  private errors: string[] = [];
  private allowed: RegExp[] = [];
  private shots = 0;

  constructor(readonly page: Page, readonly info: TestInfo) {
    page.on('pageerror', e => this.errors.push(`pageerror: ${e.message}`));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const url = m.location()?.url ?? '';
      // Third-party resources (web fonts) may fail offline; that's not a game bug.
      if (/Failed to load resource/.test(m.text()) && url && !url.startsWith(info.project.use.baseURL ?? '')) return;
      this.errors.push(`console.error: ${m.text()}`);
    });
  }

  // ---------- starting ----------

  /** Opens the game and waits for the title screen. By default battle animations and sound are off and the
   *  game runs 4x fast (BOT_SPEED overrides; `speed: 1` for real time, e.g. when judging animations). */
  async boot(opts: { animations?: 'on' | 'fast' | 'off'; sound?: boolean; speed?: number } = {}) {
    await world();
    await this.page.addInitScript(mode => { try { localStorage.setItem('hafnia.anim', mode); } catch { /* ignore */ } }, opts.animations ?? 'off');
    const speed = opts.speed ?? (Number(process.env.BOT_SPEED) || 4);
    await this.page.goto(`play.html?speed=${speed}`);
    await this.page.waitForFunction(() => (window as any).__hafnia?.G.scene === 'title', null, { timeout: 60_000 });
    if (!opts.sound) await this.page.click('#mute');
    return this.state();
  }

  /** Title -> New game -> name and look -> the intro until you can move. */
  async newGame(opts: { name?: string; look?: 'boy' | 'girl' } = {}) {
    await this.titleChoice('New game');
    this.name = opts.name ?? 'Mark';
    await this.settle({ pickLook: opts.look ?? 'boy' });
    return this.state();
  }

  /** Title -> Continue (and the slot, when there are several saves). */
  async continueGame(slot?: SaveSlot) {
    await this.titleChoice('Continue');
    const s = await this.state();
    if (s.choice) await this.choose(slot === undefined ? 0 : slot === 'auto' ? /^Autosave/ : new RegExp(`^Slot ${slot}`));
    await this.waitFor(s => s.scene === 'overworld' && s.fade === 0, 30_000, 'the game to load');
    await this.settle();
    return this.state();
  }

  /** Writes a save into the browser's storage and reloads to the title. Use with saves.ts. */
  async loadSave(save: SaveData | Promise<SaveData>, slot: SaveSlot = 1) {
    save = await save;
    if (!this.page.url().includes('play.html')) await this.boot();
    await this.page.evaluate(async ({ save, key }) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('copper-current', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('saves');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(save, key);
          tx.oncomplete = () => { req.result.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
      });
    }, { save, key: slot === 'auto' ? 'auto' : `slot${slot}` });
    await this.reload();
    return this.continueGame(slot);
  }

  /** Title -> the given title-menu option. */
  async titleChoice(label: string) {
    await this.waitFor(s => s.scene === 'title', 30_000, 'the title screen');
    await this.waitFor(s => !!s.choice, 10_000, 'the title menu', async () => this.tap('A'));
    await this.choose(label);
  }

  // ---------- reading the screen ----------

  state(): Promise<Probe> { return this.page.evaluate(() => (window as any).__hafnia.probe()); }

  /** The overworld is free: no text, menu, picker, fade, step or request in flight. */
  static idle(s: Probe) {
    return s.scene === 'overworld' && !s.busy && !s.lock && !s.text && !s.choice && !s.picker && !s.overlays && s.fade === 0 && !s.moving;
  }

  async waitFor(pred: (s: Probe) => boolean, timeout = 15_000, what = 'a condition', each?: () => Promise<void>) {
    const end = Date.now() + timeout;
    let s = await this.state();
    while (!pred(s)) {
      if (Date.now() > end) throw new Error(`Bot timed out waiting for ${what}.\n${this.describe(s)}`);
      if (each) await each();
      await sleep(15);
      s = await this.state();
    }
    return s;
  }

  describe(s: Probe) {
    return [
      `scene=${s.scene} map=${s.map} at ${s.x},${s.y} facing ${s.dir} busy=${s.busy} lock=${s.lock} fade=${s.fade.toFixed(2)} overlays=${s.overlays}`,
      s.text ? `text: ${JSON.stringify(s.text)}` : '', s.choice ? `choice: ${JSON.stringify(s.choice)}` : '', s.picker ? `picker: ${JSON.stringify(s.picker)}` : '',
      s.battle ? `battle: ${s.battle.kind} ${s.battle.ally?.name} ${s.battle.ally?.hp}/${s.battle.ally?.maxhp} vs ${s.battle.foe?.name} ${s.battle.foe?.hp}/${s.battle.foe?.maxhp} grid=${s.battle.grid?.key ?? '-'}` : '',
      `last said: ${this.said.slice(-5).join(' | ')}`
    ].filter(Boolean).join('\n');
  }

  // ---------- input ----------

  /** A short key tap (one press the game sees once). */
  async tap(k: Key) {
    await this.page.keyboard.down(KEYS[k]);
    await sleep(25);
    await this.page.keyboard.up(KEYS[k]);
    await this.frames(2);
  }

  /** Waits for n game frames. */
  async frames(n = 1) {
    await this.page.evaluate(n => new Promise<void>(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  }

  private matches(m: Match, label: string, i: number) {
    return typeof m === 'number' ? m === i : typeof m === 'string' ? label === m || label.startsWith(m) : m.test(label);
  }

  /** Picks an option in the open menu by label (exact or prefix), regex or index. */
  async choose(m: Match) {
    let s = await this.waitFor(s => !!s.choice, 10_000, `a menu to pick ${String(m)}`);
    const opts = s.choice!.options;
    const target = opts.findIndex((o, i) => this.matches(m, o, i));
    if (target < 0) throw new Error(`No option ${String(m)} in ${JSON.stringify(opts)}\n${this.describe(s)}`);
    for (let guard = 0; s.choice && s.choice.idx !== target && guard < 40; guard++) {
      const n = opts.length, down = (target - s.choice.idx + n) % n;
      await this.tap(down <= n / 2 ? 'down' : 'up');
      s = await this.state();
    }
    const id = s.choice!.id;
    await this.tap('A');
    await this.waitFor(s => s.choice?.id !== id, 5_000, 'the menu to close');
  }

  /** Left/right pickers (starters, character look) and the party screen. */
  async pick(m: Match, how: { shot?: string } = {}) {
    let s = await this.waitFor(s => !!s.picker, 10_000, `a picker to pick ${String(m)}`);
    const opts = s.picker!.options;
    const target = opts.findIndex((o, i) => this.matches(m, o, i));
    if (target < 0) throw new Error(`No option ${String(m)} in picker ${JSON.stringify(opts)}`);
    const [back, fwd]: Key[] = s.picker!.kind === 'party' ? ['up', 'down'] : ['left', 'right'];
    for (let guard = 0; s.picker && s.picker.idx !== target && guard < 20; guard++) {
      await this.tap(target > s.picker.idx ? fwd : back);
      s = await this.state();
    }
    if (how.shot) await this.shot(how.shot);
    await this.tap('A');
  }

  // ---------- the autopilot ----------

  /** Clicks through whatever the game shows (text, prompts, pickers, battles) until the overworld is free again.
   *  Prompts use `bot.answers` and then the first option; battles use `opts.battle` or `bot.battlePlan`. */
  async settle(opts: SettleOptions = {}) {
    const end = Date.now() + (opts.timeout ?? 120_000);
    let idleSince = 0, lastText = '';
    let battle: Probe['battle'] = null;
    for (;;) {
      const s = await this.state();
      if (opts.until?.(s)) return true;
      if (Date.now() > end) throw new Error(`Bot could not get back to the overworld.\n${this.describe(s)}`);
      if (s.text && s.text !== lastText) { lastText = s.text; if (this.said.at(-1) !== s.text) this.said.push(s.text); }
      if (s.battle) battle = s.battle;
      else if (battle && s.scene === 'overworld') { this.recordBattle(battle); battle = null; }

      if (Bot.idle(s)) {
        if (!idleSince) idleSince = Date.now();
        if (Date.now() - idleSince > 80) return false;
        await sleep(30); continue;
      }
      idleSince = 0;

      if (s.picker) {
        if (s.picker.kind === 'look') await this.pick(opts.pickLook ?? 0);
        else if (s.picker.kind === 'species') await this.pick(opts.pickStarter ?? 0);
        else if (s.picker.kind === 'party') await this.pick(this.healthyIndex(s));
        else await this.tap('B');   // summary, Pokédex, PC box, options: back out
        continue;
      }
      if (s.battle?.grid) { await this.battleTurn(s, opts.battle ?? this.battlePlan); continue; }
      // The start menu reopens after most actions; the autopilot always closes it.
      if (s.choice && s.scene === 'overworld' && s.choice.options.at(-1) === 'Close' && s.choice.options.includes('Save')) { await this.choose('Close'); continue; }
      if (s.choice) { await this.choose(this.answerFor(s)); continue; }
      if (s.text) { await this.tap('A'); continue; }
      // Chapter cards and other full-screen overlays that wait for A.
      if (s.overlays && s.scene !== 'battle') { await sleep(200); const again = await this.state(); if (again.overlays && !again.text && !again.choice) await this.tap('A'); continue; }
      await sleep(30);
    }
  }

  private answerFor(s: Probe): Match {
    const c = s.choice!;
    if (c.options.at(-1) === 'Type a name...') return Math.max(0, c.options.indexOf(this.name));
    const hay = [s.text ?? '', ...c.options].join('\n');
    const i = this.answers.findIndex(a => !a.when || a.when.test(hay));
    if (i < 0) return c.options.includes('Log off') ? 'Log off' : 0;   // the PC menu: leave it
    const a = this.answers[i];
    if (a.once) this.answers.splice(i, 1);
    return a.pick;
  }

  private healthyIndex(s: Probe) {
    const party = s.battle?.request?.party ?? s.world?.party ?? [];
    const active = s.battle?.request?.activeUid;
    const i = party.findIndex(p => p.hp > 0 && p.uid !== active);
    return Math.max(0, i);
  }

  private recordBattle(b: NonNullable<Probe['battle']>) {
    const lastLines = this.said.slice(-6).join(' ');
    const result = /caught|was caught/i.test(lastLines) ? 'caught' : /Got away safely|fled/i.test(lastLines) ? 'run'
      : /whited out|blacked out|out of usable/i.test(lastLines) ? 'lose' : 'win';
    this.battles.push({ kind: b.kind, trainer: b.trainer, foe: b.foe?.name ?? null, result });
  }

  /** One decision on the battle screen's grid (command menu or move menu). */
  private async battleTurn(s: Probe, plan: BattlePlan) {
    const b = s.battle!, grid = b.grid!, req = b.request;
    const choice: BattleChoice = typeof plan === 'function' ? plan(s)
      : plan === 'run' ? { run: true }
      : plan === 'catch' && b.kind === 'wild' ? { ball: 'Poké Ball' }
      : plan === 'coil' && req?.coil && (req.coil.current === null || req.coil.copper === null)
        ? { move: this.bestMove(req), coil: req.coil.current === null ? 'current' : 'copper' }
      : { move: this.bestMove(req) };
    if (grid.key === 'cmd') {
      if ('run' in choice) return this.gridPick(3);
      if ('ball' in choice) { await this.gridPick(1); await this.choose(new RegExp(`^${choice.ball}`)); return; }
      if ('switchTo' in choice) { await this.gridPick(2); await this.pick(choice.switchTo); return; }
      return this.gridPick(0);
    }
    if (grid.key === 'move' && 'move' in choice) {
      const moves = req?.moves ?? [];
      const mi = typeof choice.move === 'number' ? choice.move : moves.findIndex(m => m.name === choice.move || m.id === choice.move);
      if (mi < 0) throw new Error(`No move ${String(choice.move)}: ${moves.map(m => m.name).join(', ')}`);
      if (choice.coil) {
        const toggle = grid.items.findIndex(it => it.label.toLowerCase().startsWith(choice.coil!));
        if (toggle < 0) throw new Error(`The Coil is not online in this battle (no ${choice.coil} toggle)`);
        if (!grid.items[toggle].label.includes('✓')) { await this.gridPick(toggle); await this.waitFor(x => !!x.battle?.grid || !!x.text, 5000, 'the move menu'); const again = await this.state(); if (!again.battle?.grid) return; }
      }
      return this.gridPick(mi);
    }
    // Multi battles: which foe a single-target move hits (default: the first one listed).
    if (grid.key === 'target') return this.gridPick('move' in choice ? Math.min(choice.target ?? 0, grid.items.length - 1) : 0);
    // In the move menu but this turn is not a move: back out.
    await this.tap('B');
  }

  private bestMove(req: NonNullable<Probe['battle']>['request']) {
    const moves = req?.moves ?? [];
    let best = -1, power = -1;
    moves.forEach((m, i) => { if (!m.disabled && m.pp > 0 && m.power > power) { best = i; power = m.power; } });
    return Math.max(0, best);
  }

  /** Moves the battle grid cursor to `target` and confirms. */
  async gridPick(target: number) {
    let s = await this.state();
    for (let guard = 0; guard < 12; guard++) {
      const g = s.battle?.grid;
      if (!g) return;
      if (g.idx === target) break;
      const [r0, c0, r1, c1] = [Math.floor(g.idx / g.cols), g.idx % g.cols, Math.floor(target / g.cols), target % g.cols];
      await this.tap(r1 > r0 ? 'down' : r1 < r0 ? 'up' : c1 > c0 ? 'right' : 'left');
      s = await this.state();
    }
    await this.tap('A');
  }

  /** Runs one whole battle with a plan (the bot must already be in it or about to be). */
  async fight(plan: BattlePlan = 'fight') {
    const before = this.battles.length;
    await this.waitFor(s => s.scene === 'battle' || !!s.battle, 30_000, 'a battle to start', async () => { const s = await this.state(); if (s.text) await this.tap('A'); });
    await this.settle({ battle: plan, timeout: 180_000 });
    return this.battles[before] ?? this.battles.at(-1);
  }

  // ---------- moving around ----------

  /** One step (or a turn plus a step). Returns false when blocked. */
  async step(dir: Dir, opts: { settle?: boolean } = {}): Promise<boolean> {
    const s0 = await this.waitFor(Bot.idle, 15_000, 'the overworld to be free');
    await this.page.keyboard.down(KEYS[dir]);
    let s = s0, moved = false;
    try {
      const end = Date.now() + 1500;
      for (;;) {
        s = await this.state();
        if (s.moving || s.x !== s0.x || s.y !== s0.y || s.map !== s0.map || s.text || s.choice || s.scene !== 'overworld' || s.fade > 0) { moved = true; break; }
        if (Date.now() > end) break;
        await sleep(10);
      }
    } finally { await this.page.keyboard.up(KEYS[dir]); }
    if (!moved) return false;
    await this.waitFor(s => !s.moving, 5000, 'the step to finish');
    if (opts.settle !== false) await this.settle();
    return true;
  }

  /** Turns to face a direction without stepping. */
  async face(dir: Dir) {
    const s = await this.waitFor(Bot.idle, 15_000, 'the overworld to be free');
    if (s.dir === dir) return;
    await this.tap(dir);
    await this.waitFor(x => x.dir === dir || !Bot.idle(x), 3000, `facing ${dir}`);
  }

  /** Walks to (x, y) on the current map, re-planning around NPCs, fighting whatever jumps out.
   *  Stops early if the map changes. Never steps on the `avoid` tiles. */
  async walkTo(x: number, y: number, avoid: [number, number][] = []) {
    for (let guard = 0; guard < 600; guard++) {
      const s = await this.waitFor(Bot.idle, 30_000, 'the overworld to be free');
      if (s.x === x && s.y === y) return s;
      const path = findPath(s.map, s.x, s.y, x, y, s.world?.npcs ?? [], avoid);
      if (!path) throw new Error(`No path to ${x},${y}.\n${this.describe(s)}`);
      const map = s.map;
      if (!(await this.step(path[0])) && !(await this.step(path[0]))) { // the first press may only turn
        const now = await this.state();
        if (now.x === s.x && now.y === s.y && now.map === map) throw new Error(`walkTo(${x}, ${y}): blocked going ${path[0]}.\n${this.describe(now)}`);
      }
      const after = await this.state();
      if (after.map !== map) return after;
    }
    throw new Error(`walkTo(${x}, ${y}) gave up.\n${this.describe(await this.state())}`);
  }

  /** Walks into the nearest tall grass and paces until a wild Pokémon appears, then fights it with `plan`.
   *  Returns the battle record. */
  async wildBattle(plan: BattlePlan = this.battlePlan, maxSteps = 300) {
    let s = await this.waitFor(Bot.idle);
    const m = mapDef(s.map), grass = m.encounterTile ?? 'g';
    const tiles: [number, number][] = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.grid[y][x] === grass) tiles.push([x, y]);
    // A grass tile with a grass neighbour, nearest first, so the bot can pace between the two.
    const pairs = tiles.flatMap(([x, y]) => (Object.entries(DIRS) as [Dir, [number, number]][])
      .filter(([, [dx, dy]]) => m.grid[y + dy]?.[x + dx] === grass).map(([d]) => ({ x, y, d })))
      .map(p => ({ ...p, path: findPath(s.map, s.x, s.y, p.x, p.y, s.world?.npcs ?? []) }))
      .filter(p => p.path).sort((a, b) => a.path!.length - b.path!.length);
    if (!pairs.length) throw new Error(`No tall grass to pace in on ${s.map}`);
    const { x, y, d } = pairs[0];
    const back: Dir = ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[d];
    const before = this.battles.length;
    const inBattle = (s: Probe) => s.scene === 'battle' || !!s.battle;
    for (const dir of findPath(s.map, s.x, s.y, x, y, s.world?.npcs ?? [])!) {
      await this.step(dir, { settle: false });
      s = await this.state();
      if (inBattle(s) || s.text) break;
    }
    for (let i = 0; i < maxSteps && !inBattle(s) && !s.text; i++) {
      await this.step(i % 2 ? back : d, { settle: false });
      await sleep(50);
      s = await this.state();
    }
    if (!inBattle(s) && !s.text) throw new Error(`No wild Pokémon after ${maxSteps} steps.\n${this.describe(s)}`);
    await this.settle({ battle: plan, timeout: 180_000 });
    return this.battles[before];
  }

  /** Walks to (x, y) and then off the map edge (or into whatever is) in `dir`. */
  async exit(dir: Dir, x: number, y: number) {
    const s = await this.walkTo(x, y);
    if (s.map !== (await this.state()).map) return this.state();
    await this.step(dir);
    await this.settle();
    return this.state();
  }

  /** Walks into a building's door by id (see the map's `buildings`). */
  async enter(building: string) {
    const s = await this.waitFor(Bot.idle);
    const [dx, dy] = doorOf(s.map, building);
    const from = ([['up', dx, dy + 1], ['down', dx, dy - 1], ['left', dx + 1, dy], ['right', dx - 1, dy]] as [Dir, number, number][])
      .find(([, x, y]) => findPath(s.map, s.x, s.y, x, y, s.world?.npcs ?? []));
    if (!from) throw new Error(`Can't reach the door of ${building}`);
    return this.exit(from[0], from[1], from[2]);
  }

  /** Walks next to (x, y), faces it and presses A, then clicks through what happens. */
  async talkTo(x: number, y: number) {
    const s = await this.waitFor(Bot.idle);
    const spots: [Dir, number, number][] = [['up', x, y + 1], ['down', x, y - 1], ['left', x + 1, y], ['right', x - 1, y]];
    const npcs = s.world?.npcs ?? [];
    const reachable = spots.filter(([, sx, sy]) => (sx === s.x && sy === s.y) || !solid(s.map, sx, sy, npcs))
      .map(([d, sx, sy]) => ({ d, sx, sy, path: sx === s.x && sy === s.y ? [] : findPath(s.map, s.x, s.y, sx, sy, npcs) }))
      .filter(o => o.path)
      .sort((a, b) => a.path!.length - b.path!.length);
    if (!reachable.length) throw new Error(`Can't reach anything next to ${x},${y}.\n${this.describe(s)}`);
    const { d, sx, sy } = reachable[0];
    const at = await this.walkTo(sx, sy);
    if (at.x !== sx || at.y !== sy) return at;
    await this.face(d);
    return this.interact();
  }

  /** Presses A in the overworld and clicks through the result. */
  async interact() {
    await this.waitFor(Bot.idle);
    await this.tap('A');
    await sleep(60);
    await this.settle();
    return this.state();
  }

  // ---------- menus and debug ----------

  /** Opens the start menu and follows labels: bot.menu('Debug', 'Heal team'). Clicks through the result. */
  async menu(...path: Match[]) {
    await this.openMenu();
    for (const p of path) await this.choose(p);
    await this.settle();
    return this.state();
  }

  /** Opens the start menu and leaves it open. */
  async openMenu() {
    await this.waitFor(Bot.idle);
    return this.waitFor(s => !!s.choice, 5000, 'the start menu', async () => { const s = await this.state(); if (Bot.idle(s)) await this.tap('MENU'); });
  }

  /** A Debug menu command by its label, e.g. 'Heal team', 'Lead +5 levels', 'Unlock Copper & Current'. */
  debug(label: Match) { return this.menu('Debug', label); }

  /** Debug-warps to a map by id ('nyhavn' or 'hafnia:nyhavn'). Only maps in the Debug menu's warp list. */
  async warp(map: string) {
    await this.debug(`Warp: ${mapDef(map).name}`);
    return this.waitFor(s => s.map === mapKey(map) && Bot.idle(s), 15_000, `arriving on ${map}`);
  }

  /** Saves to a slot through the start menu. */
  async save(slot: 1 | 2 | 3 = 1) {
    await this.menu('Save', `Slot ${slot}`);
    expect(this.said.join('\n')).toContain(`Saved to slot ${slot}`);
  }

  /** Reloads the page (back to the title), keeping the bot's sound setting. */
  async reload() {
    const muted = await this.page.evaluate(() => document.getElementById('mute')?.getAttribute('aria-pressed') === 'false');
    await this.page.reload();
    await this.page.waitForFunction(() => (window as any).__hafnia?.G.scene === 'title', null, { timeout: 60_000 });
    if (muted) await this.page.click('#mute');
  }

  // ---------- evidence ----------

  /** Screenshot of the game screen, attached to the report and saved under bot/results/shots/<test>/. */
  async shot(name: string, opts: { fullPage?: boolean } = {}) {
    const n = String(++this.shots).padStart(2, '0');
    const safe = name.replace(/[^\w.-]+/g, '_');
    const dir = this.info.titlePath.slice(1).join(' - ').replace(/[^\w.-]+/g, '_');
    const path = `${this.info.config.rootDir}/../results/shots/${dir}/${n}_${safe}.png`;
    const png = opts.fullPage ? await this.page.screenshot({ path }) : await this.page.locator('#screen').screenshot({ path });
    await this.info.attach(`${n}_${safe}`, { body: png, contentType: 'image/png' });
    return path;
  }

  /** Lets a test accept a known console error. */
  allowError(re: RegExp) { this.allowed.push(re); }

  /** Called after each test: fails on page or console errors, and attaches the transcript. */
  async finish() {
    await this.info.attach('transcript.txt', { body: this.said.join('\n---\n'), contentType: 'text/plain' });
    const errs = this.errors.filter(e => !this.allowed.some(re => re.test(e)));
    expect(errs, 'page/console errors during the run').toEqual([]);
  }
}

export const test = base.extend<{ bot: Bot }>({
  bot: async ({ page }, use, info) => {
    const bot = new Bot(page, info);
    await use(bot);
    if (info.status === 'failed' || info.status === 'timedOut') {
      try { await info.attach('state.txt', { body: bot.describe(await bot.state()), contentType: 'text/plain' }); } catch { /* page gone */ }
      try { await bot.shot('at-failure'); } catch { /* page gone */ }
    }
    await bot.finish();
  }
});

export { DIRS };
