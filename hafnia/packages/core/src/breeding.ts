// Breeding and eggs (design/breeding-and-daycare.md). The Vuggestuen daycare holds two
// Pokémon; every 90 steps a compatible pair may lay an egg in one of the prams. Eggs are
// Pokémon with an `egg` field: they ride in the party, never battle, and hatch by steps.
// Everything is rolled when the egg is made, on the seeded RNG, so a server can trust it.
import { Dex, toID } from '@pkmn/sim';
import { makeMon, maxHp, maxPp, speciesExtra, type Mon, type Stats } from './pokemon';
import type { MonView } from './protocol';
import type { Rng } from './rng';

export const DAYCARE_SLOTS = 2;
export const PRAMS = 3;
export const EGG_CHECK_STEPS = 90;
export const DAYCARE_FEE = 500;

/** `item` is a toy handed to Bodil with the Pokémon; a held item (Mon.item) counts too. */
export interface DaycareSlot { mon: Mon; item?: string }
export interface DaycareState { slots: DaycareSlot[]; eggs: Mon[]; counter: number }
export const emptyDaycare = (): DaycareState => ({ slots: [], eggs: [], counter: 0 });

export type Compat = 0 | 20 | 50 | 70;
export const COMPAT_TEXT: Record<Compat, string> = {
  70: 'They get along very well!',
  50: 'They get along fine.',
  20: 'They don\'t seem to like each other much.',
  0: 'They\'d rather play with other Pokémon.'
};

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const HALVE_HATCH = new Set(['Flame Body', 'Magma Armor', 'Steam Engine']);
const PLAIN_BALL: Record<string, string> = { masterball: 'pokeball', cherishball: 'pokeball' };

const eggGroups = (m: Mon) => Dex.species.get(m.species).eggGroups;
const isDitto = (m: Mon) => eggGroups(m).includes('Ditto');

/** How likely (%) this pair is to lay an egg at each check. 0 = they can't breed. */
export function compatibility(a: Mon, b: Mon, ovalCharm = false): number {
  if (a.egg || b.egg) return 0;
  const ga = eggGroups(a), gb = eggGroups(b);
  if (ga.includes('Undiscovered') || gb.includes('Undiscovered')) return 0;
  const da = isDitto(a), db = isDitto(b);
  if (da && db) return 0;
  if (!da && !db) {
    if (!a.gender || !b.gender || a.gender === b.gender) return 0;
    if (!ga.some(g => gb.includes(g))) return 0;
  }
  const same = Dex.species.get(a.species).baseSpecies === Dex.species.get(b.species).baseSpecies;
  const sameOt = (a.ot ?? '') === (b.ot ?? '');
  const c: Compat = same && !sameOt ? 70 : same || !sameOt ? 50 : 20;
  return ovalCharm ? ({ 70: 88, 50: 80, 20: 40 } as Record<number, number>)[c] : c;
}

export function compatText(a: Mon, b: Mon): string {
  const c = compatibility(a, b);
  return COMPAT_TEXT[(c >= 70 ? 70 : c >= 50 ? 50 : c > 0 ? 20 : 0) as Compat];
}

/** The parent whose species and ability the egg takes: the mother, or whichever isn't Ditto. */
export function eggParent(a: Mon, b: Mon): Mon {
  if (isDitto(a)) return b;
  if (isDitto(b)) return a;
  return a.gender === 'F' ? a : b;
}

/** The species that hatches: the first stage of the parent's line (Gen 9 has no incense). */
export function eggSpecies(parent: Mon, rng: Rng): string {
  let sp = Dex.species.get(parent.species);
  while (sp.prevo) sp = Dex.species.get(sp.prevo);
  const id = sp.id;
  if (id === 'nidoranf' || id === 'nidoranm') return rng.chance(0.5) ? 'nidoranf' : 'nidoranm';
  if (id === 'illumise' || id === 'volbeat') return rng.chance(0.5) ? 'illumise' : 'volbeat';
  if (id === 'manaphy') return 'phione';
  return id;
}

/** Egg moves the species can inherit (any generation's "E" source in the Showdown learnsets). */
export function eggMoves(species: string): Set<string> {
  const ls = Dex.species.getLearnsetData(toID(species))?.learnset ?? {};
  return new Set(Object.entries(ls).filter(([, src]) => src.some(s => /^\dE/.test(s))).map(([id]) => id));
}

/** Steps to hatch: PBS HatchSteps halved (Gen 8+ uses 128-step cycles). */
export const hatchSteps = (species: string) => Math.max(1, Math.floor((speciesExtra(species).hatchSteps ?? 5120) / 2));

export interface BreedOptions { ot: string; items?: [string | undefined, string | undefined] }

