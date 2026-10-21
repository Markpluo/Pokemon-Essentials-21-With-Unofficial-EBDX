// Bag items for the demo (systems.md §5.2). Prices are in kroner; Marts sell an item once the
// player has `minBadges` badges. Battle and field use both go through these definitions.
import type { StatusId } from './protocol';

export type Pocket = 'medicine' | 'balls' | 'tms' | 'key' | 'other';

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
  tm?: string;               // move taught (reusable)
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
  repel: { name: 'Repel', pocket: 'other', price: 400, minBadges: 0, repel: 100, desc: 'Keeps weaker wild Pokémon away for 100 steps.' },
  oranberry: { name: 'Oran Berry', pocket: 'medicine', price: 20, heal: 10, desc: 'A berry that restores 10 HP.' },
  netball: { name: 'Net Ball', pocket: 'balls', price: 1000, minBadges: 2, ball: 1, desc: 'A ball that works well on Water and Bug types.' },
  pearl: { name: 'Pearl', pocket: 'other', price: 1400, desc: 'A pretty pearl. Shops buy it for a good price.' },
  tmbulletseed: { name: 'TM Bullet Seed', pocket: 'tms', price: 0, tm: 'bulletseed', desc: 'Teaches Bullet Seed. Can be used again and again.' },
  tmacidspray: { name: 'TM Acid Spray', pocket: 'tms', price: 0, tm: 'acidspray', desc: 'Teaches Acid Spray. Can be used again and again.' },
  tmmagicalleaf: { name: 'TM Magical Leaf', pocket: 'tms', price: 0, tm: 'magicalleaf', desc: 'Teaches Magical Leaf. Can be used again and again.' },
  tmround: { name: 'TM Round', pocket: 'tms', price: 0, tm: 'round', desc: 'Teaches Round. Can be used again and again.' },
  tmwaterpulse: { name: 'TM Water Pulse', pocket: 'tms', price: 0, tm: 'waterpulse', desc: 'Teaches Water Pulse. Can be used again and again.' },
  bike: { name: 'Rotom Cargo-Bike', pocket: 'key', price: 0, desc: 'Ørsted\'s prototype. Ride it from the menu outdoors.' },
  oldrod: { name: 'Old Rod', pocket: 'key', price: 0, desc: 'Old Knud\'s rod. Face water and press A to fish.' },
  coppernail: { name: 'Copper Hull Nail', pocket: 'key', price: 0, desc: 'From the old ships. Lets the Coil make Patina armour.' },
  lighthouselog: { name: 'Lighthouse Log', pocket: 'key', price: 0, desc: 'Yellowed pages from a lighthouse keeper\'s log.' }
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
