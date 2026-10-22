// Battles run on the Pokémon Showdown simulator (@pkmn/sim). This file builds the teams,
// makes the opponent's choices, turns Showdown's protocol log into BattleEvents for the
// client, and adds what Showdown leaves to the main game: Poké Balls, running away,
// bag items, EXP (Exp Share), move learning, trainer AI and the Copper & Current Coil.
import { Battle, Dex } from '@pkmn/sim';
import { applyCurrent, applyOvercharge, applyPatina, coilBlock, installCoil, type CoilUnlocks } from './coil';
import type { Rules } from './content';
import { ITEMS, itemEffect } from './items';
import type {
  BattleEvent, BattleMonView, BattleRequest, BattleResult, BattleSide, CoilMode, CoilView, ServerEvent, Slot, StatusId
} from './protocol';
import {
  calcStats, gainExp, makeMon, maxPp, monName, monView, moveView, replaceMove, speciesExtra, speciesName, type Mon
} from './pokemon';
import type { Rng } from './rng';
import type { BattleOptions } from './script';

type SimPokemon = Battle['p1']['pokemon'][number];
type SimSide = Battle['p1'];
type MoveData = ReturnType<typeof Dex.moves.get>;

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

export interface BattleHost {
  readonly rng: Rng;
  readonly party: Mon[];
  readonly bag: Record<string, number>;
  readonly playerName: string;
  readonly rules: Rules;
  readonly badges: number;
  readonly coil: CoilUnlocks;
  emit(ev: ServerEvent): void;
  /** Takes the whiteout money and returns how much was lost. */
  whiteout(): number;
  addMon(m: Mon): 'party' | 'box';
  giveMoney(n: number): void;
}

interface CoilSide { enabled: boolean; pips: number; used: boolean; unlocks: CoilUnlocks; overcharge: boolean; seTurn: number }

