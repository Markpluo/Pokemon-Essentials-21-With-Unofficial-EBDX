// Battles run on the Pokémon Showdown simulator (@pkmn/sim). This file builds the teams,
// makes the opponent's choices, turns Showdown's protocol log into BattleEvents for the
// client, and adds what Showdown leaves to the main game: Poké Balls, running away,
// bag items, EXP and levelling up mid-battle.
import { Battle, Dex } from '@pkmn/sim';
import type { BattleEvent, BattleMonView, BattleRequest, BattleResult, BattleSide, ServerEvent, StatusId } from './protocol';
import {
  calcStats, gainExp, makeMon, maxPp, monName, monView, moveView, speciesExtra, speciesName, type Mon
} from './pokemon';
import type { Rng } from './rng';
import type { BattleOptions } from './script';

type SimPokemon = Battle['p1']['pokemon'][number];
type SimSide = Battle['p1'];

// A do-nothing move with high priority. The player "uses" it on turns spent throwing a ball,
// using an item or failing to run, so the opponent still gets its turn. It is never shown.
const WAIT = 'hafniawait';
let waitInstalled = false;
function installWaitMove() {
  if (waitInstalled) return;
  waitInstalled = true;
  (Dex.data.Moves as Record<string, unknown>)[WAIT] = {
    num: -1001, name: 'Hafnia Wait', type: '???', category: 'Status', basePower: 0, accuracy: true, pp: 64,
    noPPBoosts: true, priority: 6, target: 'self', flags: {},
    onTryMove(this: any) { this.attrLastMove('[still]'); return null; }
  };
}

export const ITEMS: Record<string, { name: string; heal?: number; ball?: number }> = {
  potion: { name: 'Potion', heal: 20 },
  superpotion: { name: 'Super Potion', heal: 60 },
  pokeball: { name: 'Poké Ball', ball: 1 },
  greatball: { name: 'Great Ball', ball: 1.5 }
};

export interface BattleHost {
  readonly rng: Rng;
  readonly party: Mon[];
  readonly bag: Record<string, number>;
  readonly playerName: string;
  emit(ev: ServerEvent): void;
  addMon(m: Mon): 'party' | 'box';
  giveMoney(n: number): void;
}

const STAT_NAMES: Record<string, string> = {
  atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', accuracy: 'accuracy', evasion: 'evasiveness'
};
const STATUS_TEXT: Record<string, string> = {
  brn: 'was burned!', par: 'is paralyzed! It may be unable to move!', psn: 'was poisoned!',
  tox: 'was badly poisoned!', slp: 'fell asleep!', frz: 'was frozen solid!'
};
const CANT_TEXT: Record<string, string> = {
  par: 'is paralyzed! It can\'t move!', slp: 'is fast asleep.', frz: 'is frozen solid!',
  flinch: 'flinched and couldn\'t move!', Attract: 'is immobilized by love!', recharge: 'must recharge!',
  nopp: 'has no PP left for this move!'
};

export class BattleSession {
  result: BattleResult | null = null;
  private sim: Battle;
  private logIndex = 0;
  private foes: Mon[];
  private runAttempts = 0;
  private started = false;
  private pendingEffect: 'super' | 'weak' | null = null;

  constructor(private host: BattleHost, private opts: BattleOptions) {
    installWaitMove();
    const rng = host.rng;
    this.foes = opts.foes.map(f => makeMon(f.species, f.level, rng, { moves: f.moves }));
    this.sim = new Battle({ formatid: 'gen9customgame' as any, seed: rng.simSeed() as any });

    const party = host.party;
    const lead = party.findIndex(m => m.hp > 0);
    const order = [party[lead], ...party.filter((_, i) => i !== lead)];
    this.sim.setPlayer('p1', { name: host.playerName, team: order.map(m => this.toSet(m, true)) as any });
    this.sim.setPlayer('p2', { name: opts.trainer?.name ?? 'Wild', team: this.foes.map(m => this.toSet(m, false)) as any });
    for (const p of this.sim.p1.pokemon) this.restore(p, this.monOf(p)!);
    this.logIndex = this.sim.log.length;
  }

