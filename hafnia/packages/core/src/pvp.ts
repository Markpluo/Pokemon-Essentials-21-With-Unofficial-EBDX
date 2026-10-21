// Player-versus-player battles for the online server. Both sides are people, so unlike
// BattleSession there is no AI, no catching, running, items, EXP or Coil (online v1 rules).
// Teams are full-health copies: a PvP battle never changes the players' saved Pokémon.
// Every event is produced twice, once from each player's point of view ("ally" is always you).
import { Battle, Dex } from '@pkmn/sim';
import { healMon, maxPp, monName, monView, moveView, speciesExtra, speciesName, type Mon } from './pokemon';
import type { BattleAction, BattleEvent, BattleMonView, BattleRequest, BattleSide, ServerEvent, StatusId } from './protocol';
import type { Rng } from './rng';

export interface PvpPlayer { name: string; party: Mon[] }
type Side = 0 | 1;
type SimSide = Battle['p1'];
type SimPokemon = SimSide['pokemon'][number];

const STAT_NAMES: Record<string, string> = {
  atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', accuracy: 'accuracy', evasion: 'evasiveness'
};
const STATUS_TEXT: Record<string, string> = {
  brn: 'was burned!', par: 'is paralyzed! It may be unable to move!', psn: 'was poisoned!',
  tox: 'was badly poisoned!', slp: 'fell asleep!', frz: 'was frozen solid!'
};
const CANT_TEXT: Record<string, string> = {
  par: 'is paralyzed! It can\'t move!', slp: 'is fast asleep.', frz: 'is frozen solid!',
  flinch: 'flinched and couldn\'t move!', Attract: 'is immobilized by love!', recharge: 'must recharge!'
};

export class PvpBattle {
  /** The winning side once the battle is over. */
  winner: Side | null = null;
  private sim: Battle;
  private teams: [Mon[], Mon[]];
  private logIndex = 0;
  private out: [ServerEvent[], ServerEvent[]] = [[], []];

  constructor(private players: [PvpPlayer, PvpPlayer], rng: Rng, private bg = 'city') {
    this.teams = players.map(p => p.party.slice(0, 6).map(m => { const c = structuredClone(m); healMon(c); return c; })) as [Mon[], Mon[]];
    this.sim = new Battle({ formatid: 'gen9customgame' as any, seed: rng.simSeed() as any });
    this.sim.setPlayer('p1', { name: 'p1', team: this.teams[0].map(toSet) as any });
    this.sim.setPlayer('p2', { name: 'p2', team: this.teams[1].map(toSet) as any });
    for (const side of [this.sim.p1, this.sim.p2]) for (const p of side.pokemon) for (const slot of p.baseMoveSlots) slot.pp = slot.maxpp = maxPp(slot.id);
    this.logIndex = this.sim.log.length;
  }

  get over() { return this.winner !== null; }

  /** Opens the battle: returns each player's events. */
  start(): [ServerEvent[], ServerEvent[]] {
    for (const i of [0, 1] as Side[]) {
      const foe = this.players[1 - i];
      this.out[i].push(
        { t: 'battleStart', battle: { kind: 'trainer', bg: this.bg, bgm: 'battle_trainer', trainer: { name: foe.name, title: 'Trainer', sprite: 'tr/player' }, foeCount: this.teams[1 - i].length } },
        { t: 'battle', ev: { b: 'text', text: `You are challenged by ${foe.name}!` } }
      );
    }
    this.sim.choose('p1', 'default');
    this.sim.choose('p2', 'default');
    this.advance();
    return this.flush();
  }