const STAT_NAMES: Record<string, string> = {
  atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', accuracy: 'accuracy', evasion: 'evasiveness'
};
const STATUS_TEXT: Record<string, string> = {
  brn: 'was burned!', par: 'is paralyzed! It may be unable to move!', psn: 'was poisoned!',
  tox: 'was badly poisoned!', slp: 'fell asleep!', frz: 'was frozen solid!'
};
/** Move targets that need a pick in a multi battle (everything else hits a fixed set of Pokémon). */
const AIMED = new Set(['normal', 'any', 'adjacentFoe']);

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
  /** Multi battles: the partner's team (p3) and the second trainer's (p4). */
  private partnerMons: Mon[] = [];
  private foes2: Mon[] = [];
  private runAttempts = 0;
  private started = false;
  private pendingEffect: 'super' | 'weak' | null = null;
  private pendingCrit = false;
  private turn = 0;
  /** Tier 3 trainer AI: Potions used, switches made, and whether it has predicted a switch yet. */
  private expert = { potions: 0, switches: 0, predicted: false };
  private coil: Record<BattleSide, CoilSide>;
  private questions: { uid: string; move: string }[] = [];
  private asking: { uid: string; move: string } | null = null;
  private ending: BattleResult | null = null;
  /** Party Pokémon that levelled up, for the evolution check after the battle. */
  readonly leveled = new Set<string>();

  constructor(private host: BattleHost, private opts: BattleOptions) {
    installWaitMove();
    installCoil(host.rules.coil);
    const rng = host.rng, cr = host.rules.coil;
    const plain = opts.coil === false;
    const start = opts.kind === 'wild' ? cr.startWild : cr.startTrainer;
    this.coil = {
      ally: { enabled: !plain && !!(host.coil.copper || host.coil.current), pips: start, used: false, unlocks: host.coil, overcharge: false, seTurn: -1 },
      foe: {
        enabled: !plain && !!(opts.foeCoil || opts.overcharge), pips: opts.overcharge ? cr.max : start, used: false,
        unlocks: opts.overcharge ? { copper: true, current: true } : opts.foeCoil ?? {}, overcharge: !!opts.overcharge, seTurn: -1
      }
    };
    const build = (list: BattleOptions['foes']) => list.map(f => makeMon(f.species, f.level, rng, { moves: f.moves, item: f.item, ability: f.ability }));
    this.foes = build(opts.foes);
    let format: any;
    if (opts.multi) {
      // Showdown's multi battle: p1 (player) and p3 (partner) against p2 and p4, one Pokémon each on the field.
      format = Object.create(Dex.formats.get('gen9customgame'));
      format.gameType = 'multi'; format.playerCount = 4;
      this.partnerMons = build(opts.multi.partner.foes);
      this.foes2 = build(opts.multi.second.foes);
    }
    this.sim = new Battle({ formatid: 'gen9customgame' as any, ...(format ? { format } : {}), seed: rng.simSeed() as any });

    const party = host.party;
    const lead = party.findIndex(m => m.hp > 0);
    const order = [party[lead], ...party.filter((_, i) => i !== lead)];
    this.sim.setPlayer('p1', { name: host.playerName, team: order.map(m => this.toSet(m, true)) as any });
    // Expert trainers can spend a turn on a Potion, which needs the wait move too.
    this.sim.setPlayer('p2', { name: opts.trainer?.name ?? 'Wild', team: this.foes.map(m => this.toSet(m, this.ai() === 3 && !opts.multi)) as any });
    if (opts.multi) {
      this.sim.setPlayer('p3', { name: opts.multi.partner.name, team: this.partnerMons.map(m => this.toSet(m, false)) as any });
      this.sim.setPlayer('p4', { name: opts.multi.second.name, team: this.foes2.map(m => this.toSet(m, false)) as any });
    }
    for (const p of this.sim.p1.pokemon) { this.restore(p, this.monOf(p)!); if (opts.tutorial) (p as any).m.guarded = true; }
    this.logIndex = this.sim.log.length;
  }

  private ai() { return this.opts.tutorial ? 0 : this.opts.ai ?? (this.opts.kind === 'wild' ? 0 : this.opts.leader || this.opts.soft ? 2 : 1); }

  private coilView(side: BattleSide): CoilView {
    const c = this.coil[side], r = this.host.rules.coil;
    return { pips: c.pips, max: r.max, ready: r.ready, used: c.used, ...(c.overcharge ? { overcharge: true } : {}) };
  }

  private charge(side: BattleSide, n: number, out: BattleEvent[]) {
    const c = this.coil[side];
    if (!c.enabled || c.used || c.pips >= this.host.rules.coil.max) return;
    c.pips = Math.min(this.host.rules.coil.max, c.pips + n);
    out.push({ b: 'coil', side, coil: this.coilView(side) });
  }

  /** Spends a side's Coil on its active Pokémon. Returns the narration. */
  private activate(side: BattleSide, mode: CoilMode | 'overcharge'): BattleEvent[] {
    const c = this.coil[side], p = (side === 'ally' ? this.sim.p1 : this.sim.p2).active[0];
    const who = side === 'ally' ? p.name : this.nameOf(`p2a: ${p.name}`);
    c.pips = 0;
    if (!c.overcharge) c.used = true;
    const out: BattleEvent[] = [];
    if (mode === 'overcharge') {
      applyPatina(p); applyCurrent(p); applyOvercharge(p);
      out.push({ b: 'overcharge', side, text: `${who} is Overcharged!\nCopper and Current at once, but it burns!` });
    } else if (mode === 'copper') {
      applyPatina(p);
      out.push({ b: 'copper', side, text: `${who} is coated in a copper patina!` });
    } else {
      applyCurrent(p);
      out.push({ b: 'current', side, text: `The Coil surges! ${who}'s next move\ncarries the Current!` });
    }
    out.push({ b: 'coil', side, coil: this.coilView(side) });
    return out;
  }

  private toSet(m: Mon, player: boolean) {
    return {
      uid: m.uid, name: monName(m), species: speciesName(m.species), level: m.level, gender: m.gender,
      shiny: m.shiny, ability: m.ability, nature: m.nature, item: m.item ?? '', ivs: m.ivs, evs: m.evs,
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
    return this.host.party.find(m => m.uid === uid) ?? [...this.foes, ...this.partnerMons, ...this.foes2].find(m => m.uid === uid);
  }

  /** Every side in play: p1 and p2, plus p3 and p4 in a multi battle. */
  private get sides(): SimSide[] { return this.sim.sides as SimSide[]; }
  /** The Pokémon on the field that a side's moves can hit, in target order (1, 2). */
  private opponents(side: SimSide): SimPokemon[] {
    const mine = side === this.sim.p1 || side === this.sides[2];
    return this.sides.filter(s => (s === this.sim.p1 || s === this.sides[2]) !== mine).map(s => s.active[0]);
  }
  /** "move 2" or, for an aimed move in a multi battle, "move 2 1" (target 1 or 2). */
  private moveChoice(index: number, id: string, target: number): string {
    return this.opts.multi && AIMED.has(Dex.moves.get(id).target) ? `move ${index + 1} ${target + 1}` : `move ${index + 1}`;
  }

  // ---------- flow ----------

  start(): void {
    const o = this.opts;
    this.host.emit({
      t: 'battleStart',
      battle: {
        kind: o.kind, bg: o.bg ?? 'field', bgm: o.kind === 'wild' ? 'battle_wild' : 'battle_trainer',
        ...(o.trainer ? { trainer: o.trainer } : {}), foeCount: this.foes.length,
        ...(o.multi ? { multi: {
          partner: { name: o.multi.partner.name, sprite: o.multi.partner.sprite },
          second: { name: o.multi.second.name, title: o.multi.second.title, sprite: o.multi.second.sprite }, foeCount2: this.foes2.length
        } } : {}),
        ...(this.coil.ally.enabled || this.coil.foe.enabled ? { coil: {
          ...(this.coil.ally.enabled ? { ally: this.coilView('ally') } : {}),
          ...(this.coil.foe.enabled ? { foe: this.coilView('foe') } : {})
        } } : {})
      }
    });
    if (o.multi && o.trainer) this.ev({ b: 'text', text: `${o.trainer.title} ${o.trainer.name} and ${o.multi.second.title} ${o.multi.second.name}\nwould like to battle!` });
    else if (o.trainer) this.ev({ b: 'text', text: `${o.trainer.title} ${o.trainer.name} would like to battle!` });
    for (const side of this.sides) this.sim.choose(side.id, 'default');
    // Pokémon that come in already fainted don't count (the simulator counts the whole team at the
    // start): otherwise it waits forever for a switch-in that doesn't exist once the last one faints.
    this.sim.p1.pokemonLeft = this.sim.p1.pokemon.filter(p => !p.fainted).length;
    for (const side of [this.sim.p1, this.sim.p2]) side.addSideCondition('hafniacoil', side.active[0]);
    if (o.tutorial) this.sim.p1.active[0].addVolatile('hafniaguard');
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
        const slot = req.active?.[0]?.moves?.filter((m: any) => m.id !== WAIT)[action.index];
        if (action.mode) {
          const why = coilBlock(action.mode, this.coil.ally, active, slot && Dex.moves.get(slot.id).category);
          if (why) { this.ev({ b: 'text', text: why }); return this.request(); }
        }
        const foes = this.opponents(p1);
        let target: number = action.target ?? 0;
        if (!foes[target] || foes[target].fainted) target = foes.findIndex(f => f && !f.fainted);
        if (!slot || !this.sim.choose('p1', this.moveChoice(action.index, slot.id, Math.max(0, target)))) {
          this.ev({ b: 'text', text: 'That move can\'t be used right now!' });
          return this.request();
        }
        if (action.mode) for (const e of this.activate('ally', action.mode)) this.ev(e);
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
        if (!item || item.pocket !== 'medicine' || !this.host.bag[action.item] || !target) return this.request();
        const fx = itemEffect(item, target.fainted ? 0 : target.hp, target.maxhp, (target.status || '') as StatusId);
        if (!fx) { this.ev({ b: 'text', text: 'It won\'t have any effect.' }); return this.request(); }
        this.host.bag[action.item]--;
        const before = target.fainted ? 0 : target.hp;
        this.ev({ b: 'text', text: `${this.host.playerName} used a ${item.name}!` });
        if (target.fainted) { target.fainted = false; target.faintQueued = false; (target as any).status = ''; target.hp = fx.hp; p1.pokemonLeft++; }
        else target.hp = fx.hp;
        if (fx.cure && target.status) {
          target.cureStatus(true);
          if (target.isActive) this.ev({ b: 'status', side: 'ally', status: '' });
        }
        if (target.isActive && target.hp !== before) this.ev({ b: 'hp', side: 'ally', hp: target.hp, maxhp: target.maxhp, effect: 'heal' });
        if (before === 0) this.ev({ b: 'text', text: `${target.name} was revived!` });
        else if (target.hp > before) this.ev({ b: 'text', text: `${target.name} recovered ${target.hp - before} HP.` });
        if (fx.cure) this.ev({ b: 'text', text: `${target.name} is healthy again.` });
        this.waitTurn();
        break;
      }
      case 'ball': {
        const ball = ITEMS[action.item];
        if (this.opts.kind !== 'wild') { this.ev({ b: 'text', text: 'The trainer blocked the ball!\nDon\'t be a thief!' }); return this.request(); }
        if (!ball?.ball || !this.host.bag[action.item]) return this.request();
        this.host.bag[action.item]--;
        this.ev({ b: 'text', text: `${this.host.playerName} threw a ${ball.name}!` });
        const foeTypes = this.sim.p2.active[0]?.getTypes() ?? [];
        const rate = action.item === 'netball' ? (foeTypes.some(t => t === 'Water' || t === 'Bug') ? 3.5 : 1) : ball.ball;
        if (this.throwBall(rate, action.item)) return this.advance();
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
      if (this.askNext()) return;
      if (this.ending) return this.finish(this.ending);
      if (this.sim.ended) return this.finish(this.won() ? 'win' : 'lose');
      const p1 = this.sim.p1;
      // The player decides first; the AI never sees that choice, only the field.
      if (p1.requestState && !p1.isChoiceDone()) return this.request();
      const next = this.sides.find(s => s !== p1 && s.requestState && !s.isChoiceDone());
      // A choice the simulator refuses (a target during Dig's second turn, say) falls back to its default.
      if (next) { if (!this.sim.choose(next.id, this.aiChoice(next))) this.sim.choose(next.id, 'default'); continue; }
      return;
    }
  }

  private won(): boolean {
    if (!this.opts.multi) return this.sim.winner === this.host.playerName;
    return this.sim.p2.pokemonLeft + this.sides[3].pokemonLeft === 0;
  }

  // ---------- learning moves mid-battle ----------

  private askNext(): boolean {
    if (this.asking) return true;
    const q = this.questions.shift();
    if (!q) return false;
    const m = this.host.party.find(x => x.uid === q.uid);
    if (!m) return this.askNext();
    this.asking = q;
    const name = monName(m), mv = Dex.moves.get(q.move).name;
    this.ev({ b: 'text', text: `${name} wants to learn ${mv}.\nBut ${name} already knows four moves.` });
    this.host.emit({
      t: 'prompt', text: `Forget a move to make room for ${mv}?`,
      options: [...m.moves.map(x => Dex.moves.get(x.id).name), `Don't learn ${mv}`], cancel: m.moves.length
    });
    return true;
  }

  /** The player's answer to a "forget a move?" prompt. */
  answer(index: number) {
    const q = this.asking;
    if (!q) return;
    this.asking = null;
    const m = this.host.party.find(x => x.uid === q.uid)!;
    const name = monName(m), mv = Dex.moves.get(q.move).name;
    if (index >= 0 && index < m.moves.length) {
      const old = Dex.moves.get(m.moves[index].id).name;
      replaceMove(m, index, q.move);
      const p = this.sim.p1.pokemon.find(x => (x.set as any).uid === m.uid);
      if (p) this.rebuildMoves(p, m);
      this.ev({ b: 'text', text: `1, 2 and... Poof!\n${name} forgot ${old}...` });
      this.ev({ b: 'text', text: `And... ${name} learned ${mv}!` });
    } else this.ev({ b: 'text', text: `${name} did not learn ${mv}.` });
    this.advance();
  }

  get waitingForAnswer() { return !!this.asking; }

  private request() {
    const p1 = this.sim.p1, req = p1.activeRequest as any;
    this.syncParty();
    const active = p1.active[0];
    const moves = req?.active?.[0]?.moves ?? [];
    const targets = this.opts.multi
      ? this.opponents(p1).map((f, i) => ({ slot: i as Slot, name: f?.name ?? '', fainted: !f || f.fainted })).filter(f => !f.fainted).map(({ slot, name }) => ({ slot, name }))
      : [];
    const out: BattleRequest = {
      moves: moves.filter((m: any) => m.id !== WAIT)
        .map((m: any) => ({
          ...moveView(m.id, m.pp ?? 0, m.maxpp ?? 0, m.disabled === true || m.pp === 0),
          ...(targets.length > 1 && AIMED.has(Dex.moves.get(m.id).target) ? { aim: true } : {})
        })),
      forceSwitch: !!req?.forceSwitch,
      ...(req?.active?.[0]?.trapped ? { trapped: true } : {}),
      canCatch: this.opts.kind === 'wild',
      canRun: this.opts.kind === 'wild',
      activeUid: (active?.set as any)?.uid ?? '',
      party: this.host.party.map(monView),
      bag: { ...this.host.bag },
      ...(this.opts.multi ? { targets } : {})
    };
    const c = this.coil.ally;
    if (c.enabled && active && !req?.forceSwitch) {
      out.coil = { ...this.coilView('ally'), copper: coilBlock('copper', c, active), current: coilBlock('current', c, active) };
    }
    this.host.emit({ t: 'battleRequest', request: out });
  }

  private aiChoice(side: SimSide): string {
    const req = side.activeRequest as any;
    if (req.forceSwitch) {
      const pos = side.pokemon.findIndex(p => !p.fainted && !p.isActive);
      return pos >= 0 ? `switch ${pos + 1}` : 'pass';
    }
    const moves: any[] = req.active[0].moves;
    const usable = moves.map((m, i) => ({ m, i, mv: Dex.moves.get(m.id) })).filter(({ m }) => m.id !== WAIT && !m.disabled && m.pp !== 0);
    if (!usable.length) return 'default';
    const tier = side === this.sides[2] ? this.opts.multi?.partner.ai ?? 2 : this.ai();
    if (tier >= 3 && side === this.sim.p2 && !this.opts.multi) {
      const expert = this.expertChoice(side, usable.map(u => u.mv));
      if (expert) return expert;
    }
    const me = side.active[0];
    const targets = this.opponents(side).map((p, t) => ({ p, t })).filter(x => x.p && !x.p.fainted);
    // Tier 2+ aims at whichever opponent its best move hurts most; lower tiers pick a target at random.
    let aim = targets.length ? this.host.rng.pick(targets) : { p: this.sim.p1.active[0], t: 0 };
    if (tier >= 2 && targets.length > 1) {
      const best = (x: typeof aim) => Math.max(0, ...usable.filter(u => u.mv.category !== 'Status').map(u => this.estimateDamage(me, x.p, u.mv) / Math.max(1, 100 * x.p.hp / x.p.maxhp)));
      aim = targets.reduce((a, b) => (best(b) > best(a) ? b : a));
    }
    let foe = aim.p;
    // Tier 3, once per battle: when the player's Pokémon is in obvious danger and has a teammate that
    // resists the AI's best hit, expect the switch and pick the move that is best against that teammate.
    if (tier >= 3 && !this.opts.multi && !this.expert.predicted) {
      const comingIn = this.likelySwitchIn(me, foe, usable.map(u => u.mv));
      if (comingIn) { this.expert.predicted = true; foe = comingIn; }
    }
    const foeHpPct = 100 * foe.hp / foe.maxhp;
    // Useless: a status move on a foe that already has one, or an attack it is immune to or doubly resists.
    const useless = (mv: ReturnType<typeof Dex.moves.get>) => mv.category === 'Status'
      ? !!mv.status && !!foe.status
      : !Dex.getImmunity(mv.type, foe.getTypes()) || Dex.getEffectiveness(mv.type, foe.getTypes()) < -1;
    let pick: (typeof usable)[number] & { pct?: number };
    if (tier === 0) pick = this.host.rng.pick(usable);
    else if (tier === 1) {
      const ok = usable.filter(x => !useless(x.mv));
      pick = this.host.rng.pick(ok.length ? ok : usable);
    } else {
      // Tier 2+: score by expected damage (% of the foe's HP) or a simple value for status moves.
      const scored = usable.map(x => {
        const mv = x.mv;
        if (mv.category !== 'Status') {
          const pct = this.estimateDamage(me, foe, mv);
          return { ...x, pct, score: pct >= foeHpPct ? 200 + (mv.priority > 0 ? 20 : 0) : pct };
        }
        let score = 5;
        if (mv.status && !foe.status && foeHpPct > 50) score = mv.status === 'slp' ? 45 : 35;
        else if (mv.target === 'self' && mv.boosts && this.turn <= 1) score = 30;
        else if (mv.boosts && mv.target !== 'self') score = 15;
        if (useless(mv)) score = 0;
        return { ...x, pct: 0, score };
      }).sort((a, b) => b.score - a.score);
      pick = scored.length > 1 && this.host.rng.chance(0.2) ? scored[1] : scored[0];
    }
    const c = this.coil.foe;
    if (side === this.sim.p2 && c.enabled && !c.used && c.pips >= this.host.rules.coil.ready) {
      const pct = pick.pct ?? (pick.mv.category === 'Status' ? 0 : this.estimateDamage(me, foe, pick.mv));
      let mode: CoilMode | 'overcharge' | '' = '';
      if (c.overcharge) mode = 'overcharge';
      else if (c.unlocks.current && pick.mv.category !== 'Status' && (pct * this.host.rules.coil.currentPower >= foeHpPct || pct >= 40)) mode = 'current';
      else if (c.unlocks.copper && 100 * me.hp / me.maxhp > 50 && foe.getTypes().some(t => Dex.getImmunity(t, me.getTypes()) && Dex.getEffectiveness(t, me.getTypes()) > 0)) mode = 'copper';
      if (mode) for (const e of this.activate('foe', mode)) this.ev(e);
    }
    return this.moveChoice(pick.i, pick.mv.id, aim.t);
  }

  /** Tier 3 between-turn decisions: a Potion when low (twice per battle) or a switch to a teammate that resists. */
  private expertChoice(side: SimSide, moves: MoveData[]): string | null {
    const me = side.active[0], foe = this.sim.p1.active[0], req = side.activeRequest as any;
    if (!me || !foe || foe.fainted) return null;
    const myPct = 100 * me.hp / me.maxhp, foePct = 100 * foe.hp / foe.maxhp;
    const canKo = moves.some(mv => mv.category !== 'Status' && this.estimateDamage(me, foe, mv) >= foePct);
    const waitIdx = (req.active[0].moves as any[]).findIndex(m => m.id === WAIT);
    if (this.expert.potions < 2 && myPct < 25 && !canKo && waitIdx >= 0) {
      this.expert.potions++;
      const hyper = me.level >= 30, before = me.hp;
      me.hp = Math.min(me.maxhp, me.hp + (hyper ? 120 : 60));
      this.ev({ b: 'text', text: `${this.opts.trainer?.name ?? 'The trainer'} used a ${hyper ? 'Hyper' : 'Super'} Potion!` });
      this.ev({ b: 'hp', side: 'foe', hp: me.hp, maxhp: me.maxhp, effect: 'heal' });
      this.ev({ b: 'text', text: `${this.nameOf(`p2a: ${me.name}`)} recovered ${me.hp - before} HP.` });
      return `move ${waitIdx + 1}`;
    }
    const threat = this.threatTo(foe, me);
    if (threat && this.expert.switches < 2 && !req.active[0].trapped && threat.pct * 2 >= myPct && !canKo) {
      const pos = side.pokemon.findIndex(p => !p.fainted && !p.isActive
        && (!Dex.getImmunity(threat.type, p.getTypes()) || Dex.getEffectiveness(threat.type, p.getTypes()) < 0));
      if (pos >= 0) { this.expert.switches++; return `switch ${pos + 1}`; }
    }
    return null;
  }

  /** The strongest super-effective hit `att` is known to have on `def`: its own types (STAB) and the moves it has used. */
  private threatTo(att: SimPokemon, def: SimPokemon): { type: string; pct: number } | null {
    const types = new Set<string>(att.getTypes());
    for (const sl of att.moveSlots) if (sl.used && sl.id !== WAIT) { const mv = Dex.moves.get(sl.id); if (mv.category !== 'Status') types.add(mv.type); }
    const category = att.getStat('atk', false, true) >= att.getStat('spa', false, true) ? 'Physical' : 'Special';
    let best: { type: string; pct: number } | null = null;
    for (const type of types) {
      if (!Dex.getImmunity(type, def.getTypes()) || Dex.getEffectiveness(type, def.getTypes()) <= 0) continue;
      const pct = this.estimateDamage(att, def, { type, category, basePower: 75 } as MoveData);
      if (!best || pct > best.pct) best = { type, pct };
    }
    return best;
  }

  /** The player's teammate that resists the AI's best super-effective hit on the current foe, if that hit is a 2HKO. */
  private likelySwitchIn(me: SimPokemon, foe: SimPokemon, moves: MoveData[]): SimPokemon | null {
    const hits = moves.filter(mv => mv.category !== 'Status' && Dex.getEffectiveness(mv.type, foe.getTypes()) > 0)
      .map(mv => ({ mv, pct: this.estimateDamage(me, foe, mv) })).sort((a, b) => b.pct - a.pct);
    const top = hits[0];
    if (!top || top.pct * 2 < 100 * foe.hp / foe.maxhp || top.pct >= 100 * foe.hp / foe.maxhp) return null;
    return this.sim.p1.pokemon.find(p => !p.fainted && !p.isActive
      && (!Dex.getImmunity(top.mv.type, p.getTypes()) || Dex.getEffectiveness(top.mv.type, p.getTypes()) < 0)) ?? null;
  }

  /** Average damage of a move as a percentage of the target's max HP (no crits, mean roll). */
  private estimateDamage(me: SimPokemon, foe: SimPokemon, mv: MoveData): number {
    if (!Dex.getImmunity(mv.type, foe.getTypes())) return 0;
    const phys = mv.category === 'Physical';
    const atk = me.getStat(phys ? 'atk' : 'spa', false, true), def = Math.max(1, foe.getStat(phys ? 'def' : 'spd', false, true));
    const bp = mv.basePower || 60;
    let dmg = Math.floor(Math.floor(Math.floor(2 * me.level / 5 + 2) * bp * atk / def) / 50) + 2;
    if (me.hasType(mv.type)) dmg *= 1.5;
    dmg *= 2 ** Dex.getEffectiveness(mv.type, foe.getTypes()) * 0.925;
    if (mv.multihit) dmg *= Array.isArray(mv.multihit) ? 3 : mv.multihit;
    return 100 * dmg / foe.maxhp;
  }

  /** Gen 9 capture (systems.md §2.5): three shake checks; low-level and badge modifiers. */
  private throwBall(mult: number, ballId: string): boolean {
    const foe = this.sim.p2.active[0], mon = this.monOf(foe)!;
    const rate = speciesExtra(mon.species).catchRate;
    const statusBonus = foe.status === 'slp' || foe.status === 'frz' ? 2.5 : foe.status ? 1.5 : 1;
    let a = ((3 * foe.maxhp - 2 * foe.hp) * rate * mult * statusBonus) / (3 * foe.maxhp);
    if (mon.level < 13) a *= (36 - mon.level) / 10;
    const cap = this.host.rules.obedienceBase + this.host.rules.obediencePerBadge * this.host.badges;
    if (mon.level > cap) a *= 0.1;
    let shakes = 0;
    if (a >= 255) shakes = 3;
    else {
      const b = 65536 / (255 / Math.max(0.01, a)) ** 0.1875;
      while (shakes < 3 && this.host.rng.int(65536) < b) shakes++;
    }
    const caught = shakes === 3;
    this.ev({ b: 'throw', shakes, caught, ball: ballId });
    if (!caught) {
      this.ev({ b: 'text', text: ['Oh no! The Pokémon broke free!', 'Aww! It appeared to be caught!', 'Aargh! Almost had it!'][shakes] });
      return false;
    }
    mon.hp = foe.hp; mon.status = (foe.status === 'tox' ? 'psn' : foe.status) as StatusId;
    mon.ot = this.host.playerName; mon.ball = ballId;
    this.host.emit({ t: 'me', name: 'me_catch' });
    this.ev({ b: 'text', text: `Gotcha! ${mon.nickname ?? speciesName(mon.species)} was caught!` });
    this.awardExp(foe); // catching gives EXP like a knockout (Gen 6+)
    const where = this.host.addMon(mon);
    this.ev({ b: 'text', text: where === 'party' ? `${speciesName(mon.species)} joined your team!` : `Your team is full, so ${speciesName(mon.species)} was sent to the PC.` });
    this.ending = 'caught';
    return true;
  }

  private finish(result: BattleResult) {
    this.result = result;
    this.syncParty();
    if (result === 'win' && this.opts.kind === 'trainer' && this.opts.trainer) {
      const t = this.opts.trainer;
      this.host.emit({ t: 'bgm', name: this.opts.leader ? 'victory_leader' : 'victory_trainer' });
      const m = this.opts.multi;
      this.ev({ b: 'text', text: m ? `You defeated ${t.title} ${t.name}\nand ${m.second.title} ${m.second.name}!` : `You defeated ${t.title} ${t.name}!` });
      const rules = this.host.rules;
      const base = (title: string) => this.opts.prize ?? rules.prizeBase[title] ?? rules.prizeDefault;
      const prize = this.foes[this.foes.length - 1].level * base(t.title) + (m ? this.foes2[this.foes2.length - 1].level * base(m.second.title) : 0);
      this.host.giveMoney(prize);
      this.ev({ b: 'text', text: `You got ${prize} kr. for winning!` });
    } else if (result === 'win') this.host.emit({ t: 'bgm', name: 'victory_wild' });
    else if (result === 'lose') {
      if (this.opts.soft) this.ev({ b: 'text', text: 'You lost the battle...' });
      else {
        this.ev({ b: 'text', text: `${this.host.playerName} has no Pokémon that can fight!` });
        const lost = this.host.whiteout();
        if (lost) this.ev({ b: 'text', text: `${this.host.playerName} panicked and dropped ${lost} kr...` });
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

  /** Exp Share is always on: every healthy party member gets Exp, the ones that didn't fight `benchExp` of it
   *  (systems.md §2.6). Above the soft cap for the badges held, Exp slows to a trickle so the next leader stays a fight. */
  private capSaid = false;
  private awardExp(fainted: SimPokemon) {
    const foe = this.monOf(fainted)!;
    const b = speciesExtra(foe.species).baseExp, L = foe.level;
    const trainer = this.opts.kind === 'trainer' ? 1.5 : 1;
    const active = this.sim.p1.active[0];
    const team = this.sim.p1.pokemon.filter(p => !p.fainted && p.hp > 0 && this.monOf(p)!.level < 100);
    team.sort((x, y) => Number(y === active) - Number(x === active));
    const rules = this.host.rules, cap = rules.levelCaps[this.host.badges] ?? Infinity;
    let sharedSaid = false;
    for (const p of team) {
      const m = this.monOf(p)!, Lp = m.level;
      const full = (b * L / 5) * trainer * ((2 * L + 10) / (L + Lp + 10)) ** 2.5 + 1;
      const amount = Math.max(1, Math.floor(full * (p === active ? 1 : rules.benchExp) * (Lp >= cap ? rules.overCapExp : 1)));
      if (p === active) this.ev({ b: 'text', text: `${p.name} gained ${amount} Exp. Points!` });
      if (p === active && Lp >= cap && !this.capSaid) { this.capSaid = true; this.ev({ b: 'text', text: `${p.name} is already a match for the next Gym\nLeader, so it learns less from battles now.` }); }
      else if (!sharedSaid) { sharedSaid = true; this.ev({ b: 'text', text: 'The rest of your team gained Exp. Points\nthanks to the Exp. Share!' }); }
      const steps = gainExp(m, amount);
      for (const step of steps) {
        this.leveled.add(m.uid);
        this.syncLevel(p, m);
        if (p === active) this.expEvent(p, m);
        this.host.emit({ t: 'me', name: 'me_item' });
        this.ev({ b: 'text', text: `${p.name} grew to Lv. ${step.level}!` });
        for (const id of step.learned) this.ev({ b: 'text', text: `${p.name} learned ${Dex.moves.get(id).name}!` });
        if (step.learned.length) this.rebuildMoves(p, m);
        for (const id of step.pending) this.questions.push({ uid: m.uid, move: id });
      }
      if (!steps.length && p === active) this.expEvent(p, m);
    }
  }

  /** Mirrors a level-up onto the simulator's copy of the Pokémon. */
  private syncLevel(p: SimPokemon, m: Mon) {
    const before = p.maxhp;
    const stats = calcStats(m);
    (p as any).level = m.level; (p.set as any).level = m.level;
    p.baseMaxhp = p.maxhp = stats.hp;
    p.hp = Math.max(0, Math.min(stats.hp, p.hp + stats.hp - before));
    const { hp, ...rest } = stats;
    void hp;
    Object.assign(p.baseStoredStats, rest); Object.assign(p.storedStats, rest);
    p.details = (p as any).getUpdatedDetails?.() ?? p.details;
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

  private sideOf(ident: string): BattleSide { return ident.startsWith('p1') || ident.startsWith('p3') ? 'ally' : 'foe'; }
  /** p3 and p4 stand in the second place of their side. */
  private slotOf(ident: string): { slot?: Slot } { return ident.startsWith('p3') || ident.startsWith('p4') ? { slot: 1 } : {}; }
  private simSide(ident: string): SimSide { return this.sides[Number(ident[1]) - 1] ?? this.sim.p1; }
  private pokemonOf(ident: string): SimPokemon | undefined {
    const name = ident.slice(ident.indexOf(':') + 1).trim();
    const list = this.simSide(ident).pokemon.filter(p => p.name === name);
    return list.find(p => p.isActive) ?? list[0];
  }
  private nameOf(ident: string, start = true): string {
    const name = ident.slice(ident.indexOf(':') + 1).trim();
    if (ident.startsWith('p3')) return `${this.opts.multi!.partner.name}'s ${name}`;
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
        case 'turn': {
          this.turn = Number(a1);
          if (this.turn >= 2) for (const side of ['ally', 'foe'] as BattleSide[]) {
            const s = side === 'ally' ? this.sim.p1 : this.sim.p2;
            if (s.active[0] && !s.active[0].fainted) this.charge(side, 1, evs);
          }
          break;
        }
        case '-zbroken': evs.push({ b: 'text', text: `${this.nameOf(a1)} couldn't fully protect itself\nand got hurt!` }); break;
        case 'switch': case 'drag': {
          const p = this.pokemonOf(a1)!, side = this.sideOf(a1);
          const m = this.opts.multi;
          let text = a1.startsWith('p3') ? `${m!.partner.name} sent out ${p.name}!`
            : a1.startsWith('p4') ? `${m!.second.title} ${m!.second.name} sent out ${p.name}!`
            : side === 'ally' ? `Go! ${p.name}!` : this.opts.kind === 'wild' ? `A wild ${p.name} appeared!`
            : `${this.opts.trainer!.title} ${this.opts.trainer!.name} sent out ${p.name}!`;
          if (cmd === 'drag') text = `${this.nameOf(a1)} was dragged out!`;
          evs.push({ b: 'switch', side, ...this.slotOf(a1), mon: this.monView(p), text });
          break;
        }
        case 'move': {
          if (a2 === 'Hafnia Wait') break;
          const mv = Dex.moves.get(a2);
          const flag = (k: string) => parts.includes(`[${k}]`);
          evs.push({
            b: 'move', side: this.sideOf(a1), ...this.slotOf(a1), text: `${this.nameOf(a1)} used ${mv.name}!`, id: mv.id, type: mv.type.toLowerCase(), category: mv.category,
            ...(a3 && !flag('notarget') ? { target: this.sideOf(a3), ...(this.slotOf(a3).slot ? { targetSlot: 1 as Slot } : {}) } : {}), ...(flag('miss') ? { miss: true } : {}), ...(flag('still') ? { still: true } : {})
          });
          break;
        }
        case '-damage': case '-heal': case '-sethp': {
          const [hp, rest] = a2.split(' ');
          const [cur, max] = hp.split('/').map(Number);
          const side = this.sideOf(a1);
          const effect = cmd === '-heal' ? 'heal' : from ? 'residual' : (this.pendingEffect ?? 'normal');
          this.pendingEffect = null;
          const crit = !from && this.pendingCrit; this.pendingCrit = false;
          const cause = from?.replace(/^(item|ability|move): /, '').toLowerCase().replace(/[^a-z]/g, '');
          evs.push({ b: 'hp', side, ...this.slotOf(a1), hp: cur || 0, maxhp: max || this.pokemonOf(a1)?.maxhp || 1, effect, ...(crit ? { crit } : {}), ...(cause ? { cause } : {}) });
          if (!from) flushAfterHit();
          if (from) {
            const src = from.replace(/^(item|ability|move): /, '');
            const sub = { brn: 'its burn', psn: 'poison', tox: 'poison', confusion: 'confusion', 'Hafnia Overcharge': 'its Overcharge' }[src];
            if (cmd === '-damage' && sub) evs.push({ b: 'text', text: sub === 'confusion' ? 'It hurt itself in its confusion!' : `${this.nameOf(a1)} was hurt by ${sub}!` });
            else if (cmd === '-heal' && from.startsWith('item')) evs.push({ b: 'text', text: `${this.nameOf(a1)} restored a little HP using its ${src}!` });
            else if (cmd === '-damage' && from.startsWith('item')) evs.push({ b: 'text', text: `${this.nameOf(a1)} was hurt by its ${src}!` });
          }
          break;
        }
        case '-supereffective': {
          this.pendingEffect = 'super'; afterHit.push({ b: 'text', text: 'It\'s super effective!' });
          const side = this.sideOf(a1), c = this.coil[side];
          if (c.seTurn !== this.turn) { c.seTurn = this.turn; this.charge(side, 1, afterHit); }
          break;
        }
        case '-resisted': this.pendingEffect = 'weak'; afterHit.push({ b: 'text', text: 'It\'s not very effective...' }); break;
        case '-crit': this.pendingCrit = true; afterHit.unshift({ b: 'text', text: 'A critical hit!' }); break;
        case '-miss': evs.push({ b: 'text', text: a2 ? `${this.nameOf(a2)} avoided the attack!` : `${this.nameOf(a1)}'s attack missed!` }); break;
        case '-immune': evs.push({ b: 'text', text: `It doesn't affect ${this.nameOf(a1, false)}...` }); break;
        case '-fail': evs.push({ b: 'text', text: 'But it failed!' }); break;
        case '-ohko': evs.push({ b: 'text', text: 'It\'s a one-hit KO!' }); break;
        case '-hitcount': evs.push({ b: 'text', text: `The Pokémon was hit ${a2} time${a2 === '1' ? '' : 's'}!` }); break;
        case '-status': {
          evs.push({ b: 'status', side: this.sideOf(a1), ...this.slotOf(a1), status: a2 as StatusId });
          evs.push({ b: 'text', text: `${this.nameOf(a1)} ${STATUS_TEXT[a2] ?? 'was afflicted!'}` });
          break;
        }
        case '-curestatus': {
          evs.push({ b: 'status', side: this.sideOf(a1), ...this.slotOf(a1), status: '' });
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
          if (n !== 0) evs.push({ b: 'boost', side: this.sideOf(a1), ...this.slotOf(a1), up });
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
          else if (eff === 'Patina') evs.push({ b: 'text', text: `${this.nameOf(a1)}'s patina kept its defenses\nfrom dropping!` });
          else if (eff === 'Live Wire') evs.push({ b: 'text', text: `Live Wire! The Coil's spark jolts\n${this.nameOf(a1, false)} into action!` });
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
          const upkeep = parts.includes('[upkeep]');
          const weather = ({ RainDance: 'rain', SunnyDay: 'sun', Sandstorm: 'sand', Snow: 'snow', none: 'none' } as const)[a1 as 'none'];
          if (weather) evs.push({ b: 'weather', weather, ...(upkeep ? { upkeep } : {}) });
          if (!upkeep && w[a1]) evs.push({ b: 'text', text: w[a1] });
          break;
        }
        case '-prepare': evs.push({ b: 'text', text: `${this.nameOf(a1)} is preparing ${a2}!` }); break;
        case '-mustrecharge': break;
        case 'faint': {
          const p = this.pokemonOf(a1)!, side = this.sideOf(a1);
          evs.push({ b: 'faint', side, ...this.slotOf(a1), text: `${this.nameOf(a1)} fainted!` });
          this.charge(side, 1, evs);
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
