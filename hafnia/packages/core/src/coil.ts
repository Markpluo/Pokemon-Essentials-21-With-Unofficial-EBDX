// Copper & Current, the game's signature battle mechanic (mechanics/copper-and-current-spec.md).
// Each side has a Coil that charges during battle. At 3 pips it can be spent once per battle:
// Copper coats one Pokémon in patina for the rest of the battle, Current supercharges one move.
// The effects are Showdown conditions installed into the simulator's dex; BattleSession keeps
// the pips and decides when a side may activate.
import { Dex, Pokemon } from '@pkmn/sim';
import type { CoilMode } from './protocol';

export interface CoilRules {
  max: number;          // gauge size
  ready: number;        // pips needed to activate
  startWild: number;
  startTrainer: number;
  patinaSuperEffective: number;   // damage multiplier on super-effective hits taken
  currentPower: number;           // base power multiplier
  currentProtect: number;         // damage through Protect (applied by the simulator, 0.25 like Z-moves)
  overchargeDrain: number;        // fraction of max HP lost per turn
}

export const COIL_DEFAULTS: CoilRules = {
  max: 4, ready: 3, startWild: 2, startTrainer: 0,
  patinaSuperEffective: 0.75, currentPower: 1.3, currentProtect: 0.25, overchargeDrain: 1 / 8
};

export interface CoilUnlocks { copper?: boolean; current?: boolean; harmony?: boolean }

let rules = COIL_DEFAULTS;
let installed = false;

/** Adds the Copper & Current conditions to the simulator. Safe to call more than once. */
export function installCoil(r: CoilRules = COIL_DEFAULTS) {
  rules = r;
  if (installed) return;
  installed = true;

  // A sealed item has no effect while the holder is patinated (Embargo rules, for the whole battle).
  const ignoring = Pokemon.prototype.ignoringItem;
  Pokemon.prototype.ignoringItem = function (this: Pokemon, isFling = false) {
    if ((this as any).m?.patinated) return true;
    return ignoring.call(this, isFling);
  };

  // Names must match the ids: Showdown derives a condition's id from its name.
  const conditions = Dex.data.Conditions as Record<string, unknown>;

  conditions.hafniapatina = {
    name: 'Hafnia Patina', effectType: 'Condition',
    onSourceModifyDamage(this: any, damage: number, source: Pokemon, target: Pokemon, move: any) {
      if (target.getMoveHitData(move).typeMod > 0) return this.chainModify(rules.patinaSuperEffective);
    },
    onCriticalHit: false,
    onTryBoost(this: any, boost: Record<string, number>, target: Pokemon, source: Pokemon | null) {
      if (!source || source === target) return;
      let blocked = false;
      for (const k of ['def', 'spd']) if ((boost[k] ?? 0) < 0) { delete boost[k]; blocked = true; }
      if (blocked) this.add('-activate', target, 'Patina');
    }
  };

  conditions.hafniacurrent = {
    name: 'Hafnia Current', effectType: 'Condition', duration: 1,
    onModifyMove(move: any) { move.accuracy = true; },
    onBasePowerPriority: 1,
    onBasePower(this: any, basePower: number, source: Pokemon, target: Pokemon, move: any) {
      if (move.category !== 'Status') return this.chainModify(rules.currentPower);
    },
    // Breaks through Protect and its relatives for reduced damage, like a Z-move.
    onHitProtect(this: any, source: Pokemon, target: Pokemon, move: any) {
      target.getMoveHitData(move).bypassProtect = true;
      return false;
    },
    onAfterMove(this: any, source: Pokemon, target: Pokemon | null) {
      source.removeVolatile('hafniacurrent');
      const foes = source.side.foe.active;
      if ((target && target.hp <= 0) || foes.some(p => p && p.hp <= 0 && !p.fainted && p !== source)) {
        source.side.addSideCondition('hafnialivewire', source);
      }
    }
  };

  conditions.hafnialivewire = {
    name: 'Hafnia Live Wire', effectType: 'Condition',
    onSwitchIn(this: any, pokemon: Pokemon) {
      this.add('-activate', pokemon, 'Live Wire');
      this.boost({ spe: 1 }, pokemon, pokemon);
      pokemon.side.removeSideCondition('hafnialivewire');
    }
  };

  conditions.hafniaovercharge = {
    name: 'Hafnia Overcharge', effectType: 'Condition',
    onResidualOrder: 28,
    onResidual(this: any, pokemon: Pokemon) {
      this.damage(Math.max(1, Math.floor(pokemon.baseMaxhp * rules.overchargeDrain)), pokemon, pokemon);
    }
  };

  // Patina and Overcharge belong to the Pokémon, not to its time on the field: put them back on switch-in.
  conditions.hafniacoil = {
    name: 'Hafnia Coil', effectType: 'Condition',
    onSwitchIn(pokemon: Pokemon) {
      const m = (pokemon as any).m;
      if (m?.patinated) pokemon.addVolatile('hafniapatina');
      if (m?.overcharged) pokemon.addVolatile('hafniaovercharge');
      if (m?.guarded) pokemon.addVolatile('hafniaguard');
    }
  };

  // The very first rival battle: the player's Pokémon take half damage and can't be knocked out.
  conditions.hafniaguard = {
    name: 'Hafnia Guard', effectType: 'Condition',
    onSourceModifyDamage(this: any) { return this.chainModify(0.5); },
    onDamagePriority: -100,
    onDamage(damage: number, target: Pokemon) {
      if (damage >= target.hp) return target.hp - 1;
    }
  };
}

export function coilRules() { return rules; }

/** Why a side can't use a mode right now, or null if it can. Shown on the greyed-out toggle. */
export function coilBlock(mode: CoilMode, s: { pips: number; used: boolean; unlocks: CoilUnlocks; enabled: boolean },
  p: Pokemon, moveCategory?: string): string | null {
  if (!s.enabled) return 'The Coil is offline in this battle.';
  if (!s.unlocks[mode]) return mode === 'copper' ? 'Copper isn\'t unlocked yet.' : mode === 'current' ? 'Current isn\'t unlocked yet.' : 'Harmony isn\'t unlocked yet.';
  if (s.used) return 'The Coil has already been used.';
  if (s.pips < rules.ready) return 'The Coil isn\'t charged yet.';
  if (mode === 'copper' || mode === 'harmony') {
    if ((p as any).m?.patinated) return 'It already has a patina.';
    const item = p.getItem();
    if (item.forcedForme || (item as any).megaStone || item.id.endsWith('memory')) return 'Its held item stops the patina.';
  }
  if (mode !== 'copper' && moveCategory === 'Status') return 'Status moves can\'t carry Current.';
  return null;
}

/** Coats a Pokémon in patina for the rest of the battle. */
export function applyPatina(p: Pokemon) {
  (p as any).m.patinated = true;
  p.addVolatile('hafniapatina');
}

/** Charges the Pokémon's next move with Current. */
export function applyCurrent(p: Pokemon) { p.addVolatile('hafniacurrent'); }

export function applyOvercharge(p: Pokemon) {
  (p as any).m.overcharged = true;
  p.addVolatile('hafniaovercharge');
}
