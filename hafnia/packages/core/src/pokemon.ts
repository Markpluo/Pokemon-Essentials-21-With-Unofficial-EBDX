// Pokémon as stored in saves, plus stats, EXP and learnsets.
// Mechanics data (types, base stats, abilities, moves) comes from the Showdown dex so that
// party screens and battles always agree. Essentials PBS data (species.json) adds catch
// rates, base EXP, growth rates and level-up moves.
import { Dex } from '@pkmn/sim';
import pbsSpecies from '../data/species.json';
import type { MonView, MoveView, StatusId } from './protocol';
import type { Rng } from './rng';

export interface Mon {
  uid: string;
  species: string; // Showdown species id, e.g. "litten"
  level: number;
  exp: number;
  hp: number;
  status: StatusId;
  nature: string;
  ability: string;
  gender: '' | 'M' | 'F';
  shiny: boolean;
  ivs: Stats;
  evs: Stats;
  moves: { id: string; pp: number }[];
  ot?: string;
  nickname?: string;
}
export interface Stats { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;

export interface SpeciesExtra {
  key: string; catchRate: number; baseExp: number; growth: string;
  moves: [number, string][]; evolutions?: [string, string, string][]; category?: string; dex?: string;
}
const EXTRA = pbsSpecies as unknown as Record<string, SpeciesExtra>;

/** Packs register data for their own species (and can override PBS data) here. */
export function registerSpeciesExtra(id: string, data: SpeciesExtra) { EXTRA[id] = data; }

export function speciesExtra(id: string): SpeciesExtra {
  const e = EXTRA[id];
  if (!e) throw new Error(`No species data for "${id}"`);
  return e;
}
export const speciesName = (id: string) => Dex.species.get(id).name;
export const speciesTypes = (id: string) => Dex.species.get(id).types.map(t => t.toLowerCase());
export const monName = (m: Mon) => m.nickname || speciesName(m.species);

export function calcStats(m: Mon): Stats {
  const base = Dex.species.get(m.species).baseStats;
  const nature = Dex.natures.get(m.nature);
  const out = {} as Stats;
  for (const k of STAT_KEYS) {
    const core = Math.floor((2 * base[k] + m.ivs[k] + Math.floor(m.evs[k] / 4)) * m.level / 100);
    if (k === 'hp') out.hp = base.hp === 1 ? 1 : core + m.level + 10;
    else out[k] = Math.floor((core + 5) * (nature.plus === k ? 1.1 : nature.minus === k ? 0.9 : 1));
  }
  return out;
}
export const maxHp = (m: Mon) => calcStats(m).hp;
export const maxPp = (moveId: string) => Dex.moves.get(moveId).pp;

// Growth rate formulas, named as in Essentials PBS.
export function expForLevel(growth: string, n: number): number {
  if (n <= 1) return 0;
  const n3 = n ** 3;
  switch (growth) {
    case 'Fast': return Math.floor(4 * n3 / 5);
    case 'Slow': return Math.floor(5 * n3 / 4);
    case 'Parabolic': return Math.floor(6 * n3 / 5 - 15 * n * n + 100 * n - 140);
    case 'Erratic':
      if (n <= 50) return Math.floor(n3 * (100 - n) / 50);
      if (n <= 68) return Math.floor(n3 * (150 - n) / 100);
      if (n <= 98) return Math.floor(n3 * Math.floor((1911 - 10 * n) / 3) / 500);
      return Math.floor(n3 * (160 - n) / 100);
    case 'Fluctuating':
      if (n <= 15) return Math.floor(n3 * (Math.floor((n + 1) / 3) + 24) / 50);
      if (n <= 36) return Math.floor(n3 * (n + 14) / 50);
      return Math.floor(n3 * (Math.floor(n / 2) + 32) / 50);
    default: return n3; // Medium
  }
}
export const expRange = (m: Mon) => {
  const g = speciesExtra(m.species).growth;
  return { lo: expForLevel(g, m.level), hi: expForLevel(g, Math.min(100, m.level + 1)) };
};

let uidCounter = 0;
export function newUid(rng: Rng) { return (Date.now() % 1e9).toString(36) + (uidCounter++).toString(36) + rng.int(1e9).toString(36); }

export interface MakeMonOptions { moves?: string[]; nature?: string; ot?: string; ivs?: Partial<Stats> }

export function makeMon(species: string, level: number, rng: Rng, opts: MakeMonOptions = {}): Mon {
  const sp = Dex.species.get(species);
  if (!sp.exists) throw new Error(`Unknown species "${species}"`);
  const natures = Dex.natures.all();
  const learned = opts.moves ?? speciesExtra(sp.id).moves.filter(([l]) => l <= level).map(([, id]) => id)
    .filter((id, i, a) => a.lastIndexOf(id) === i).slice(-4);
  const ivs = {} as Stats;
  for (const k of STAT_KEYS) ivs[k] = opts.ivs?.[k] ?? rng.int(32);
  const gender = sp.gender ? (sp.gender === 'N' ? '' : sp.gender)
    : rng.next() < (sp.genderRatio?.M ?? 0.5) ? 'M' : 'F';
  const m: Mon = {
    uid: newUid(rng), species: sp.id, level, exp: expForLevel(speciesExtra(sp.id).growth, level), hp: 0, status: '',
    nature: opts.nature ?? rng.pick(natures).name, ability: sp.abilities[0], gender: gender as Mon['gender'],
    shiny: rng.int(4096) === 0, ivs, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: learned.map(id => ({ id, pp: maxPp(id) })), ...(opts.ot ? { ot: opts.ot } : {})
  };
  m.hp = maxHp(m);
  return m;
}

export function healMon(m: Mon) {
  m.hp = maxHp(m); m.status = '';
  for (const mv of m.moves) mv.pp = maxPp(mv.id);
}

/** Adds EXP and returns what happened, level by level, so callers can narrate it. */
export function gainExp(m: Mon, amount: number): { level: number; learned: string[]; forgot: string[] }[] {
  const ex = speciesExtra(m.species);
  m.exp += amount;
  const steps = [];
  while (m.level < 100 && m.exp >= expForLevel(ex.growth, m.level + 1)) {
    const oldMax = maxHp(m);
    m.level++;
    m.hp = Math.min(maxHp(m), m.hp + maxHp(m) - oldMax);
    const learned: string[] = [], forgot: string[] = [];
    for (const [l, id] of ex.moves) {
      if (l !== m.level || m.moves.some(mv => mv.id === id)) continue;
      // Like the POC: a full moveset forgets its oldest move. A choice prompt comes later.
      if (m.moves.length >= 4) forgot.push(m.moves.shift()!.id);
      m.moves.push({ id, pp: maxPp(id) });
      learned.push(id);
    }
    steps.push({ level: m.level, learned, forgot });
  }
  return steps;
}

export function moveView(id: string, pp: number, maxpp?: number, disabled?: boolean): MoveView {
  const mv = Dex.moves.get(id);
  return { id, name: mv.name, type: mv.type.toLowerCase(), pp, maxpp: maxpp ?? mv.pp, ...(disabled ? { disabled } : {}) };
}

export function monView(m: Mon): MonView {
  const { lo, hi } = expRange(m);
  return {
    uid: m.uid, species: m.species, key: speciesExtra(m.species).key, name: monName(m), types: speciesTypes(m.species),
    level: m.level, hp: m.hp, maxhp: maxHp(m), status: m.status, moves: m.moves.map(mv => moveView(mv.id, mv.pp)),
    exp: m.exp, expLo: lo, expHi: hi, gender: m.gender, shiny: m.shiny
  };
}