/** Rolls the egg two daycare Pokémon would lay (systems.md §10, Gen 9 rules). */
export function breed(a: Mon, b: Mon, rng: Rng, o: BreedOptions): Mon {
  const [ia, ib] = o.items ?? [];
  const parent = eggParent(a, b), species = eggSpecies(parent, rng);
  const knot = ia === 'destinyknot' || ib === 'destinyknot';
  const stones = [ia === 'everstone' ? a : null, ib === 'everstone' ? b : null].filter((m): m is Mon => !!m);

  // IVs: 3 (5 with a Destiny Knot) different stats, each copied from a random parent.
  const ivs = {} as Partial<Stats>;
  const keys = [...STAT_KEYS];
  for (let n = knot ? 5 : 3; n > 0; n--) {
    const k = keys.splice(rng.int(keys.length), 1)[0];
    ivs[k] = (rng.chance(0.5) ? a : b).ivs[k];
  }
  const nature = stones.length ? rng.pick(stones).nature : undefined;

  // Shiny: 1/4096, six rolls (Masuda) when a parent comes from another trainer.
  const masuda = [a, b].some(m => m.ot && m.ot !== o.ot);
  let shiny = false;
  for (let i = masuda ? 6 : 1; i > 0 && !shiny; i--) shiny = rng.int(4096) === 0;

  const egg = makeMon(species, 1, rng, { nature, ivs, ot: o.ot });
  egg.shiny = shiny;
  egg.ability = inheritAbility(parent, species, rng);

  // Moves: level-1 moves, then egg moves either parent knows; the last four stay.
  const known = new Set([...a.moves, ...b.moves].map(m => m.id));
  const egged = [...eggMoves(species)].filter(id => known.has(id));
  const ids = [...egg.moves.map(m => m.id), ...egged].filter((id, i, l) => l.indexOf(id) === i).slice(-4);
  egg.moves = ids.map(id => ({ id, pp: maxPp(id) }));

  const sameSpecies = !isDitto(a) && !isDitto(b) && Dex.species.get(a.species).baseSpecies === Dex.species.get(b.species).baseSpecies;
  const ball = (sameSpecies ? rng.pick([a, b]) : parent).ball ?? 'pokeball';
  egg.ball = PLAIN_BALL[ball] ?? ball;
  return toEgg(egg);
}

function inheritAbility(parent: Mon, species: string, rng: Rng): string {
  const from = Dex.species.get(parent.species).abilities as unknown as Record<string, string>;
  const to = Dex.species.get(species).abilities as unknown as Record<string, string>;
  const slot = Object.entries(from).find(([, name]) => name === parent.ability)?.[0] ?? '0';
  if (slot === 'H' && to.H && rng.chance(0.6)) return to.H;
  if (slot !== 'H' && to[slot] && rng.chance(0.8)) return to[slot];
  const plain = [to['0'], to['1']].filter(Boolean);
  return rng.pick(plain);
}

/** Turns a freshly made Lv 1 Pokémon into an egg. */
export function toEgg(m: Mon, steps = hatchSteps(m.species)): Mon {
  m.egg = { steps };
  m.hp = 0; m.status = '';
  return m;
}

export interface GiftEggOptions { ot: string; perfectIvs?: number; hiddenAbility?: boolean; ball?: string; steps?: number }

/** A quest egg (progression-quests-time.md §2.1): optional perfect IVs and hidden ability. */
export function giftEgg(species: string, rng: Rng, o: GiftEggOptions): Mon {
  const ivs: Partial<Stats> = {};
  const keys = [...STAT_KEYS];
  for (let n = o.perfectIvs ?? 0; n > 0 && keys.length; n--) ivs[keys.splice(rng.int(keys.length), 1)[0]] = 31;
  const m = makeMon(species, 1, rng, { ivs, ot: o.ot });
  const h = (Dex.species.get(species).abilities as unknown as Record<string, string>).H;
  if (o.hiddenAbility && h) m.ability = h;
  m.ball = o.ball ?? 'pokeball';
  return toEgg(m, o.steps);
}

/** Wakes the baby up: full HP, no egg field. */
export function hatch(m: Mon) {
  delete m.egg;
  m.hp = maxHp(m);
  return m;
}

/** How many egg steps one overworld step is worth for this party (Flame Body and friends halve). */
export const eggStepValue = (party: readonly Mon[], perTile = 1) =>
  perTile * (party.some(m => !m.egg && HALVE_HATCH.has(m.ability)) ? 2 : 1);

export function eggHint(steps: number): string {
  if (steps > 2560) return 'It looks like this Egg will take a long time to hatch.';
  if (steps > 1280) return 'What will hatch from this? It doesn\'t seem close to hatching.';
  if (steps > 640) return 'It appears to move occasionally. It may be close to hatching.';
  return 'Sounds can be heard coming from inside! It will hatch soon!';
}

/** What a client may see of an egg: nothing that gives away the species. */
export function eggView(m: Mon): MonView {
  return {
    uid: m.uid, species: 'egg', key: 'EGG', name: 'Egg', types: [], level: 0, hp: 0, maxhp: 0, status: '', moves: [],
    exp: 0, expLo: 0, expHi: 1, gender: '', shiny: false, egg: { hint: eggHint(m.egg!.steps) }
  };
}

/** Counts daycare steps. Returns true when a new egg was laid in a pram. */
export function daycareStep(d: DaycareState, rng: Rng, ot: string, n = 1): boolean {
  if (d.slots.length < 2) { d.counter = 0; return false; }
  d.counter += n;
  let laid = false;
  while (d.counter >= EGG_CHECK_STEPS) {
    d.counter -= EGG_CHECK_STEPS;
    if (d.eggs.length >= PRAMS) continue;
    const [a, b] = d.slots;
    if (rng.int(100) < compatibility(a.mon, b.mon)) {
      d.eggs.push(breed(a.mon, b.mon, rng, { ot, items: [a.item ?? a.mon.item, b.item ?? b.mon.item] }));
      laid = true;
    }
  }
  return laid;
}