  private toSet(m: Mon, player: boolean) {
    return {
      uid: m.uid, name: monName(m), species: speciesName(m.species), level: m.level, gender: m.gender,
      shiny: m.shiny, ability: m.ability, nature: m.nature, item: '', ivs: m.ivs, evs: m.evs,
      moves: [...m.moves.map(mv => mv.id), ...(player ? [WAIT] : [])]
    };
  }

  /** Copies HP, status and PP from the saved Pokémon onto the simulator's copy. */
  private restore(p: SimPokemon, m: Mon) {
    p.hp = m.hp;
    if (m.hp <= 0) { p.hp = 0; p.fainted = true; }
    if (m.status && m.hp > 0) p.setStatus(m.status as any, null as any, null as any, true);
    m.moves.forEach((mv, i) => {
      const slot = p.baseMoveSlots[i];
      if (slot) { slot.pp = mv.pp; slot.maxpp = maxPp(mv.id); }
    });
  }

  private monOf(p: SimPokemon): Mon | undefined {
    const uid = (p.set as any).uid as string;
    return this.host.party.find(m => m.uid === uid) ?? this.foes.find(m => m.uid === uid);
  }

  // ---------- flow ----------

  start(): void {
    const o = this.opts;
    this.host.emit({
      t: 'battleStart',
      battle: {
        kind: o.kind, bg: o.bg ?? 'field', bgm: o.kind === 'wild' ? 'battle_wild' : 'battle_trainer',
        ...(o.trainer ? { trainer: o.trainer } : {}), foeCount: this.foes.length
      }
    });
    if (o.trainer) this.ev({ b: 'text', text: `${o.trainer.title} ${o.trainer.name} would like to battle!` });
    this.sim.choose('p1', 'default');
    this.sim.choose('p2', 'default');
    this.advance();
  }

  act(action: import('./protocol').BattleAction): void {
    if (this.result) return;
    const p1 = this.sim.p1;
    const req = p1.activeRequest as any;
    if (!req || !p1.requestState) return this.request();
    const active = p1.active[0];

    if (req.forceSwitch && action.kind !== 'switch') return this.request();
    switch (action.kind) {
      case 'move': {
        if (!this.sim.choose('p1', `move ${action.index + 1}`)) {
          this.ev({ b: 'text', text: 'That move can\'t be used right now!' });
          return this.request();
        }
        break;
      }
      case 'switch': {
        const pos = p1.pokemon.findIndex(p => (p.set as any).uid === action.uid);
        const target = p1.pokemon[pos];
        if (!target || target.fainted) { this.ev({ b: 'text', text: `${target?.name ?? 'It'} has no energy left to battle!` }); return this.request(); }
        if (target.isActive) { this.ev({ b: 'text', text: `${target.name} is already in battle!` }); return this.request(); }
        if (!this.sim.choose('p1', `switch ${pos + 1}`)) { this.ev({ b: 'text', text: `${active.name} can't be switched out!` }); return this.request(); }
        break;
      }
      case 'item': {
        const item = ITEMS[action.item];
        const target = p1.pokemon.find(p => (p.set as any).uid === action.uid);
        if (!item?.heal || !this.host.bag[action.item] || !target) return this.request();
        if (target.fainted || target.hp >= target.maxhp) { this.ev({ b: 'text', text: 'It won\'t have any effect.' }); return this.request(); }
        this.host.bag[action.item]--;
        const before = target.hp;
        target.hp = Math.min(target.maxhp, target.hp + item.heal);
        this.ev({ b: 'text', text: `${this.host.playerName} used a ${item.name}!` });
        if (target.isActive) this.ev({ b: 'hp', side: 'ally', hp: target.hp, maxhp: target.maxhp, effect: 'heal' });
        this.ev({ b: 'text', text: `${target.name} recovered ${target.hp - before} HP.` });
        this.waitTurn();
        break;
      }
      case 'ball': {
        const ball = ITEMS[action.item];
        if (this.opts.kind !== 'wild') { this.ev({ b: 'text', text: 'The trainer blocked the ball!\nDon\'t be a thief!' }); return this.request(); }
        if (!ball?.ball || !this.host.bag[action.item]) return this.request();
        this.host.bag[action.item]--;
        this.ev({ b: 'text', text: `${this.host.playerName} threw a ${ball.name}!` });
        if (this.throwBall(ball.ball)) return;
        this.waitTurn();
        break;
      }
      case 'run': {
        if (this.opts.kind !== 'wild') { this.ev({ b: 'text', text: 'No! There\'s no running from a trainer battle!' }); return this.request(); }
        this.runAttempts++;
        const mine = active.getStat('spe', false, true), theirs = Math.max(1, this.sim.p2.active[0].getStat('spe', false, true));
        const odds = (mine * 128 / theirs + 30 * this.runAttempts) / 256;
        if (this.host.rng.chance(odds)) {
          this.ev({ b: 'flee' });
          this.ev({ b: 'text', text: 'Got away safely!' });
          return this.finish('run');
        }
        this.ev({ b: 'text', text: 'Can\'t escape!' });
        this.waitTurn();
        break;
      }
    }
    this.advance();
  }