  /** A player's choice. Invalid choices re-send that player's request with a reason. */
  choose(i: Side, action: BattleAction): [ServerEvent[], ServerEvent[]] {
    if (this.over) return this.flush();
    const side = this.side(i), req = side.activeRequest as any;
    if (!req || !side.requestState || side.isChoiceDone()) return this.flush();
    let choice: string | null = null;
    if (action.kind === 'move' && !req.forceSwitch) {
      const slot = req.active?.[0]?.moves?.[action.index];
      if (slot && !slot.disabled && slot.pp !== 0) choice = `move ${action.index + 1}`;
    } else if (action.kind === 'switch') {
      const pos = side.pokemon.findIndex(p => (p.set as any).uid === action.uid);
      const p = side.pokemon[pos];
      if (p && !p.fainted && !p.isActive) choice = `switch ${pos + 1}`;
    }
    const otherPending = this.waiting().includes((1 - i) as Side);
    if (!choice || !this.sim.choose(this.sid(i), choice)) {
      this.out[i].push({ t: 'battle', ev: { b: 'text', text: action.kind === 'move' || action.kind === 'switch' ? 'That can\'t be done right now!' : 'You can\'t do that in a battle against another trainer!' } });
      this.request(i);
      return this.flush();
    }
    // Showdown runs the turn as soon as the last choice is in.
    if (otherPending) this.out[i].push({ t: 'notice', text: `Waiting for ${this.players[1 - i].name}...` });
    else this.advance();
    return this.flush();
  }

  /** Players who still owe a choice this turn (for the server's turn timer). */
  waiting(): Side[] {
    if (this.over) return [];
    return ([0, 1] as Side[]).filter(i => { const s = this.side(i); return !!s.requestState && !s.isChoiceDone(); });
  }

  /** The turn timer ran out: the simulator picks for whoever hasn't chosen. */
  timeout(): [ServerEvent[], ServerEvent[]] {
    for (const i of this.waiting()) {
      this.out[i].push({ t: 'battle', ev: { b: 'text', text: 'Time\'s up! A move was chosen for you.' } });
      this.sim.choose(this.sid(i), 'default');
    }
    this.advance();
    return this.flush();
  }

  /** A player gave up or left: the other one wins. */
  forfeit(i: Side): [ServerEvent[], ServerEvent[]] {
    if (this.over) return this.flush();
    this.out[i].push({ t: 'battle', ev: { b: 'text', text: 'You forfeited the battle.' } });
    this.out[1 - i].push({ t: 'battle', ev: { b: 'text', text: `${this.players[i].name} forfeited the battle!` } });
    this.finish((1 - i) as Side);
    return this.flush();
  }

  // ---------- flow ----------

  private side(i: Side): SimSide { return i === 0 ? this.sim.p1 : this.sim.p2; }
  private sid(i: Side) { return i === 0 ? 'p1' as const : 'p2' as const; }

  private advance() {
    this.translate();
    if (this.sim.ended) return this.finish(this.sim.p1.pokemonLeft > 0 ? 0 : 1);
    for (const i of this.waiting()) this.request(i);
  }

  private finish(winner: Side) {
    this.winner = winner;
    for (const i of [0, 1] as Side[]) {
      const won = i === winner;
      if (won) this.out[i].push({ t: 'bgm', name: 'victory_trainer' });
      this.out[i].push(
        { t: 'battle', ev: { b: 'text', text: won ? `You defeated ${this.players[1 - i].name}!` : `You lost to ${this.players[1 - i].name}...` } },
        { t: 'battleEnd', result: won ? 'win' : 'lose' }
      );
    }
  }

  private flush(): [ServerEvent[], ServerEvent[]] {
    const o = this.out;
    this.out = [[], []];
    return o;
  }

  private request(i: Side) {
    const side = this.side(i), req = side.activeRequest as any;
    const team = this.teams[i];
    for (const p of side.pokemon) {
      const m = team.find(x => x.uid === (p.set as any).uid);
      if (m) { m.hp = p.fainted ? 0 : p.hp; m.status = (p.fainted ? '' : p.status || '') as StatusId; }
    }
    const moves = req?.active?.[0]?.moves ?? [];
    const order = side.pokemon.map(p => team.find(m => m.uid === (p.set as any).uid)!).filter(Boolean);
    const out: BattleRequest = {
      moves: moves.map((m: any) => moveView(m.id, m.pp ?? 0, m.maxpp ?? 0, m.disabled === true || m.pp === 0)),
      forceSwitch: !!req?.forceSwitch,
      canCatch: false, canRun: false,
      activeUid: (side.active[0]?.set as any)?.uid ?? '',
      party: order.map(monView),
      bag: {}
    };
    this.out[i].push({ t: 'battleRequest', request: out });
  }

