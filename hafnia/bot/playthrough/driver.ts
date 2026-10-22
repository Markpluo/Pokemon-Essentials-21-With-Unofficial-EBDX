// A headless player for the whole story: plays game-core directly (no browser) like a careful
// first-time player would. It walks, talks, catches a team, fights with type-aware moves, heals at
// Pokémon Centers and grinds only when it keeps losing. Every battle and every line is logged, so a
// run shows where the story breaks, where a fight is too hard and how long each chapter takes.
import { Dex } from '@pkmn/sim';
import { maxHp, type BattleRequest, type Dir, type Game, type Intent, type ServerEvent } from '@hafnia/core';
import { findPath, mapDef, DIRS, doorOf, solid } from '../lib/world';

export interface Answer { when: RegExp; pick: number | string | RegExp; once?: boolean }
export interface BattleLog {
  n: number; chapter: string; map: string; kind: string; trainer: string; foes: string; team: string; result: string; turns: number; items: number;
}

const BACK: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export class Player {
  readonly said: string[] = [];
  readonly battles: BattleLog[] = [];
  readonly problems: string[] = [];
  /** What happened along the way that a designer wants to know (training, losses). */
  readonly notes: string[] = [];
  readonly answers: Answer[] = [];
  /** Picks for the next prompts, in order, before `answers` (shop menus and the like). */
  queue: (number | string | RegExp)[] = [];
  chapter = 'Prologue';
  steps = 0;
  /** Species the player wants on the team (caught on sight while there is room). */
  wanted = new Set<string>();
  catchAll = false;
  private prompt: Extract<ServerEvent, { t: 'prompt' }> | null = null;
  private req: BattleRequest | null = null;
  private inBattle = false;
  private battle: { kind: string; trainer: string; foes: string[]; turns: number; items: number; map: string } | null = null;
  private foe: Record<number, { species: string; level: number; hp: number; maxhp: number }> = {};
  private lastResult = '';

  constructor(public game: Game, first: ServerEvent[]) { this.take(first); }
  get s() { return this.game.state; }
  get view() { return this.game.view(); }
  flag(name: string) { return this.s.flags[`hafnia:${name}`]; }
  get mapId() { return this.s.map.replace(/^hafnia:/, ''); }

  send(intent: Intent) { this.take(this.game.handle(intent)); }

  private lastEvents: ServerEvent[] = [];
  private take(evs: ServerEvent[]) {
    this.lastEvents = evs.filter(e => e.t !== 'view');
    let pending: ServerEvent | null = null;
    for (const e of evs) {
      switch (e.t) {
        case 'error': throw new Error(`game error: ${e.message}`);
        case 'say': this.said.push(e.text); break;
        case 'chapterEnd': this.said.push(`=== ${e.title}: ${e.subtitle} ===`); if (!/complete/.test(e.title)) this.chapter = e.title; break;
        case 'battleStart': {
          this.inBattle = true; this.foe = {};
          const t = e.battle.trainer;
          this.battle = { kind: e.battle.kind, trainer: t ? `${t.title} ${t.name}${e.battle.multi ? ` + ${e.battle.multi.second.title} ${e.battle.multi.second.name} (with ${e.battle.multi.partner.name})` : ''}` : '', foes: [], turns: 0, items: 0, map: this.mapId };
          break;
        }
        case 'battle': {
          const b = e.ev;
          if (b.b === 'text') this.said.push(b.text);
          if (b.b === 'switch' && b.side === 'foe') {
            this.foe[b.slot ?? 0] = { species: b.mon.species, level: b.mon.level, hp: b.mon.hp, maxhp: b.mon.maxhp };
            this.battle?.foes.push(`${b.mon.species} ${b.mon.level}`);
          }
          if (b.b === 'hp' && b.side === 'foe' && this.foe[b.slot ?? 0]) Object.assign(this.foe[b.slot ?? 0], { hp: b.hp, maxhp: b.maxhp });
          break;
        }
        case 'battleEnd': {
          this.inBattle = false; this.req = null; this.lastResult = e.result;
          const b = this.battle!;
          this.battles.push({
            n: this.battles.length + 1, chapter: this.chapter, map: b.map, kind: b.kind, trainer: b.trainer, foes: b.foes.join(', '),
            team: this.s.party.filter(m => !m.egg).map(m => `${m.species} ${m.level}`).join(', '), result: e.result, turns: b.turns, items: b.items
          });
          this.battle = null;
          break;
        }
        case 'evolve': this.said.push(`(${e.fromName} evolved into ${e.toName})`); break;
        default:
          if (['prompt', 'pickSpecies', 'battleRequest', 'askName', 'pickLook'].includes(e.t)) pending = e;
      }
    }
    if (!pending) return;
    const p = pending;
    if (p.t === 'askName') this.send({ t: 'answer', index: 0, text: p.suggestions[0] });
    else if (p.t === 'pickLook') this.send({ t: 'answer', index: 0 });
    else if (p.t === 'pickSpecies') this.send({ t: 'answer', index: this.pickIndex(p.species.map(x => x.name).join('\n'), p.species.map(x => x.species)) });
    else if (p.t === 'prompt') this.send({ t: 'answer', index: this.pickIndex(p.text, p.options) });
    else if (p.t === 'battleRequest') { this.req = p.request; this.battleTurn(p.request); }
  }

  private pickIndex(text: string, options: string[]) {
    if (this.queue.length) {
      const q = this.queue.shift()!;
      const idx = typeof q === 'number' ? q : options.findIndex(o => (typeof q === 'string' ? o.startsWith(q) : q.test(o)));
      if (idx < 0) throw new Error(`queue: no option ${String(q)} in: ${options.join(' | ')} (${text})`);
      return idx;
    }
    const hay = [text, ...options].join('\n');
    const i = this.answers.findIndex(a => a.when.test(hay));
    if (i < 0) return 0;
    const a = this.answers[i];
    if (a.once) this.answers.splice(i, 1);
    const idx = typeof a.pick === 'number' ? a.pick : options.findIndex(o => (typeof a.pick === 'string' ? o.startsWith(a.pick) : (a.pick as RegExp).test(o)));
    if (idx < 0) throw new Error(`No option ${String(a.pick)} in: ${options.join(' | ')} (${text})`);
    return idx;
  }

  // ---------- battles ----------

  private score(moveType: string, power: number, category: string, mine: string[], foeSpecies: string) {
    if (category === 'Status' || !power) return 0;
    const types = Dex.species.get(foeSpecies).types;
    if (!Dex.getImmunity(moveType, types)) return 0;
    const eff = 2 ** Dex.getEffectiveness(moveType, types);
    return power * eff * (mine.includes(moveType) ? 1.5 : 1);
  }

  private bestMove(r: BattleRequest, foeSlot: number) {
    const active = r.party.find(p => p.uid === r.activeUid)!;
    const foe = this.foe[foeSlot] ?? this.foe[0];
    let best = 0, bestScore = -1;
    r.moves.forEach((m, i) => {
      if (m.disabled || m.pp <= 0) return;
      const sc = foe ? this.score(m.type, m.power, m.category, active.types, foe.species) : m.power;
      if (sc > bestScore) { best = i; bestScore = sc; }
    });
    return { index: best, score: bestScore };
  }

  private matchup(m: BattleRequest['party'][number]) {
    const foe = this.foe[0];
    if (!foe) return m.level;
    const best = Math.max(0, ...m.moves.map(mv => this.score(mv.type, mv.power, mv.category, m.types, foe.species)));
    const foeTypes = Dex.species.get(foe.species).types;
    const threat = Math.max(...foeTypes.map(t => (Dex.getImmunity(t, m.types) ? 2 ** Dex.getEffectiveness(t, m.types) : 0)));
    return best / (1 + threat) + m.level * 2 + 50 * m.hp / m.maxhp;
  }

  private battleTurn(r: BattleRequest) {
    const b = this.battle!;
    b.turns++;
    if (b.turns > 400) throw new Error('battle runs forever');
    const healthy = r.party.filter(p => p.hp > 0 && !p.egg && p.uid !== r.activeUid);
    if (r.forceSwitch) {
      const pick = healthy.sort((x, y) => this.matchup(y) - this.matchup(x))[0];
      this.send({ t: 'battle', action: { kind: 'switch', uid: pick.uid } });
      return;
    }
    const active = r.party.find(p => p.uid === r.activeUid)!;
    const foe = this.foe[0];
    // Wild: catch what we want.
    if (b.kind === 'wild' && r.canCatch && foe && this.wantsToCatch(foe.species)) {
      const ball = ['ultraball', 'greatball', 'pokeball', 'netball'].find(x => (r.bag[x] ?? 0) > 0);
      if (ball && (foe.hp / foe.maxhp <= 0.5 || this.weakestMove(r, active) === null)) { b.items++; this.send({ t: 'battle', action: { kind: 'ball', item: ball } }); return; }
      const weak = this.weakestMove(r, active);
      if (ball && weak !== null) { this.send({ t: 'battle', action: { kind: 'move', index: weak } }); return; }
    }
    // Heal a hurt lead in trainer battles.
    if (b.kind === 'trainer' && active.hp / active.maxhp < 0.3 && foe && foe.hp / foe.maxhp > 0.25) {
      const potion = ['hyperpotion', 'superpotion', 'potion'].find(x => (r.bag[x] ?? 0) > 0);
      if (potion && b.items < 6) { b.items++; this.send({ t: 'battle', action: { kind: 'item', item: potion, uid: active.uid } }); return; }
    }
    // Pick the foe to hit in multi battles: the one we hurt most.
    let target = 0;
    if (r.targets?.length) {
      let best = -1;
      for (const t of r.targets) { const sc = this.bestMove(r, t.slot).score; if (sc > best) { best = sc; target = t.slot; } }
    }
    const mv = this.bestMove(r, target);
    // Switch out of a hopeless matchup (nothing better than resisted damage) if someone does better.
    if (b.kind === 'trainer' && mv.score < 40 && healthy.length && !r.targets) {
      const alt = healthy.sort((x, y) => this.matchup(y) - this.matchup(x))[0];
      if (this.matchup(alt) > this.matchup(active) + 30 && b.items < 50) { b.items += 0; this.send({ t: 'battle', action: { kind: 'switch', uid: alt.uid } }); return; }
    }
    const coil = r.coil;
    const mode = coil && coil.current === null && b.kind === 'trainer' ? 'current' as const : undefined;
    this.send({ t: 'battle', action: { kind: 'move', index: mv.index, mode, target: r.targets ? (target as 0 | 1) : undefined } });
  }

  private weakestMove(r: BattleRequest, active: BattleRequest['party'][number]): number | null {
    const foe = this.foe[0];
    let best: number | null = null, bestScore = Infinity;
    r.moves.forEach((m, i) => {
      if (m.disabled || m.pp <= 0) return;
      const sc = this.score(m.type, m.power, m.category, active.types, foe.species);
      if (sc > 0 && sc < bestScore) { best = i; bestScore = sc; }
    });
    return best;
  }

  private wantsToCatch(species: string) {
    if (this.s.dex.caught[species]) return false;
    if (this.wanted.has(species)) return true;
    return this.catchAll;
  }

  // ---------- moving ----------

  private guardSteps(n: number) { this.steps += n; }

  /** Walks to (x, y); fights what jumps out. Stops if the map changes. */
  walkTo(tx: number, ty: number, avoid: [number, number][] = []) {
    const map0 = this.s.map;
    for (let guard = 0; guard < 800; guard++) {
      if (this.s.map !== map0) return;
      if (this.s.x === tx && this.s.y === ty) return;
      if (this.game.busy) throw new Error(`walkTo: game busy on ${this.mapId}; ${this.simState()}; last lines: ${this.said.slice(-4).join(' / ')}; last events: ${JSON.stringify(this.lastEvents.slice(-12))}`);
      const path = findPath(this.s.map, this.s.x, this.s.y, tx, ty, this.view.npcs, avoid);
      if (!path) throw new Error(`no path to ${tx},${ty} on ${this.mapId} from ${this.s.x},${this.s.y}`);
      const before = [this.s.x, this.s.y, this.s.map].join();
      this.step(path[0]);
      if ([this.s.x, this.s.y, this.s.map].join() === before && !this.lastWasEvent) {
        this.step(path[0]);
        if ([this.s.x, this.s.y, this.s.map].join() === before && !this.lastWasEvent) throw new Error(`blocked going ${path[0]} at ${before} toward ${tx},${ty}`);
      }
    }
    throw new Error(`walkTo(${tx},${ty}) gave up on ${this.mapId}`);
  }
  private lastWasEvent = false;
  step(dir: Dir) {
    const n = this.said.length, b = this.battles.length;
    this.send({ t: 'step', dir });
    this.guardSteps(1);
    this.lastWasEvent = this.said.length > n || this.battles.length > b;
    if (this.battles.length > b && this.lastResult === 'lose' && this.battles.at(-1)!.kind === 'wild') this.problems.push(`whited out to a wild ${this.battles.at(-1)!.foes} on ${this.mapId}`);
  }
  exit(dir: Dir, x: number, y: number) {
    const m = this.s.map;
    this.walkTo(x, y);
    if (this.s.map !== m) return;
    this.step(dir);
  }
  enter(building: string) {
    const [x, y] = doorOf(this.s.map, building);
    this.walkTo(x, y + 1);
    this.step('up');
  }
  face(dir: Dir) { if (this.s.dir !== dir) this.send({ t: 'turn', dir }); }
  /** Walks next to (x, y), faces it and presses A. */
  simState() {
    const b = (this.game as any).battle;
    if (!b) return 'no battle';
    const sim = b.sim;
    return [sim.p1, sim.p2].map((sd: any) => `${sd.id}: req=${sd.requestState} done=${sd.isChoiceDone()} left=${sd.pokemonLeft} active=${sd.active.map((a: any) => a ? `${a.name}${a.fainted ? '(fainted)' : ''} ${a.hp}` : 'none')} team=${sd.pokemon.map((m: any) => `${m.name}:${m.hp}${m.fainted ? 'F' : ''}`).join(',')}`).join(' | ') + ` ended=${sim.ended} turn=${sim.turn} ending=${b.ending} result=${b.result}`;
  }
  /** Where an NPC is right now (scripts move them). */
  npcPos(id: string): [number, number] {
    const n = this.view.npcs.find(n => n.id === id);
    if (!n) throw new Error(`no ${id} on ${this.mapId}`);
    return [n.x, n.y];
  }
  talkTo(x: number, y: number): void {
    const npcs = this.view.npcs;
    const opts = (Object.entries(DIRS) as [Dir, [number, number]][])
      .map(([d, [dx, dy]]) => ({ d: BACK[d], x: x + dx, y: y + dy }))
      .filter(o => (o.x === this.s.x && o.y === this.s.y) || !solid(this.s.map, o.x, o.y, npcs))
      .map(o => ({ ...o, path: o.x === this.s.x && o.y === this.s.y ? [] : findPath(this.s.map, this.s.x, this.s.y, o.x, o.y, npcs) }))
      .filter(o => o.path !== null).sort((a, b) => a.path!.length - b.path!.length);
    if (!opts.length) throw new Error(`can't reach ${x},${y} on ${this.mapId}`);
    const map = this.s.map;
    this.walkTo(opts[0].x, opts[0].y);
    if (this.s.map !== map || this.s.x !== opts[0].x || this.s.y !== opts[0].y) return this.talkTo(x, y);
    this.face(opts[0].d);
    this.send({ t: 'interact' });
  }
  lastBattle() { return this.battles.at(-1); }
  get losses() { return this.battles.filter(b => b.result === 'lose').length; }
  /** Buys at the Mart clerk of the Pokémon Center the player is standing in. */
  buy(items: [string, 1 | 5 | 10][]) {
    this.queue.push('Buy');
    for (const [name, n] of items) this.queue.push(name, String(n));
    this.queue.push('Back', 'Done');
    this.talkTo(10, 2);
    this.queue = [];
  }

  /** Paces in the nearest tall grass until `done()` (checked after each battle). */
  grind(done: () => boolean, maxBattles = 60, heal?: () => void) {
    const m = mapDef(this.s.map), grass = m.encounterTile ?? 'g';
    let spot: { x: number; y: number; d: Dir } | null = null, len = Infinity;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.grid[y][x] !== grass) continue;
      for (const [d, [dx, dy]] of Object.entries(DIRS) as [Dir, [number, number]][]) {
        if (m.grid[y + dy]?.[x + dx] !== grass) continue;
        const p = findPath(this.s.map, this.s.x, this.s.y, x, y, this.view.npcs);
        if (p && p.length < len) { len = p.length; spot = { x, y, d }; }
      }
    }
    if (!spot) throw new Error(`no grass on ${this.mapId}`);
    const start = this.battles.length;
    for (let paces = 0; !done() && this.battles.length - start < maxBattles; paces++) {
      if (paces > 3000) throw new Error(`grind: no wild Pokémon after 3000 paces on ${this.mapId}`);
      if (heal && this.hurt()) { heal(); }
      if (this.s.x !== spot.x || this.s.y !== spot.y) this.walkTo(spot.x, spot.y);
      if (this.s.map !== m.id && !this.s.map.endsWith(`:${m.id}`)) return;
      this.step(spot.d); this.step(BACK[spot.d]);
    }
    if (!done()) this.problems.push(`grind on ${this.mapId} hit ${maxBattles} battles`);
  }
  hurt() {
    const p = this.s.party.filter(m => !m.egg);
    return p[0].hp < maxHp(p[0]) * 0.5 || p.reduce((a, m) => a + m.hp, 0) < p.reduce((a, m) => a + maxHp(m), 0) * 0.6;
  }
  get leadLevel() { return Math.max(...this.s.party.filter(m => !m.egg).map(m => m.level)); }
  get minLevel() { return Math.min(...this.s.party.slice(0, 6).filter(m => !m.egg).map(m => m.level)); }
}