  private waitTurn() {
    const moves = this.sim.p1.active[0].moveSlots;
    const idx = moves.findIndex(s => s.id === WAIT);
    // Taunt and similar effects can block the wait move; then let the simulator pick for us.
    if (idx < 0 || !this.sim.choose('p1', `move ${idx + 1}`)) this.sim.choose('p1', 'default');
  }

  /** Runs the simulator until the player has to decide something or the battle ends. */
  private advance() {
    for (let guard = 0; guard < 50; guard++) {
      this.flushLog();
      if (this.result) return;
      if (this.sim.ended) return this.finish(this.sim.winner === this.host.playerName ? 'win' : 'lose');
      const p2 = this.sim.p2, p1 = this.sim.p1;
      if (p2.requestState && !p2.isChoiceDone()) { this.sim.choose('p2', this.aiChoice(p2)); continue; }
      if (p1.requestState && !p1.isChoiceDone()) return this.request();
      return;
    }
  }

  private request() {
    const p1 = this.sim.p1, req = p1.activeRequest as any;
    this.syncParty();
    const active = p1.active[0];
    const moves = req?.active?.[0]?.moves ?? [];
    const out: BattleRequest = {
      moves: moves.filter((m: any) => m.id !== WAIT)
        .map((m: any) => moveView(m.id, m.pp ?? 0, m.maxpp ?? 0, m.disabled === true || m.pp === 0)),
      forceSwitch: !!req?.forceSwitch,
      canCatch: this.opts.kind === 'wild',
      canRun: this.opts.kind === 'wild',
      activeUid: (active?.set as any)?.uid ?? '',
      party: this.host.party.map(monView),
      bag: { ...this.host.bag }
    };
    this.host.emit({ t: 'battleRequest', request: out });
  }

  private aiChoice(side: SimSide): string {
    const req = side.activeRequest as any;
    if (req.forceSwitch) {
      const pos = side.pokemon.findIndex(p => !p.fainted && !p.isActive);
      return pos >= 0 ? `switch ${pos + 1}` : 'pass';
    }
    const moves: any[] = req.active[0].moves;
    const usable = moves.map((m, i) => ({ m, i })).filter(({ m }) => !m.disabled && m.pp !== 0);
    if (!usable.length) return 'default';
    if (this.opts.kind === 'wild') return `move ${this.host.rng.pick(usable).i + 1}`;
    // Trainers favour strong, super-effective moves but stay a little unpredictable.
    const me = side.active[0], foe = this.sim.p1.active[0];
    const scored = usable.map(({ m, i }) => {
      const mv = Dex.moves.get(m.id);
      if (mv.category === 'Status') return { i, w: 30 };
      if (!Dex.getImmunity(mv.type, foe.getTypes())) return { i, w: 1 };
      const eff = 2 ** Dex.getEffectiveness(mv.type, foe.getTypes());
      return { i, w: (mv.basePower || 40) * eff * (me.hasType(mv.type) ? 1.5 : 1) };
    });
    let r = this.host.rng.next() * scored.reduce((s, x) => s + x.w, 0);
    for (const x of scored) { if ((r -= x.w) < 0) return `move ${x.i + 1}`; }
    return `move ${scored[0].i + 1}`;
  }