  // ---------- Showdown protocol -> BattleEvents, once per point of view ----------

  private translate() {
    const raw = this.sim.log.slice(this.logIndex);
    this.logIndex = this.sim.log.length;
    // "|split|pN" is followed by the exact line and then the public one. Exact HP for both sides is fine here.
    const lines: string[] = [];
    for (let k = 0; k < raw.length; k++) {
      if (raw[k].startsWith('|split|')) { lines.push(raw[k + 1]); k += 2; } else lines.push(raw[k]);
    }
    for (const i of [0, 1] as Side[]) {
      const evs = this.events(lines, i);
      // The opening switch-ins: show the opponent's Pokémon first, like the main games.
      const a = evs.findIndex(e => e.b === 'switch' && e.side === 'ally'), f = evs.findIndex(e => e.b === 'switch' && e.side === 'foe');
      if (a >= 0 && f > a && !this.introDone[i]) evs.splice(a, 0, evs.splice(f, 1)[0]);
      this.introDone[i] = true;
      for (const ev of evs) this.out[i].push({ t: 'battle', ev });
    }
  }
  private introDone = [false, false];

  private events(lines: string[], me: Side): BattleEvent[] {
    const mine = me === 0 ? 'p1' : 'p2';
    const sideOf = (ident: string): BattleSide => (ident.startsWith(mine) ? 'ally' : 'foe');
    const foeName = this.players[1 - me].name;
    const name = (ident: string, start = true) => {
      const n = ident.slice(ident.indexOf(':') + 1).trim();
      return sideOf(ident) === 'ally' ? n : `${start ? 'The' : 'the'} opposing ${n}`;
    };
    const evs: BattleEvent[] = [];
    let afterHit: BattleEvent[] = [];
    let pending: 'super' | 'weak' | null = null;
    for (const line of lines) {
      const parts = line.split('|').slice(1);
      const [cmd, a1 = '', a2 = '', a3 = ''] = parts;
      const from = parts.find(x => x.startsWith('[from]'))?.slice(6).trim();
      if (cmd !== '-damage' && cmd !== '-supereffective' && cmd !== '-resisted' && cmd !== '-crit') { evs.push(...afterHit); afterHit = []; }
      switch (cmd) {
        case 'switch': case 'drag': {
          const p = this.pokemonOf(a1);
          if (!p) break;
          const side = sideOf(a1);
          const text = cmd === 'drag' ? `${name(a1)} was dragged out!` : side === 'ally' ? `Go! ${p.name}!` : `${foeName} sent out ${p.name}!`;
          evs.push({ b: 'switch', side, mon: this.view(p), text });
          break;
        }
        case 'move': {
          const mv = Dex.moves.get(a2);
          evs.push({ b: 'move', side: sideOf(a1), text: `${name(a1)} used ${mv.name}!`, type: mv.type.toLowerCase(), category: mv.category });
          break;
        }
        case '-damage': case '-heal': case '-sethp': {
          const [cur, max] = a2.split(' ')[0].split('/').map(Number);
          const effect = cmd === '-heal' ? 'heal' : from ? 'residual' : (pending ?? 'normal');
          pending = null;
          evs.push({ b: 'hp', side: sideOf(a1), hp: cur || 0, maxhp: max || 1, effect });
          if (!from) { evs.push(...afterHit); afterHit = []; }
          else {
            const src = from.replace(/^(item|ability|move): /, '');
            const sub = ({ brn: 'its burn', psn: 'poison', tox: 'poison', confusion: 'confusion' } as Record<string, string>)[src];
            if (cmd === '-damage' && sub) evs.push({ b: 'text', text: sub === 'confusion' ? 'It hurt itself in its confusion!' : `${name(a1)} was hurt by ${sub}!` });
          }
          break;
        }
        case '-supereffective': pending = 'super'; afterHit.push({ b: 'text', text: 'It\'s super effective!' }); break;
        case '-resisted': pending = 'weak'; afterHit.push({ b: 'text', text: 'It\'s not very effective...' }); break;
        case '-crit': afterHit.unshift({ b: 'text', text: 'A critical hit!' }); break;
        case '-miss': evs.push({ b: 'text', text: a2 ? `${name(a2)} avoided the attack!` : `${name(a1)}'s attack missed!` }); break;
        case '-immune': evs.push({ b: 'text', text: `It doesn't affect ${name(a1, false)}...` }); break;
        case '-fail': evs.push({ b: 'text', text: 'But it failed!' }); break;
        case '-status':
          evs.push({ b: 'status', side: sideOf(a1), status: a2 as StatusId }, { b: 'text', text: `${name(a1)} ${STATUS_TEXT[a2] ?? 'was afflicted!'}` });
          break;
        case '-curestatus': {
          const t = a2 === 'slp' ? 'woke up!' : a2 === 'frz' ? 'thawed out!' : a2 === 'par' ? 'was cured of paralysis.' : 'was cured!';
          evs.push({ b: 'status', side: sideOf(a1), status: '' }, { b: 'text', text: `${name(a1)} ${t}` });
          break;
        }
        case 'cant': evs.push({ b: 'text', text: `${name(a1)} ${CANT_TEXT[a2.replace(/^(move|ability): /, '')] ?? 'can\'t move!'}` }); break;
        case '-boost': case '-unboost': {
          const n = Number(a3), up = cmd === '-boost';
          const amount = n === 0 ? (up ? 'won\'t go any higher!' : 'won\'t go any lower!')
            : n === 1 ? (up ? 'rose!' : 'fell!') : n === 2 ? (up ? 'rose sharply!' : 'harshly fell!') : (up ? 'rose drastically!' : 'severely fell!');
          evs.push({ b: 'text', text: `${name(a1)}'s ${STAT_NAMES[a2] ?? a2} ${amount}` });
          break;
        }
        case '-ability': evs.push({ b: 'text', text: `[${name(a1)}'s ${a2}]` }); break;
        case '-weather': {
          const w: Record<string, string> = { RainDance: 'It started to rain!', SunnyDay: 'The sunlight turned harsh!', Sandstorm: 'A sandstorm kicked up!', Snow: 'It started to snow!', none: 'The weather returned to normal.' };
          if (!parts.includes('[upkeep]') && w[a1]) evs.push({ b: 'text', text: w[a1] });
          break;
        }
        case 'faint': evs.push({ b: 'faint', side: sideOf(a1), text: `${name(a1)} fainted!` }); break;
      }
    }
    evs.push(...afterHit);
    return evs;
  }

  private pokemonOf(ident: string): SimPokemon | undefined {
    const n = ident.slice(ident.indexOf(':') + 1).trim();
    const list = (ident.startsWith('p1') ? this.sim.p1 : this.sim.p2).pokemon.filter(p => p.name === n);
    return list.find(p => p.isActive) ?? list[0];
  }

  private view(p: SimPokemon): BattleMonView {
    return {
      uid: (p.set as any).uid, species: p.species.id, key: speciesExtra(p.species.id).key, name: p.name, level: p.level,
      hp: p.hp, maxhp: p.maxhp, status: (p.status || '') as StatusId, gender: (p.gender || '') as '' | 'M' | 'F', shiny: !!p.set.shiny
    };
  }
}

function toSet(m: Mon) {
  return {
    uid: m.uid, name: monName(m), species: speciesName(m.species), level: m.level, gender: m.gender, shiny: m.shiny,
    ability: m.ability, nature: m.nature, item: '', ivs: m.ivs, evs: m.evs, moves: m.moves.map(mv => mv.id)
  };
}
