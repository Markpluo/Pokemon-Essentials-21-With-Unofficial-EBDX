// Bag items for the demo (systems.md §5.2). Prices are in kroner; Marts sell an item once the
// player has `minBadges` badges. Battle and field use both go through these definitions.
import type { StatusId } from './protocol';

export type Pocket = 'medicine' | 'balls' | 'other';

export interface ItemDef {
  name: string;
  pocket: Pocket;
  price: number;
  minBadges?: number;        // when Marts start selling it; absent = never sold
  desc: string;
  heal?: number;             // HP restored (Infinity = full)
  cures?: StatusId[] | 'all';
  revive?: number;           // fraction of max HP a fainted Pokémon comes back with
  ball?: number;             // catch-rate multiplier
  repel?: number;            // steps
}

export const ITEMS: Record<string, ItemDef> = {
  potion: { name: 'Potion', pocket: 'medicine', price: 200, minBadges: 0, heal: 20, desc: 'Restores 20 HP.' },
  superpotion: { name: 'Super Potion', pocket: 'medicine', price: 700, minBadges: 1, heal: 60, desc: 'Restores 60 HP.' },
  antidote: { name: 'Antidote', pocket: 'medicine', price: 200, minBadges: 0, cures: ['psn', 'tox'], desc: 'Cures poison.' },
  paralyzeheal: { name: 'Paralyze Heal', pocket: 'medicine', price: 300, minBadges: 0, cures: ['par'], desc: 'Cures paralysis.' },
  awakening: { name: 'Awakening', pocket: 'medicine', price: 100, minBadges: 0, cures: ['slp'], desc: 'Wakes a sleeping Pokémon.' },
  burnheal: { name: 'Burn Heal', pocket: 'medicine', price: 300, minBadges: 0, cures: ['brn'], desc: 'Heals a burn.' },
  fullheal: { name: 'Full Heal', pocket: 'medicine', price: 400, minBadges: 2, cures: 'all', desc: 'Cures any status condition.' },
  revive: { name: 'Revive', pocket: 'medicine', price: 2000, minBadges: 3, revive: 0.5, desc: 'Revives a fainted Pokémon with half its HP.' },
  pokeball: { name: 'Poké Ball', pocket: 'balls', price: 200, minBadges: 0, ball: 1, desc: 'A ball for catching wild Pokémon.' },
  greatball: { name: 'Great Ball', pocket: 'balls', price: 600, minBadges: 2, ball: 1.5, desc: 'Catches better than a Poké Ball.' },
  repel: { name: 'Repel', pocket: 'other', price: 400, minBadges: 0, repel: 100, desc: 'Keeps weaker wild Pokémon away for 100 steps.' }
};

export const itemName = (id: string) => ITEMS[id]?.name ?? id;

/** What an item would do to a Pokémon with this HP and status, or null if it would do nothing. */
export function itemEffect(it: ItemDef, hp: number, maxhp: number, status: StatusId): { hp: number; cure: boolean } | null {
  if (it.revive) return hp <= 0 ? { hp: Math.max(1, Math.floor(maxhp * it.revive)), cure: true } : null;
  if (hp <= 0) return null;
  const cure = !!status && (it.cures === 'all' || !!it.cures?.includes(status));
  const heal = it.heal ? Math.min(maxhp, hp + it.heal) : hp;
  if (heal === hp && !cure) return null;
  return { hp: heal, cure };
}