  private throwBall(mult: number): boolean {
    const foe = this.sim.p2.active[0], mon = this.monOf(foe)!;
    const rate = speciesExtra(mon.species).catchRate;
    const statusBonus = foe.status === 'slp' || foe.status === 'frz' ? 2.5 : foe.status ? 1.5 : 1;
    const a = ((3 * foe.maxhp - 2 * foe.hp) * rate * mult * statusBonus) / (3 * foe.maxhp);
    let shakes = 0;
    if (a >= 255) shakes = 4;
    else {
      const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / Math.max(1, a)));
      while (shakes < 4 && this.host.rng.int(65536) < b) shakes++;
    }
    const caught = shakes === 4;
    this.ev({ b: 'throw', shakes: Math.min(3, shakes), caught });
    if (!caught) {
      this.ev({ b: 'text', text: ['Oh no! The Pokémon broke free!', 'Aww! It appeared to be caught!', 'Aargh! Almost had it!', 'Gah! It was so close, too!'][shakes] });
      return false;
    }
    mon.hp = foe.hp; mon.status = (foe.status === 'tox' ? 'psn' : foe.status) as StatusId;
    mon.ot = this.host.playerName;
    this.host.emit({ t: 'me', name: 'me_catch' });
    this.ev({ b: 'text', text: `Gotcha! ${mon.nickname ?? speciesName(mon.species)} was caught!` });
    const where = this.host.addMon(mon);
    this.ev({ b: 'text', text: where === 'party' ? `${speciesName(mon.species)} joined your team!` : `Your team is full, so ${speciesName(mon.species)} was sent to the PC.` });
    this.finish('caught');
    return true;
  }

  private finish(result: BattleResult) {
    this.result = result;
    this.syncParty();
    if (result === 'win' && this.opts.kind === 'trainer' && this.opts.trainer) {
      const t = this.opts.trainer;
      this.host.emit({ t: 'bgm', name: this.opts.leader ? 'victory_leader' : 'victory_trainer' });
      this.ev({ b: 'text', text: `You defeated ${t.title} ${t.name}!` });
      const prize = Math.max(...this.foes.map(m => m.level)) * (this.opts.prize ?? (this.opts.leader ? 100 : 24));
      this.host.giveMoney(prize);
      this.ev({ b: 'text', text: `You got ${prize} kr. for winning!` });
    } else if (result === 'win') this.host.emit({ t: 'bgm', name: 'victory_wild' });
    else if (result === 'lose') {
      if (this.opts.soft) this.ev({ b: 'text', text: 'You lost the battle...' });
      else {
        this.ev({ b: 'text', text: `${this.host.playerName} has no Pokémon that can fight!` });
        this.ev({ b: 'text', text: `${this.host.playerName} hurried back to safety...` });
      }
    }
    this.host.emit({ t: 'battleEnd', result });
  }

  /** Copies HP, status and PP from the simulator back onto the saved party. */
  private syncParty() {
    for (const p of this.sim.p1.pokemon) {
      const m = this.monOf(p);
      if (!m) continue;
      m.hp = p.fainted ? 0 : p.hp;
      m.status = (p.status === 'tox' ? 'psn' : (p.status || '')) as StatusId;
      if (m.hp === 0) m.status = '';
      for (const mv of m.moves) {
        const slot = p.baseMoveSlots.find(s => s.id === mv.id);
        if (slot) mv.pp = slot.pp;
      }
    }
  }

  // ---------- EXP ----------

  private awardExp(fainted: SimPokemon) {
    const p = this.sim.p1.active[0];
    if (!p || p.fainted) return;
    const m = this.monOf(p)!, foe = this.monOf(fainted)!;
    const b = speciesExtra(foe.species).baseExp, L = foe.level, Lp = m.level;
    const trainer = this.opts.kind === 'trainer' ? 1.5 : 1;
    const amount = Math.max(1, Math.floor((b * L / 5) * trainer * ((2 * L + 10) / (L + Lp + 10)) ** 2.5 + 1));
    this.ev({ b: 'text', text: `${p.name} gained ${amount} Exp. Points!` });
    const steps = gainExp(m, amount);
    for (const step of steps) {
      const before = p.maxhp;
      const stats = calcStats(m);
      (p as any).level = m.level; (p.set as any).level = m.level;
      p.baseMaxhp = p.maxhp = stats.hp;
      p.hp = Math.max(0, Math.min(stats.hp, p.hp + stats.hp - before));
      const { hp, ...rest } = stats;
      Object.assign(p.baseStoredStats, rest); Object.assign(p.storedStats, rest);
      p.details = (p as any).getUpdatedDetails?.() ?? p.details;
      this.expEvent(p, m);
      this.host.emit({ t: 'me', name: 'me_item' });
      this.ev({ b: 'text', text: `${p.name} grew to Lv. ${step.level}!` });
      step.forgot.forEach((old, i) => {
        this.ev({ b: 'text', text: `${p.name} forgot ${Dex.moves.get(old).name}...\nand learned ${Dex.moves.get(step.learned[i]).name}!` });
      });
      for (const id of step.learned.slice(step.forgot.length)) this.ev({ b: 'text', text: `${p.name} learned ${Dex.moves.get(id).name}!` });
      if (step.learned.length) this.rebuildMoves(p, m);
    }
    if (!steps.length) this.expEvent(p, m);
  }

  private expEvent(p: SimPokemon, m: Mon) {
    const v = monView(m);
    this.ev({ b: 'exp', side: 'ally', exp: v.exp, expLo: v.expLo, expHi: v.expHi, level: m.level, hp: p.hp, maxhp: p.maxhp });
  }

  private rebuildMoves(p: SimPokemon, m: Mon) {
    const wait = p.baseMoveSlots.find(s => s.id === WAIT)!;
    const slots = m.moves.map(mv => {
      const old = p.baseMoveSlots.find(s => s.id === mv.id);
      if (old) return old;
      const d = Dex.moves.get(mv.id);
      return { move: d.name, id: d.id, pp: mv.pp, maxpp: maxPp(mv.id), target: d.target, disabled: false, used: false } as any;
    });
    (p as any).baseMoveSlots = [...slots, wait];
    p.moveSlots = p.baseMoveSlots.slice();
    (p.set as any).moves = [...m.moves.map(mv => mv.id), WAIT];
  }

  // ---------- Showdown protocol -> BattleEvents ----------

  private ev(e: BattleEvent) { this.host.emit({ t: 'battle', ev: e }); }

  private sideOf(ident: string): BattleSide { return ident.startsWith('p1') ? 'ally' : 'foe'; }
  private simSide(ident: string): SimSide { return ident.startsWith('p1') ? this.sim.p1 : this.sim.p2; }
  private pokemonOf(ident: string): SimPokemon | undefined {
    const name = ident.slice(ident.indexOf(':') + 1).trim();
    const list = this.simSide(ident).pokemon.filter(p => p.name === name);
    return list.find(p => p.isActive) ?? list[0];
  }
  private nameOf(ident: string, start = true): string {
    const name = ident.slice(ident.indexOf(':') + 1).trim();
    if (this.sideOf(ident) === 'ally') return name;
    const pre = this.opts.kind === 'wild' ? 'wild' : 'opposing';
    return `${start ? 'The' : 'the'} ${pre} ${name}`;
  }

  private monView(p: SimPokemon): BattleMonView {
    const m = this.monOf(p);
    const v = m ? monView(m) : undefined;
    return {
      uid: m?.uid, species: p.species.id, key: speciesExtra(p.species.id).key, name: p.name, level: p.level,
      hp: p.hp, maxhp: p.maxhp, status: (p.status || '') as StatusId, gender: (p.gender || '') as '' | 'M' | 'F',
      shiny: !!p.set.shiny, ...(v && (p.side === this.sim.p1) ? { exp: v.exp, expLo: v.expLo, expHi: v.expHi } : {})
    };
  }

  private flushLog() {
    const raw = this.sim.log.slice(this.logIndex);
    this.logIndex = this.sim.log.length;
    // "|split|p1" is followed by the exact (private) line and then the public one: keep the first.
    const lines: string[] = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i].startsWith('|split|')) { lines.push(raw[i + 1]); i += 2; } else lines.push(raw[i]);
    }
    const evs: BattleEvent[] = [];
    // Showdown reports crits and effectiveness before the damage; the games show them after the hit.
    let afterHit: BattleEvent[] = [];
    const flushAfterHit = () => { evs.push(...afterHit); afterHit = []; };
    for (const line of lines) {
      const parts = line.split('|').slice(1);
      const [cmd, a1 = '', a2 = '', a3 = ''] = parts;
      const kw = (k: string) => parts.find(x => x.startsWith(`[${k}]`))?.slice(k.length + 2).trim();
      const from = kw('from');
      if (cmd !== '-damage' && cmd !== '-supereffective' && cmd !== '-resisted' && cmd !== '-crit') flushAfterHit();
      switch (cmd) {
        case 'start': this.started = true; break;
        case 'switch': case 'drag': {
          const p = this.pokemonOf(a1)!, side = this.sideOf(a1);
          let text = side === 'ally' ? `Go! ${p.name}!` : this.opts.kind === 'wild' ? `A wild ${p.name} appeared!`
            : `${this.opts.trainer!.title} ${this.opts.trainer!.name} sent out ${p.name}!`;
          if (cmd === 'drag') text = `${this.nameOf(a1)} was dragged out!`;
          evs.push({ b: 'switch', side, mon: this.monView(p), text });
          break;
        }
        case 'move': {
          if (a2 === 'Hafnia Wait') break;
          const mv = Dex.moves.get(a2);
          evs.push({ b: 'move', side: this.sideOf(a1), text: `${this.nameOf(a1)} used ${mv.name}!`, type: mv.type.toLowerCase(), category: mv.category });
          break;
        }
        case '-damage': case '-heal': case '-sethp': {
          const [hp, rest] = a2.split(' ');
          const [cur, max] = hp.split('/').map(Number);
          const side = this.sideOf(a1);
          const effect = cmd === '-heal' ? 'heal' : from ? 'residual' : (this.pendingEffect ?? 'normal');
          this.pendingEffect = null;
          evs.push({ b: 'hp', side, hp: cur || 0, maxhp: max || this.pokemonOf(a1)?.maxhp || 1, effect });
          if (!from) flushAfterHit();
          if (from) {
            const src = from.replace(/^(item|ability|move): /, '');
            const sub = { brn: 'its burn', psn: 'poison', tox: 'poison', confusion: 'confusion' }[src];
            if (cmd === '-damage' && sub) evs.push({ b: 'text', text: sub === 'confusion' ? 'It hurt itself in its confusion!' : `${this.nameOf(a1)} was hurt by ${sub}!` });
            else if (cmd === '-heal' && from.startsWith('item')) evs.push({ b: 'text', text: `${this.nameOf(a1)} restored a little HP using its ${src}!` });
            else if (cmd === '-damage' && from.startsWith('item')) evs.push({ b: 'text', text: `${this.nameOf(a1)} was hurt by its ${src}!` });
          }
          break;
        }
        case '-supereffective': this.pendingEffect = 'super'; afterHit.push({ b: 'text', text: 'It\'s super effective!' }); break;
        case '-resisted': this.pendingEffect = 'weak'; afterHit.push({ b: 'text', text: 'It\'s not very effective...' }); break;
        case '-crit': afterHit.unshift({ b: 'text', text: 'A critical hit!' }); break;
        case '-miss': evs.push({ b: 'text', text: a2 ? `${this.nameOf(a2)} avoided the attack!` : `${this.nameOf(a1)}'s attack missed!` }); break;
        case '-immune': evs.push({ b: 'text', text: `It doesn't affect ${this.nameOf(a1, false)}...` }); break;
        case '-fail': evs.push({ b: 'text', text: 'But it failed!' }); break;
        case '-ohko': evs.push({ b: 'text', text: 'It\'s a one-hit KO!' }); break;
        case '-hitcount': evs.push({ b: 'text', text: `The Pokémon was hit ${a2} time${a2 === '1' ? '' : 's'}!` }); break;
        case '-status': {
          evs.push({ b: 'status', side: this.sideOf(a1), status: a2 as StatusId });
          evs.push({ b: 'text', text: `${this.nameOf(a1)} ${STATUS_TEXT[a2] ?? 'was afflicted!'}` });
          break;
        }
        case '-curestatus': {
          evs.push({ b: 'status', side: this.sideOf(a1), status: '' });
          const t = a2 === 'slp' ? 'woke up!' : a2 === 'frz' ? 'thawed out!' : a2 === 'par' ? 'was cured of paralysis.' : 'was cured!';
          evs.push({ b: 'text', text: `${this.nameOf(a1)} ${t}` });
          break;
        }
        case 'cant': {
          const reason = a2.replace(/^(move|ability): /, '');
          evs.push({ b: 'text', text: `${this.nameOf(a1)} ${CANT_TEXT[reason] ?? 'can\'t move!'}` });
          break;
        }
        case '-boost': case '-unboost': {
          const n = Number(a3), stat = STAT_NAMES[a2] ?? a2;
          const up = cmd === '-boost';
          const amount = n === 0 ? (up ? 'won\'t go any higher!' : 'won\'t go any lower!')
            : n === 1 ? (up ? 'rose!' : 'fell!') : n === 2 ? (up ? 'rose sharply!' : 'harshly fell!') : (up ? 'rose drastically!' : 'severely fell!');
          evs.push({ b: 'text', text: `${this.nameOf(a1)}'s ${stat} ${amount}` });
          break;
        }
        case '-start': {
          const eff = a2.replace(/^(move|ability): /, '');
          const t = eff === 'confusion' ? 'became confused!' : eff === 'Attract' ? 'fell in love!' : eff === 'Substitute' ? 'put in a substitute!'
            : eff === 'Leech Seed' ? 'was seeded!' : null;
          if (from?.startsWith('ability')) evs.push({ b: 'text', text: `[${this.nameOf(kw('of') ?? a1)}'s ${from.slice(9)}]` });
          if (t) evs.push({ b: 'text', text: `${this.nameOf(a1)} ${t}` });
          break;
        }
        case '-activate': {
          const eff = a2.replace(/^(move|ability): /, '');
          if (eff === 'confusion') evs.push({ b: 'text', text: `${this.nameOf(a1)} is confused!` });
          else if (eff === 'Attract') evs.push({ b: 'text', text: `${this.nameOf(a1)} is in love with ${this.nameOf(kw('of') ?? a1, false)}!` });
          else if (eff === 'Protect') evs.push({ b: 'text', text: `${this.nameOf(a1)} protected itself!` });
          break;
        }
        case '-end': {
          const eff = a2.replace(/^(move|ability): /, '');
          if (eff === 'confusion') evs.push({ b: 'text', text: `${this.nameOf(a1)} snapped out of its confusion!` });
          break;
        }
        case '-ability': evs.push({ b: 'text', text: `[${this.nameOf(a1)}'s ${a2}]` }); break;
        case '-weather': {
          const w: Record<string, string> = { RainDance: 'It started to rain!', SunnyDay: 'The sunlight turned harsh!', Sandstorm: 'A sandstorm kicked up!', Snow: 'It started to snow!', none: 'The weather returned to normal.' };
          if (!parts.some(x => x === '[upkeep]') && w[a1]) evs.push({ b: 'text', text: w[a1] });
          break;
        }
        case '-prepare': evs.push({ b: 'text', text: `${this.nameOf(a1)} is preparing ${a2}!` }); break;
        case '-mustrecharge': break;
        case 'faint': {
          const p = this.pokemonOf(a1)!, side = this.sideOf(a1);
          evs.push({ b: 'faint', side, text: `${this.nameOf(a1)} fainted!` });
          for (const e of evs.splice(0)) this.ev(e);
          if (side === 'foe') this.awardExp(p);
          break;
        }
      }
    }
    flushAfterHit();
    // The opening switch-ins: show the opponent's Pokémon before the player's, like the main games.
    if (!this.started) return;
    const firstAlly = evs.findIndex(e => e.b === 'switch' && e.side === 'ally');
    const firstFoe = evs.findIndex(e => e.b === 'switch' && e.side === 'foe');
    if (firstAlly >= 0 && firstFoe > firstAlly && !this.introDone) evs.splice(firstAlly, 0, evs.splice(firstFoe, 1)[0]);
    this.introDone = true;
    for (const e of evs) this.ev(e);
  }
  private introDone = false;
}
